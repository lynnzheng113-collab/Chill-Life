import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const allowedTones = new Set(['slump', 'steady', 'growth', 'bond', 'mixed']);
const DEEPSEEK_EVENT_TARGET = 4;
const allowedStatKeys = new Set([
  'energy',
  'health',
  'money',
  'career',
  'relationships',
  'selfWorth',
  'avoidance',
  'opportunity',
]);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function cleanText(value, fallback, maxLength = 160) {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  return (text || fallback).slice(0, maxLength);
}

function normalizeDelta(delta = {}) {
  return Object.fromEntries(
    Object.entries(delta)
      .filter(([key]) => allowedStatKeys.has(key))
      .map(([key, value]) => {
        const number = Number(value);
        const limit = key === 'money' ? 1500 : 18;
        return [key, Number.isFinite(number) ? clamp(Math.round(number), -limit, limit) : 0];
      })
      .filter(([, value]) => value !== 0),
  );
}

function normalizeDeepSeekEvents(events, eventTarget = DEEPSEEK_EVENT_TARGET) {
  if (!Array.isArray(events)) return [];

  return events
    .slice(0, eventTarget)
    .map((event, eventIndex) => {
      const choices = Array.isArray(event?.choices) ? event.choices : [];
      return {
        id: cleanText(event?.id, `deepseek-${eventIndex + 1}`, 48),
        phase: cleanText(event?.phase, `画像第 ${eventIndex + 1} 幕`, 24),
        title: cleanText(event?.title, `第 ${eventIndex + 1} 个定制节点`, 80),
        body: cleanText(event?.body, '你的画像在这里生成了一个新的生活事件。', 220),
        thought: cleanText(event?.thought, '这一步会改变你的生活惯性。', 160),
        choices: choices.slice(0, 3).map((choice, choiceIndex) => {
          const tone = allowedTones.has(choice?.tone) ? choice.tone : 'steady';
          return {
            label: cleanText(choice?.label, `选择 ${choiceIndex + 1}`, 40),
            description: cleanText(choice?.description, '这会让路径朝一个新的方向移动。', 120),
            tag: cleanText(choice?.tag, `节点 ${choiceIndex + 1}`, 18),
            tone,
            delta: normalizeDelta(choice?.delta),
            journal: cleanText(choice?.journal, choice?.description || '这一选择留下了一段人生记录。', 180),
          };
        }),
      };
    })
    .filter((event) => event.choices.length >= 2);
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 80_000) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function jsonResponse(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function buildScenarioPrompt({ profile, persona, maxTurns }, eventTarget = DEEPSEEK_EVENT_TARGET) {
  const eventCount = Math.min(Number(maxTurns) || eventTarget, eventTarget);

  return [
    {
      role: 'system',
      content: [
        '你是一个中文交互式人生模拟器的剧情生成器。',
        `你的任务是根据用户画像生成“摆烂人生模拟器”的前 ${eventCount} 幕人生事件。`,
        '不要输出建议文章，不要输出 Markdown，只输出严格 JSON。',
        '每个事件必须有 3 个选择：一个后撤/摆烂，一个稳住底盘，一个行动/关系修复。',
        'tone 只能是 slump、steady、growth、bond、mixed。',
        'delta 只能使用这些字段：energy, health, money, career, relationships, selfWorth, avoidance, opportunity。',
        '除 money 外，delta 的绝对值不要超过 18；money 的绝对值不要超过 1500。',
        '文字要具体、短、像人生记录，不要解释产品功能。',
      ].join('\n'),
    },
    {
      role: 'user',
      content: JSON.stringify(
        {
          required_json_shape: {
            events: [
              {
                id: 'deepseek-1',
                phase: '画像第 1 幕',
                title: '短标题，来自用户真实压力',
                body: '90 字以内，第二人称，具体生活场景',
                thought: '60 字以内，点出人生惯性',
                choices: [
                  {
                    label: '选择按钮文案',
                    description: '60 字以内的短后果',
                    tag: '路径节点短标签',
                    tone: 'slump|steady|growth|bond|mixed',
                    delta: { energy: -3, selfWorth: 4, avoidance: -5 },
                    journal: '100 字以内的人生节点记录，说明这一选择如何影响路径',
                  },
                ],
              },
            ],
          },
          eventCount,
          maxTurns,
          profile,
          persona: {
            label: persona?.label,
            title: persona?.title,
            scene: persona?.scene,
          },
        },
        null,
        2,
      ),
    },
  ];
}

function parseDeepSeekEvents(raw, eventTarget) {
  const content = raw?.choices?.[0]?.message?.content;
  let parsed;

  try {
    parsed = JSON.parse(content || '{}');
  } catch {
    throw new Error('DeepSeek returned non-JSON content');
  }

  const events = normalizeDeepSeekEvents(parsed.events, eventTarget);
  if (events.length < 3) {
    throw new Error('DeepSeek returned too few valid events');
  }

  return events;
}

function deepseekScenarioPlugin(env) {
  return {
    name: 'chill-life-deepseek-scenario-api',
    configureServer(server) {
      server.middlewares.use('/api/deepseek-scenario', async (req, res) => {
        if (req.method !== 'POST') {
          jsonResponse(res, 405, { error: 'Method not allowed' });
          return;
        }

        const apiKey = env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY;
        if (!apiKey) {
          jsonResponse(res, 501, { error: 'DEEPSEEK_API_KEY is not configured' });
          return;
        }

        try {
          const body = JSON.parse(await readRequestBody(req));
          const requestedEventTarget = Math.min(
            Number(body.maxDeepSeekEvents) || DEEPSEEK_EVENT_TARGET,
            DEEPSEEK_EVENT_TARGET,
          );
          const model = env.DEEPSEEK_MODEL || process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
          const attempts = [...new Set([requestedEventTarget, 3])].filter((count) => count >= 3);
          let lastError = null;

          for (const eventTarget of attempts) {
            const upstream = await fetch('https://api.deepseek.com/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model,
                messages: buildScenarioPrompt(body, eventTarget),
                response_format: { type: 'json_object' },
                thinking: { type: 'disabled' },
                stream: false,
                temperature: 0.62,
                max_tokens: eventTarget >= 4 ? 2300 : 1750,
              }),
            });

            const raw = await upstream.json().catch(() => ({}));
            if (!upstream.ok) {
              lastError = new Error(raw?.error?.message || raw?.message || 'DeepSeek request failed');
              if (upstream.status >= 400 && upstream.status < 500 && upstream.status !== 429) break;
              continue;
            }

            try {
              const events = parseDeepSeekEvents(raw, eventTarget);
              jsonResponse(res, 200, {
                source: 'deepseek',
                model,
                events,
                usage: raw?.usage,
              });
              return;
            } catch (error) {
              lastError = error;
            }
          }

          jsonResponse(res, 502, {
            error: lastError?.message || 'DeepSeek scenario generation failed',
          });
        } catch (error) {
          jsonResponse(res, 500, { error: error.message || 'DeepSeek scenario generation failed' });
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    base: './',
    plugins: [react(), deepseekScenarioPlugin(env)],
  };
});
