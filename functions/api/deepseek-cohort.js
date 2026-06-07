// 「同路人 · 真实预测」生成器：在当前人生节点，用 LLM 匹配几个有真实相似经历、
// 但走了不同路的人，看他们后来怎么样了——落点是「最坏也不过如此」，给反焦虑的真实预测。

function cleanText(value, fallback, maxLength = 220) {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  return (text || fallback).slice(0, maxLength);
}

function normalizeCohort(payload) {
  const list = Array.isArray(payload?.cohort) ? payload.cohort : [];
  const cohort = list
    .slice(0, 3)
    .map((person, index) => ({
      who: cleanText(person?.who, `同路人 ${index + 1}`, 60),
      similar: cleanText(person?.similar, '当年和你处在差不多的位置。', 120),
      now: cleanText(person?.now, '几年过去，日子照常过，没那么糟。', 200),
    }))
    .filter((person) => person.now.length > 0);

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

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const apiKey = env.DEEPSEEK_API_KEY;
  if (!apiKey) return jsonResponse(501, { error: 'DEEPSEEK_API_KEY is not configured' });

  try {
    const body = await request.json();
    const model = env.DEEPSEEK_MODEL || 'deepseek-chat';

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
      return jsonResponse(502, { error: raw?.error?.message || 'DeepSeek cohort request failed' });
    }

    let parsed;
    try {
      parsed = JSON.parse(raw?.choices?.[0]?.message?.content || '{}');
    } catch {
      return jsonResponse(502, { error: 'DeepSeek returned non-JSON content' });
    }

    try {
      const data = normalizeCohort(parsed);
      return jsonResponse(200, { source: 'deepseek', model, ...data, usage: raw?.usage });
    } catch (error) {
      return jsonResponse(502, { error: error.message || 'DeepSeek cohort invalid' });
    }
  } catch (error) {
    return jsonResponse(500, { error: error.message || 'DeepSeek cohort generation failed' });
  }
}

export function onRequest(context) {
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
  return jsonResponse(405, { error: 'Method not allowed' });
}
