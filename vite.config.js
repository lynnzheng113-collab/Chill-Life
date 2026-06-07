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

function normalizeCohort(payload) {
  const list = Array.isArray(payload?.cohort) ? payload.cohort : [];
  const cohort = list
    .slice(0, 3)
    .map((person, index) => ({
      who: cleanText(person?.who, `同路人 ${index + 1}`, 60),
      similar: cleanText(person?.similar, '当年和你处在差不多的位置。', 120),
      now: cleanText(person?.now, '几年过去，日子照常过，没那么糟。', 200),
    }));
  if (cohort.length < 2) throw new Error('DeepSeek cohort too small');
  return {
    cohort,
    prediction: cleanText(payload?.prediction, '照这个走法，你大概率会过得普通但安稳——焦虑里担心的那些，多半不会发生。', 280),
    reassurance: cleanText(payload?.reassurance, '就算走到最坏，也不过是日子紧一点、慢一点，你扛得住，也随时能重来。', 200),
  };
}

function buildCohortPrompt({ profile, persona, stats, path, leading }) {
  const pathText = Array.isArray(path) && path.length
    ? path.map((p) => p.decision || p.tag).filter(Boolean).join(' → ')
    : '（还没走几步）';
  return [
    {
      role: 'system',
      content: [
        '你是一个反焦虑的人生模拟器里的「同路人」生成器。目标：消除用户的焦虑。',
        '方法：根据用户当前的人生节点，给出 3 个有真实质感、走了不同道路的「同路人」——他们当年处境和用户相似，后来过得各不相同，但共同点是：都没有崩掉，最坏也不过如此。',
        '铁律：',
        '1. 真实、具体、可信，像身边真会遇到的人，不要名人、不要逆袭爽文、不要鸡汤。',
        '2. 3 个人要走不同的路（比如：一直摆烂的、慢慢回血的、换了赛道的），但结局都落在「可承受、没那么糟、日子照过」。',
        '3. 不评判、不说教、不施压。站在用户这边。',
        '4. prediction 基于这些同路人，给用户一个温和但诚实的真实预测；reassurance 点出「就算最坏也不过如此」。',
        '5. 只输出严格 JSON，不要 Markdown，不要多余文字。',
      ].join('\n'),
    },
    {
      role: 'user',
      content: JSON.stringify(
        {
          required_json_shape: {
            cohort: [
              {
                who: '一句话身份，含年龄/城市量级/处境，如「29岁，二线城市，毕业后gap一年」',
                similar: '50字内：当年和用户相似的地方',
                now: '80字内：几年后的真实近况，具体、温和、落点是没那么糟',
              },
            ],
            prediction: '120字内：综合同路人，给用户的真实走向预测，诚实但安抚',
            reassurance: '60字内：就算最坏也不过如此的一句话',
          },
          user_node: {
            profile,
            persona: { label: persona?.label, title: persona?.title, scene: persona?.scene },
            current_stats: stats,
            path_so_far: pathText,
            leading_forecast: leading,
          },
        },
        null,
        2,
      ),
    },
  ];
}

function deepseekCohortPlugin(env) {
  return {
    name: 'chill-life-deepseek-cohort-api',
    configureServer(server) {
      server.middlewares.use('/api/deepseek-cohort', async (req, res) => {
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
          const model = env.DEEPSEEK_MODEL || process.env.DEEPSEEK_MODEL || 'deepseek-chat';
          const upstream = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              model,
              messages: buildCohortPrompt(body),
              response_format: { type: 'json_object' },
              stream: false,
              temperature: 1.1,
              max_tokens: 1400,
            }),
          });
          const raw = await upstream.json().catch(() => ({}));
          if (!upstream.ok) {
            jsonResponse(res, 502, { error: raw?.error?.message || 'DeepSeek cohort request failed' });
            return;
          }
          let parsed;
          try {
            parsed = JSON.parse(raw?.choices?.[0]?.message?.content || '{}');
          } catch {
            jsonResponse(res, 502, { error: 'DeepSeek returned non-JSON content' });
            return;
          }
          try {
            const data = normalizeCohort(parsed);
            jsonResponse(res, 200, { source: 'deepseek', model, ...data, usage: raw?.usage });
          } catch (error) {
            jsonResponse(res, 502, { error: error.message || 'DeepSeek cohort invalid' });
          }
        } catch (error) {
          jsonResponse(res, 500, { error: error.message || 'DeepSeek cohort generation failed' });
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    base: './',
    plugins: [react(), deepseekScenarioPlugin(env), deepseekCohortPlugin(env)],
  };
});
