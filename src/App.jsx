import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Battery,
  Briefcase,
  CheckCircle2,
  Clock,
  Heart,
  Map as MapIcon,
  MessageCircle,
  RotateCcw,
  Send,
  Shield,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';

const MAX_TURNS = 5;
const DEEPSEEK_EVENT_TARGET = 4;
const DEEPSEEK_API_ENDPOINT = import.meta.env.VITE_DEEPSEEK_API_URL || '/api/deepseek-scenario';
const DEEPSEEK_COHORT_ENDPOINT = import.meta.env.VITE_DEEPSEEK_COHORT_URL || '/api/deepseek-cohort';

// 「同路人 · 真实预测」：把当前人生节点发给 DeepSeek，匹配几个走了不同路的相似经历者，
// 看他们后来怎么样了——给出反焦虑的真实预测。失败时静默降级（不影响主流程）。
async function fetchCohort({ profile, persona, stats, path, leading }) {
  const response = await fetch(DEEPSEEK_COHORT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile, persona, stats, path, leading }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `同路人生成失败：${response.status}`);
  }
  if (!Array.isArray(data?.cohort) || data.cohort.length < 2) {
    throw new Error('同路人数据不完整');
  }
  return data;
}

// 律师 Demo：单一主角，聚焦职场维度。
const personas = [
  {
    id: 'lawyer',
    label: '北京律师·第5年',
    title: '在律所卷了 5 年的执业律师',
    scene: '老板隔三差五甩来「紧急」项目，晋升空间见顶；又天天刷到 AI 写法律文书的新闻，想转 AI 行业，却一点经验都没有。',
    stats: {
      boundary: 32,
      growth: 22,
      ease: 38,
    },
  },
];

// 律师 Demo：只保留 3 个工作维度，全部正向（越高越好），不再有惩罚式指标。
const statMeta = [
  { key: 'boundary', label: '边界感', icon: Shield, color: '#2c8aa1' },
  { key: 'growth', label: '转型力', icon: Sparkles, color: '#327f68' },
  { key: 'ease', label: '安心感', icon: Heart, color: '#6f9b6a' },
];

const defaultProfile = {
  name: '小李',
  age: '30',
  city: '北京',
  lifeStage: '北京律师，执业第 5 年，想转 AI 行业但没经验。',
  currentPressure: '老板总有「紧急」项目，晋升空间见顶，又怕被 AI 替代。',
  goal: '把 AI 技能学起来，给自己多留一条路，同时别被工作榨干。',
  avoidancePattern: '一焦虑就刷手机看「AI 取代律师」的新闻，越看越慌。',
  support: '有个转行做法律 AI 的旧同学，但还没好好聊过。',
  moneyState: '律师收入还行，不至于断粮，但不敢轻易裸辞。',
  healthState: '常熬夜赶老板的急活，肩颈和睡眠都一般。',
  hiddenWish: '希望这 5 年的经验不是白费，AI 时代还用得上。',
};

const profileFields = [
  {
    key: 'lifeStage',
    label: '现在在哪个阶段',
    placeholder: '比如：毕业一年，在大厂边缘岗位，想转产品但没有作品',
  },
  {
    key: 'currentPressure',
    label: '最近最重的压力',
    placeholder: '比如：房租、论文、绩效、家里催问、感情关系、找工作',
  },
  {
    key: 'goal',
    label: '最想保住或完成的事',
    placeholder: '比如：三个月做出作品集，先把现金流稳住',
  },
  {
    key: 'avoidancePattern',
    label: '最常见的逃避方式',
    placeholder: '比如：刷视频、游戏、熬夜、已读不回、乱花钱',
  },
  {
    key: 'support',
    label: '能托住你的人或关系',
    placeholder: '比如：一个朋友、家人、同学、同事，或者暂时没有',
  },
  {
    key: 'moneyState',
    label: '钱和生活底盘',
    placeholder: '比如：月光、负债、房租压力、还行但不敢停',
  },
  {
    key: 'healthState',
    label: '身体和精力状态',
    placeholder: '比如：睡很晚、胃不舒服、焦虑、还能扛',
  },
  {
    key: 'hiddenWish',
    label: '没说出口的想法',
    placeholder: '比如：希望被理解，不想再一直装没事',
  },
];

// 反焦虑改版：摆烂选项不再重罚——大多是「歇一口气」，代价温和可逆；
// thought 从「点出代价」改成「替你卸下内疚」。核心：最坏也不过如此。
const scenarioEvents = [
  {
    id: 'urgent-night',
    phase: '第 1 晚',
    title: '老板 23:40 甩来「紧急」项目',
    body: '微信弹出：「这个明早要，辛苦下。」你心里清楚，这「紧急」多半是他没提前安排。你本来都准备睡了。',
    thought: '这种「紧急」十有八九拖一晚也死不了人。你今晚的睡眠，比他的临时起意值钱。',
    choices: [
      {
        label: '硬扛到凌晨做完',
        description: '熬夜交差，他满意，你顶着黑眼圈。',
        tag: '连夜赶工',
        tone: 'slump',
        delta: { ease: -3, growth: -1, boundary: -2 },
        journal: '你又熬了一夜。项目交了，老板一句「辛苦」就没下文——但天没塌，你还能补觉。',
      },
      {
        label: '回「明早 9 点前给您」',
        description: '不秒回、不熬夜，给个合理时间。',
        tag: '给个期限',
        tone: 'growth',
        delta: { boundary: 8, ease: 4 },
        journal: '你没立刻跳起来。第二天他也没说什么——原来「紧急」是可以商量的。',
      },
      {
        label: '装没看见，先睡了',
        description: '已读不回，明早再说。',
        tag: '今晚先睡',
        tone: 'slump',
        delta: { ease: 5, boundary: 3, growth: -1 },
        journal: '你关了手机睡了。早上他没追问，项目照样推进——少回一条消息，世界没事。',
      },
    ],
  },
  {
    id: 'scolded',
    phase: '第 2 天',
    title: '老板当众把你训了一通',
    body: '一个小格式问题，老板在会上当着同事的面数落你。你脸有点烫，手在桌下握紧。',
    thought: '他的脾气是他的问题，不是你能力的证明。当众训人的人，往往最怕别人不吃这套。',
    choices: [
      {
        label: '平静回一句、划清边界',
        description: '「这个我改，但有意见私下说更高效。」不卑不亢。',
        tag: '当场划边界',
        tone: 'growth',
        delta: { boundary: 10, ease: 3 },
        journal: '他愣了一下，没再说。之后对你客气了些，「紧急」也少甩了——边界划出来，他反而记住了你的分寸。',
      },
      {
        label: '当场忍了，自己消化',
        description: '低头认了，散会。情绪回头再说。',
        tag: '先忍这回',
        tone: 'slump',
        delta: { ease: -2, boundary: -2 },
        journal: '你忍了这一回。难受是真的，但也就难受半天——没人会因为一次格式问题记你一辈子。',
      },
      {
        label: '会后私下找他沟通',
        description: '单独说：当众批评让我很难做事。',
        tag: '私下沟通',
        tone: 'bond',
        delta: { boundary: 6, ease: 4 },
        journal: '你私下提了。他没承认，但下次当众点你的次数少了——说出来，比憋着强。',
      },
    ],
  },
  {
    id: 'ai-news',
    phase: '第 3 天',
    title: '看到「AI 已能起草合同」的新闻',
    body: '同行群在转：某大所开始用 AI 批量起草标准合同。你心里「咯噔」一下：我这点活，是不是迟早被顶掉？',
    thought: 'AI 能写标准合同，但客户的烂摊子、谈判桌上的人情世故，它接不住。被替代的恐慌，往往比真实的替代来得早得多。',
    choices: [
      {
        label: '焦虑刷了一晚手机',
        description: '越刷越慌，但什么也没做。',
        tag: '刷到失眠',
        tone: 'slump',
        delta: { ease: -4 },
        journal: '你慌了一晚。第二天醒来，工作还在、客户还在——焦虑过去了，啥也没发生。',
      },
      {
        label: '花 20 分钟搜「律师怎么用 AI」',
        description: '与其怕它，不如先摸一下它。',
        tag: '先摸一下',
        tone: 'growth',
        delta: { growth: 8, ease: 5 },
        journal: '你随手搜了搜，发现门槛没想象中高。怕的东西，凑近看就没那么吓人了。',
      },
      {
        label: '该干嘛干嘛，先过好今天',
        description: '一条新闻而已，不值得失眠。',
        tag: '不当回事',
        tone: 'steady',
        delta: { ease: 3, growth: -1 },
        journal: '你没当回事。日子照过——不是每条贩卖焦虑的新闻都值得你失眠。',
      },
    ],
  },
  {
    id: 'no-promotion',
    phase: '第 6 周',
    title: '老板暗示晋升无望',
    body: '谈话里老板含糊地说「今年名额紧」。你听懂了：原地踏步，还得熬。',
    thought: '晋升没了，天没塌。它只是提醒你：值得把劲，往别处使一点。',
    choices: [
      {
        label: '先躺平一阵',
        description: '反正升不上去，那就少卷点。',
        tag: '松口气',
        tone: 'slump',
        delta: { ease: 6, boundary: 4, growth: -1 },
        journal: '你松了油门。神奇的是，活照样干完，人却没那么累了——不卷，也没被开除。',
      },
      {
        label: '开始看看外面的机会',
        description: '上招聘网站，瞄一眼 legal-tech 的岗。',
        tag: '看看外面',
        tone: 'growth',
        delta: { growth: 8, ease: 3 },
        journal: '你随便看了看，发现真有公司要「懂法律的 AI 产品」的人。原来你这 5 年，不是白干。',
      },
      {
        label: '找老板争取问清楚',
        description: '问清到底差在哪。',
        tag: '问个明白',
        tone: 'steady',
        delta: { boundary: 5, ease: 2 },
        journal: '你问了。答案没让你满意，但你也不再瞎猜了——知道天花板在哪，反而踏实。',
      },
    ],
  },
  {
    id: 'ordinary-day',
    phase: '第 12 周',
    title: '一个普通工作日，你发现没那么慌了',
    body: '又是个普通的周三。老板的「紧急」还在，AI 的新闻还在，但你发现：自己好像没那么慌了。',
    thought: '你担心的最坏——被骂、被顶替、升不上去——一个个来了，又一个个过去了，你都还好好的。',
    choices: [
      {
        label: '列三件这周能做的小事',
        description: '学一节课、划一次边界、投一份简历。',
        tag: '小步开局',
        tone: 'growth',
        delta: { growth: 7, boundary: 4, ease: 6 },
        journal: '你没翻身，只是把船头轻轻转了个向——这就够了。',
      },
      {
        label: '继续这样，挺好',
        description: '不急着改变，先稳着。',
        tag: '先稳着',
        tone: 'slump',
        delta: { ease: 6, boundary: 2 },
        journal: '你选择先稳着。稳着也是一种答案——你已经没那么怕了。',
      },
      {
        label: '约朋友定个轻松的节点',
        description: '让「想转型」落到一个具体的日子。',
        tag: '定个节点',
        tone: 'bond',
        delta: { growth: 5, boundary: 3, ease: 4 },
        journal: '你把模糊的焦虑，换成了日历上一个具体的小约定。',
      },
    ],
  },
];

// 律师 Demo：自由输入关键词映射到 3 个工作维度，摆烂不重罚、转型/划边界给正反馈。
const customRules = [
  {
    label: '划边界',
    tone: 'growth',
    words: ['反击', '拒绝', '边界', '私下', '不熬夜', '明早', '商量', '回怼', '据理', '说清', '怼'],
    delta: { boundary: 8, ease: 3 },
  },
  {
    label: '学 AI / 转型',
    tone: 'growth',
    words: ['学', 'AI', 'ai', '课', '转型', '工具', '试试', '搜', '简历', '投递', 'legal', '产品', '转行'],
    delta: { growth: 8, ease: 3 },
  },
  {
    label: '找人聊聊',
    tone: 'bond',
    words: ['朋友', '同事', '聊', '约', '请教', '问', '带我', '沟通', '同学'],
    delta: { growth: 4, boundary: 3, ease: 3 },
  },
  {
    label: '先歇着',
    tone: 'slump',
    words: ['躺', '摆', '算了', '不想', '拖', '忍', '认了', '睡', '刷', '歇'],
    delta: { ease: 6, boundary: 2 },
  },
  {
    label: '先观望',
    tone: 'steady',
    words: ['观望', '再说', '看看', '慢慢', '以后', '存着', '半信', '了解'],
    delta: { ease: 2, growth: 2 },
  },
];

const pathLayout = [
  { x: 10, y: 51 },
  { x: 24, y: 24 },
  { x: 38, y: 68 },
  { x: 53, y: 30 },
  { x: 66, y: 58 },
  { x: 80, y: 25 },
  { x: 89, y: 54 },
  { x: 73, y: 79 },
  { x: 53, y: 84 },
  { x: 92, y: 78 },
];

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function compactText(text, maxLength = 28) {
  const clean = String(text || '').trim().replace(/\s+/g, ' ');
  if (!clean) return '';
  return clean.length > maxLength ? `${clean.slice(0, maxLength)}...` : clean;
}

function profileText(profile) {
  return Object.values(profile).join('，');
}

function hasAny(text, words) {
  return words.some((word) => text.includes(word));
}

function normalizeProfile(profile) {
  const normalized = { ...defaultProfile, ...profile };
  return Object.fromEntries(
    Object.entries(normalized).map(([key, value]) => [key, String(value || '').trim()]),
  );
}

function tuneInitialStats(baseStats, profile) {
  const text = profileText(profile);
  let delta = {};

  if (hasAny(text, ['老板', '加班', '紧急', '骂', '训', '打扰', '卷', '熬夜'])) {
    delta = mergeDeltas(delta, { boundary: -4, ease: -3 });
  }
  if (hasAny(text, ['AI', 'ai', '转型', '学', '工具', '转行', '机会', '课'])) {
    delta = mergeDeltas(delta, { growth: 6, ease: 2 });
  }
  if (hasAny(text, ['焦虑', '慌', '怕', '替代', '失业', '没经验'])) {
    delta = mergeDeltas(delta, { ease: -4 });
  }

  return applyDelta(baseStats, delta);
}

function createStartNode(persona, profile = defaultProfile, personalized = false) {
  return {
    id: 'start',
    title: personalized ? `${profile.name || persona.label}的起点` : persona.label,
    subtitle: personalized ? compactText(profile.lifeStage, 16) : '起点',
    tone: 'start',
    detail: personalized
      ? `开局画像：${compactText(profile.currentPressure, 42)}`
      : persona.scene,
    journal: personalized
      ? `你不是从空白人生开始，而是带着「${compactText(profile.goal, 34)}」和「${compactText(profile.avoidancePattern, 30)}」进入模拟。`
      : persona.scene,
  };
}

function createMove(label, description, tag, tone, delta, journal) {
  return {
    label,
    description,
    tag,
    tone,
    delta,
    journal: journal || description,
  };
}

function generatePersonalizedScenario(profile, persona) {
  const p = normalizeProfile(profile);
  const pressure = compactText(p.currentPressure, 32) || '最近那件一直压着你的事';
  const goal = compactText(p.goal, 34) || '你想保住的一件事';
  const avoidance = compactText(p.avoidancePattern, 30) || '最熟悉的逃避方式';
  const support = compactText(p.support, 30) || '一个还能联系的人';
  const money = compactText(p.moneyState, 30) || '现金和生活底盘';
  const health = compactText(p.healthState, 30) || '身体发出的提醒';
  const wish = compactText(p.hiddenWish, 34) || '那个没说出口的念头';

  const generated = [
    {
      id: 'profile-pressure',
      phase: '画像第 1 幕',
      title: `${pressure} 又在今晚冒出来`,
      body: `${p.name || '你'}本来想假装今天已经结束，但「${pressure}」没有下线。它像一个后台进程，连同「${goal}」一起占着脑子。`,
      thought: `这一次模拟会从你的真实压力开始，而不是从一段通用剧情开始。`,
      choices: [
        createMove(
          '继续把它压到明天',
          '短期能少一点痛感，但问题会带着利息回来。',
          '把压力延后',
          'slump',
          { energy: 4, career: -4, selfWorth: -7, avoidance: 10, opportunity: -6 },
          `你把「${pressure}」放回明天，今晚轻了一点，明天的选择空间窄了一点。`,
        ),
        createMove(
          '写下最小缺口',
          '不解决全部，只把最吓人的部分拆成一句话。',
          '拆出缺口',
          'steady',
          { energy: -4, career: 3, selfWorth: 8, avoidance: -8, opportunity: 5 },
          `你没有立刻变好，但第一次把「${pressure}」从一团雾拆成可以处理的一小块。`,
        ),
        createMove(
          '把压力讲给一个人听',
          '先不求建议，只让现实世界知道你卡在哪里。',
          '把话说出',
          'bond',
          { energy: -5, relationships: 8, selfWorth: 7, avoidance: -7, opportunity: 4 },
          `你把「${pressure}」说出口，关系没有替你解决问题，但它让你不再一个人硬扛。`,
        ),
      ],
    },
    {
      id: 'profile-avoidance',
      phase: '画像第 2 幕',
      title: `熟悉的逃避方式开始招手`,
      body: `你知道自己又快滑进「${avoidance}」。它不一定坏，只是每次出现得太及时，刚好挡在真正重要的事前面。`,
      thought: `摆烂不是静止，它是一条被重复练熟的路径。`,
      choices: [
        createMove(
          '照旧滑进去',
          '身体很熟练，脑子也暂时安静。',
          '旧路重走',
          'slump',
          { energy: 5, health: -4, career: -6, selfWorth: -8, avoidance: 11, opportunity: -6 },
          `你再次走向「${avoidance}」，舒服是真的，醒来后的钝痛也是真的。`,
        ),
        createMove(
          '给它一个边界',
          '允许自己休息，但设置一个能回来的出口。',
          '给逃避设闹钟',
          'steady',
          { energy: 3, health: 2, selfWorth: 6, avoidance: -5, opportunity: 3 },
          `你没有粗暴戒掉「${avoidance}」，只是给它加了一个出口，于是惯性第一次变短。`,
        ),
        createMove(
          '先做五分钟目标相关的事',
          '让行动小到无法继续争辩。',
          '五分钟目标',
          'growth',
          { energy: -3, career: 7, selfWorth: 9, avoidance: -9, opportunity: 8 },
          `你只为「${goal}」做了五分钟，但这五分钟把人生从自动播放里拽出来一点。`,
        ),
      ],
    },
    {
      id: 'profile-support',
      phase: '画像第 3 幕',
      title: `关系网络里还有一个节点`,
      body: `你的支撑不多，但「${support}」仍然在路径里。你可以继续消失，也可以用低成本的方式重新连上。`,
      thought: `人不是靠意志力活着，人靠一些还没有断掉的连接活着。`,
      choices: [
        createMove(
          '继续不回消息',
          '不用解释，也少一次被接住的可能。',
          '继续失联',
          'slump',
          { energy: 4, relationships: -11, selfWorth: -5, avoidance: 8, opportunity: -4 },
          `你把「${support}」留在未读里，世界没有责怪你，只是安静地远了一点。`,
        ),
        createMove(
          '发一句真实但很短的话',
          '不求对方马上懂，只先恢复一条线。',
          '短句求援',
          'bond',
          { energy: -3, relationships: 10, selfWorth: 7, avoidance: -7, opportunity: 4 },
          `你给「${support}」发出一句短短的真话，关系重新成为路径上的支点。`,
        ),
        createMove(
          '约一个低配见面',
          '不吃大餐不长谈，只散步或喝水。',
          '低配连接',
          'bond',
          { energy: -5, health: 4, money: -40, relationships: 12, selfWorth: 6, avoidance: -6 },
          `你把见面降到足够轻，于是「${support}」不再是压力，而是一小段能走完的路。`,
        ),
      ],
    },
    {
      id: 'profile-foundation',
      phase: '画像第 4 幕',
      title: `生活底盘发出两条提醒`,
      body: `钱的状态是「${money}」，身体的状态是「${health}」。它们不浪漫，但会决定你还能不能继续选择。`,
      thought: `底盘不稳的时候，很多理想会被迫变成噪音。`,
      choices: [
        createMove(
          '先不管，继续硬撑',
          '短期推进一点，长期把账记到身体和现金流上。',
          '硬撑底盘',
          'slump',
          { energy: -7, health: -10, money: -260, career: 2, selfWorth: -5, avoidance: 6 },
          `你继续硬撑，表面还在走，真正付费的是身体和现金流。`,
        ),
        createMove(
          '做一次底盘整理',
          '把账、睡眠、吃饭或检查先拎出来一项。',
          '整理底盘',
          'steady',
          { energy: 4, health: 8, money: 160, selfWorth: 7, avoidance: -6, opportunity: 3 },
          `你为「${money}」和「${health}」做了一次小整理，人生没有变亮，但不再继续漏水。`,
        ),
        createMove(
          '删掉一个额外消耗',
          '不是自律，是减少一个会把你拖回去的入口。',
          '减少消耗',
          'growth',
          { energy: 5, health: 4, money: 240, selfWorth: 8, avoidance: -8, opportunity: 4 },
          `你删掉一个额外消耗，省下来的不是钱或时间，而是下一次选择的余量。`,
        ),
      ],
    },
    {
      id: 'profile-goal',
      phase: '画像第 5 幕',
      title: `${goal} 出现一个很小的窗口`,
      body: `这个窗口并不宏大，也不会自动改变人生。它只是在问：你要不要把「${goal}」从愿望改成一个可交付的小动作？`,
      thought: `机会窗口通常不是大门，它更像一个今天能完成的缝。`,
      choices: [
        createMove(
          '等状态更好再开始',
          '听起来合理，但状态经常由开始之后才产生。',
          '等待状态',
          'slump',
          { energy: 2, career: -4, selfWorth: -6, avoidance: 8, opportunity: -8 },
          `你继续等一个更适合「${goal}」的自己，窗口没有关死，只是变窄了。`,
        ),
        createMove(
          '做一个可展示的小版本',
          '不追求完整，先留下能被看见的证据。',
          '做出小版本',
          'growth',
          { energy: -8, career: 12, selfWorth: 11, avoidance: -10, opportunity: 12 },
          `你把「${goal}」做成一个小版本，人生第一次有了能摆在桌面上的证据。`,
        ),
        createMove(
          '找人约一个检查点',
          '把愿望搬到日程里，减少靠意志力硬扛。',
          '约定检查点',
          'bond',
          { energy: -5, career: 5, relationships: 8, selfWorth: 8, avoidance: -9, opportunity: 8 },
          `你为「${goal}」约了一个检查点，未来不再只是脑内承诺。`,
        ),
      ],
    },
    {
      id: 'profile-hidden-wish',
      phase: '画像第 6 幕',
      title: `那个没说出口的念头浮上来`,
      body: `你心里有一句话是：「${wish}」。它不是鸡汤，也不是借口，它可能正是这条路径最真实的燃料。`,
      thought: `人会在被看见的时候恢复一点行动感。`,
      choices: [
        createMove(
          '继续假装无所谓',
          '少一点尴尬，也少一点真正被理解的机会。',
          '继续伪装',
          'mixed',
          { energy: -2, relationships: -4, selfWorth: -6, avoidance: 6, opportunity: -3 },
          `你把「${wish}」继续藏好，外面看起来没事，里面又多耗了一点电。`,
        ),
        createMove(
          '把它写进备忘录',
          '先不发给任何人，只承认它存在。',
          '承认愿望',
          'steady',
          { energy: -2, selfWorth: 9, avoidance: -6, opportunity: 4 },
          `你把「${wish}」写下来，它没有立刻变成答案，但变成了你能面对的东西。`,
        ),
        createMove(
          '让一个可信的人看见',
          '不是求拯救，是让真实的你进入关系。',
          '被看见一次',
          'bond',
          { energy: -5, relationships: 10, selfWorth: 9, avoidance: -8, opportunity: 5 },
          `你让一个人看见「${wish}」，这次不是表现正常，而是把真实带进了世界。`,
        ),
      ],
    },
  ];

  return [...generated, ...scenarioEvents.slice(6)].slice(0, MAX_TURNS + 1);
}

function completeScenario(events) {
  return [...events, ...scenarioEvents].slice(0, MAX_TURNS + 1);
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function generateScenarioWithLocalCodex(profile, persona) {
  // DeepSeek adapter contract:
  // input: { profile, persona, maxTurns: MAX_TURNS }
  // output: Array<{ id, phase, title, body, thought, choices }>
  // each choice: { label, description, tag, tone, delta, journal }
  // Vite dev server keeps DEEPSEEK_API_KEY server-side in /api/deepseek-scenario.
  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(DEEPSEEK_API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          profile,
          persona,
          maxTurns: MAX_TURNS,
          maxDeepSeekEvents: DEEPSEEK_EVENT_TARGET,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || `DeepSeek request failed: ${response.status}`);
      }

      const result = await response.json();
      if (!Array.isArray(result.events) || result.events.length < 3) {
        throw new Error('DeepSeek did not return enough valid events');
      }

      return {
        source: 'DeepSeek',
        note: `${result.model || 'deepseek'} 已生成前 ${result.events.length} 幕 AI 定制剧情`,
        events: completeScenario(result.events),
      };
    } catch (error) {
      lastError = error;
      if (String(error?.message || '').includes('DEEPSEEK_API_KEY')) break;
      if (attempt < 2) await wait(900);
    }
  }

  throw lastError || new Error('DeepSeek request failed');
}

function explainGenerationError(error) {
  const message = String(error?.message || '');
  if (message.includes('DEEPSEEK_API_KEY')) return 'DeepSeek Key 没配好；当前本地路径已经可玩。';
  if (message.includes('returned too few') || message.includes('valid events')) {
    return 'DeepSeek 这一轮返回不完整；当前本地路径已经可玩，可点重新生成再试。';
  }
  if (message.includes('Failed to fetch') || message.includes('fetch failed') || message.includes('NetworkError')) {
    return 'DeepSeek 网络暂时没通；当前本地路径已经可玩，可点重新生成再试。';
  }
  return 'DeepSeek 这一轮没有替换成功；当前本地路径已经可玩，可点重新生成再试。';
}

function applyDelta(stats, delta) {
  return Object.fromEntries(
    Object.entries(stats).map(([key, value]) => {
      const next = value + (delta[key] ?? 0);
      if (key === 'money') return [key, clamp(next, -2000, 12000)];
      return [key, clamp(next)];
    }),
  );
}

function mergeDeltas(base, next) {
  const output = { ...base };
  Object.entries(next).forEach(([key, value]) => {
    output[key] = (output[key] ?? 0) + value;
  });
  return output;
}

function capDelta(delta) {
  return Object.fromEntries(
    Object.entries(delta).map(([key, value]) => {
      const limit = key === 'money' ? 1500 : 18;
      return [key, clamp(value, -limit, limit)];
    }),
  );
}

function formatStatValue(key, value) {
  if (key === 'money') return `￥${Math.round(value).toLocaleString('zh-CN')}`;
  return Math.round(value);
}

function statProgress(key, value) {
  if (key === 'money') return clamp((value + 1500) / 95, 4, 100);
  return clamp(value, 4, 100);
}

function getCurrentInertia(stats) {
  if (stats.growth > 60 && stats.ease > 55) return '转型的路，正一点点亮起来';
  if (stats.boundary > 62) return '边界立住了，老板没那么能拿捏你了';
  if (stats.ease > 62) return '心态稳住了——最坏也不过如此';
  if (stats.growth < 30 && stats.ease < 40) return '还在原地纠结，但什么都来得及';
  return '怎么走都行，律师这碗饭也饿不着你';
}

function deriveCustomMove(rawText) {
  const text = rawText.trim();
  const matched = [];
  let delta = { ease: 3 };
  let tone = 'steady';

  customRules.forEach((rule) => {
    if (rule.words.some((word) => text.includes(word))) {
      matched.push(rule.label);
      delta = mergeDeltas(delta, rule.delta);
      tone = rule.tone;
    }
  });

  const display = text.length > 24 ? `${text.slice(0, 24)}...` : text;
  const label = `我想：${display}`;
  const description = matched.length
    ? `这一念头偏向 ${matched.slice(0, 2).join('、')}。`
    : '把模糊感受说出口，先减少一点被动。';

  return {
    label,
    description,
    tag: matched[0] ?? '说出口',
    tone,
    delta: capDelta(delta),
    journal: `你没有选择预设选项，而是把真实想法写成了这一句：「${compactText(text, 72)}」`,
  };
}

function buildForecast(stats, turnCount) {
  const raw = [
    {
      id: 'stable',
      label: '留在律所、划好边界',
      copy: '继续当律师，但老板的「紧急」被你挡在边界外，稳稳的。',
      color: '#2c8aa1',
      score: stats.boundary * 0.5 + stats.ease * 0.25 + (100 - stats.growth) * 0.1,
    },
    {
      id: 'reboot',
      label: '慢慢转型 AI',
      copy: '不是裸辞，是把 AI 技能一点点攒起来，给自己多留一条路。',
      color: '#327f68',
      score: stats.growth * 0.55 + stats.ease * 0.2 + Math.min(turnCount * 2, 12),
    },
    {
      id: 'slump',
      label: '低耗摆烂、照样过',
      copy: '少卷一点，活照干完、人没那么累——也没被开除。',
      color: '#b88a5a',
      score: stats.ease * 0.45 + (100 - stats.growth) * 0.18 + (100 - stats.boundary) * 0.12,
    },
    {
      id: 'loop',
      label: '继续纠结，但没事',
      copy: '今天想转、明天想躺，反复横跳——这碗饭照样饿不着你。',
      color: '#b48a00',
      score: 30 + (100 - Math.abs(stats.growth - 50)) * 0.16 + (stats.ease < 50 ? 12 : 4),
    },
  ].map((item) => ({ ...item, score: Math.max(1, item.score) }));

  const total = raw.reduce((sum, item) => sum + item.score, 0);
  return raw
    .map((item) => ({ ...item, percent: Math.round((item.score / total) * 100) }))
    .sort((a, b) => b.percent - a.percent);
}

function summarizeDeltas(history) {
  return history.reduce((total, entry) => mergeDeltas(total, entry.delta), {});
}

function buildEnding(stats, history, forecast) {
  const leading = forecast[0];
  const totals = summarizeDeltas(history);
  const sortedCosts = Object.entries(totals)
    .filter(([, value]) => value < 0)
    .sort((a, b) => a[1] - b[1]);
  const sortedGains = Object.entries(totals)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1]);
  const intenseTurns = [...history]
    .sort((a, b) => deltaWeight(b.delta) - deltaWeight(a.delta))
    .slice(0, 3);

  const titleMap = {
    stable: '你没升职，但把边界立住了——老板的「紧急」，再也没那么能拿捏你',
    reboot: '你没裸辞，但转型的门，已经被你推开了一条缝',
    slump: '你少卷了，活照样干完、饭照样吃——原来摆烂也没塌',
    loop: '你还在转与不转之间晃，而这恰恰说明：你哪条路都饿不着',
  };

  const summaryMap = {
    stable: '你担心的最坏——被骂、被打扰、升不上去——一个个来了又过去，你都还好好的。划清边界后，你发现律所这碗饭，端得比想象中稳。',
    reboot: '你没有靠一次裸辞赌命，只是用几个小动作把 AI 摸熟了。你这 5 年的经验不但没废，反而成了转型时别人想买的东西。',
    slump: '你松了油门，结果天没塌：活照干、客户照在、工资照发。被 AI 取代的恐慌，比真实的替代早来了好几年——而那几年，你完全可以过得松一点。',
    loop: '会想转、会想躺，太正常了。这一局最适合继续玩，因为它证明：无论 AI 怎么发展，你这个又懂法律、又开始懂 AI 的人，哪条路都走得通。',
  };

  return {
    title: titleMap[leading.id],
    summary: summaryMap[leading.id],
    leading,
    intenseTurns,
    biggestCost: sortedCosts[0],
    biggestGain: sortedGains[0],
    stats,
  };
}

function deltaWeight(delta) {
  return Object.values(delta).reduce((sum, value) => sum + Math.abs(value), 0);
}

function getStatLabel(key) {
  return statMeta.find((item) => item.key === key)?.label ?? key;
}

function App() {
  const [personaId, setPersonaId] = useState(personas[0].id);
  const persona = useMemo(
    () => personas.find((item) => item.id === personaId) ?? personas[0],
    [personaId],
  );
  const [draftProfile, setDraftProfile] = useState(defaultProfile);
  const [activeProfile, setActiveProfile] = useState(defaultProfile);
  const [isPersonalized, setIsPersonalized] = useState(false);
  const [currentEvents, setCurrentEvents] = useState(scenarioEvents);
  const [isGeneratingPath, setIsGeneratingPath] = useState(false);
  const [generationSource, setGenerationSource] = useState('预设剧情');
  const [generationNote, setGenerationNote] = useState('还没有生成个人路径');
  const [stats, setStats] = useState(() => ({ ...personas[0].stats }));
  const [turnIndex, setTurnIndex] = useState(0);
  const [history, setHistory] = useState([]);
  const [pathNodes, setPathNodes] = useState(() => [createStartNode(personas[0])]);
  const [freeText, setFreeText] = useState('');
  const [showEnding, setShowEnding] = useState(false);
  const [cohort, setCohort] = useState(null);
  const [cohortLoading, setCohortLoading] = useState(false);
  const [cohortError, setCohortError] = useState('');
  const [isProfileExpanded, setIsProfileExpanded] = useState(true);
  const generationRunRef = useRef(0);
  const cohortRunRef = useRef(0);
  const movesMadeRef = useRef(0);

  const currentEvent = currentEvents[Math.min(turnIndex, currentEvents.length - 1)];
  const movesMade = history.length;
  const isFinished = showEnding || movesMade >= MAX_TURNS;
  const forecast = useMemo(() => buildForecast(stats, movesMade), [stats, movesMade]);
  const ending = useMemo(() => buildEnding(stats, history, forecast), [stats, history, forecast]);

  async function loadCohort() {
    if (cohortLoading) return;
    const runId = cohortRunRef.current + 1;
    cohortRunRef.current = runId;
    setCohortLoading(true);
    setCohortError('');
    try {
      const data = await fetchCohort({
        profile: activeProfile,
        persona,
        stats,
        path: history.map((entry) => ({ decision: entry.decision, tag: entry.eventTitle })),
        leading: forecast[0]?.label,
      });
      if (cohortRunRef.current !== runId) return;
      setCohort(data);
    } catch (error) {
      if (cohortRunRef.current !== runId) return;
      setCohortError(explainGenerationError(error));
    } finally {
      if (cohortRunRef.current === runId) setCohortLoading(false);
    }
  }

  // 走到结局时自动召唤「同路人」，让收尾落在「一群人后来都还好」。
  useEffect(() => {
    if (isFinished && !cohort && !cohortLoading && !cohortError) {
      loadCohort();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFinished]);

  function restart(nextPersonaId = personaId, override = {}) {
    if (!override.keepPendingGeneration) {
      generationRunRef.current += 1;
      setIsGeneratingPath(false);
    }

    const nextPersona = personas.find((item) => item.id === nextPersonaId) ?? personas[0];
    const nextPersonalized = override.personalized ?? isPersonalized;
    const nextProfile = normalizeProfile(override.profile ?? activeProfile);
    const nextEvents =
      override.events ?? (nextPersonalized ? generatePersonalizedScenario(nextProfile, nextPersona) : scenarioEvents);

    movesMadeRef.current = 0;
    setPersonaId(nextPersona.id);
    setActiveProfile(nextProfile);
    setCurrentEvents(nextEvents);
    setStats(nextPersonalized ? tuneInitialStats(nextPersona.stats, nextProfile) : { ...nextPersona.stats });
    setTurnIndex(0);
    setHistory([]);
    setPathNodes([createStartNode(nextPersona, nextProfile, nextPersonalized)]);
    setFreeText('');
    setShowEnding(false);
    cohortRunRef.current += 1;
    setCohort(null);
    setCohortLoading(false);
    setCohortError('');
    setIsPersonalized(nextPersonalized);
    setGenerationSource(override.source ?? (nextPersonalized ? '本地规则' : '预设剧情'));
    setGenerationNote(override.note ?? (nextPersonalized ? '已生成个人路径' : '使用预设剧情'));
    setIsProfileExpanded(override.profileExpanded ?? !nextPersonalized);
  }

  function generateProfilePath() {
    const nextProfile = normalizeProfile(draftProfile);
    const runId = generationRunRef.current + 1;
    const localEvents = generatePersonalizedScenario(nextProfile, persona);

    generationRunRef.current = runId;
    setIsGeneratingPath(true);
    restart(persona.id, {
      events: localEvents,
      profile: nextProfile,
      personalized: true,
      source: '本地预览',
      note: '已先生成可玩的个人路径；DeepSeek 正在后台优化，回来后会自动替换。',
      keepPendingGeneration: true,
      profileExpanded: false,
    });

    generateScenarioWithLocalCodex(nextProfile, persona)
      .then((result) => {
        if (generationRunRef.current !== runId) return;

        if (movesMadeRef.current === 0) {
          restart(persona.id, {
            events: result.events,
            profile: nextProfile,
            personalized: true,
            source: 'DeepSeek 已完成',
            note: `${result.note}，现在可以开始选择。`,
            keepPendingGeneration: true,
            profileExpanded: false,
          });
          return;
        }

        setGenerationSource('DeepSeek 已完成');
        setGenerationNote(`${result.note}；你已经开始走当前路径，本轮不打断。再次生成可刷新成 AI 版本。`);
      })
      .catch((error) => {
        if (generationRunRef.current !== runId) return;
        setGenerationSource('本地预览');
        setGenerationNote(explainGenerationError(error));
      })
      .finally(() => {
        if (generationRunRef.current === runId) setIsGeneratingPath(false);
      });
  }

  function applyMove(move, source = 'choice') {
    if (isFinished) return;

    const nextStats = applyDelta(stats, move.delta);
    const entry = {
      id: `${currentEvent.id}-${movesMade + 1}`,
      eventTitle: currentEvent.title,
      decision: move.label,
      note: move.description,
      delta: move.delta,
      tone: move.tone,
      source,
      journal: move.journal ?? move.description,
    };
    const node = {
      id: `node-${movesMade + 1}`,
      title: move.tag,
      subtitle: `第 ${movesMade + 1} 步 · ${currentEvent.phase}`,
      tone: move.tone,
      detail: move.description,
      journal:
        move.journal ??
        `${compactText(currentEvent.title, 24)}：${compactText(move.description, 58)}`,
      decision: move.label,
    };

    const nextHistory = [...history, entry];
    const nextNodes = [...pathNodes, node];

    movesMadeRef.current = nextHistory.length;
    setStats(nextStats);
    setHistory(nextHistory);
    setPathNodes(nextNodes);
    setTurnIndex((index) => Math.min(index + 1, currentEvents.length - 1));
    setFreeText('');

    if (nextHistory.length >= MAX_TURNS) {
      setShowEnding(true);
    }
  }

  function submitFreeText() {
    const text = freeText.trim();
    if (!text) return;
    applyMove(deriveCustomMove(text), 'custom');
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Sparkles size={18} aria-hidden="true" />
          </span>
          <div>
            <h1>开摆之后 <span className="brand-badge">MVP</span></h1>
            <p>最坏也不过如此 · 人生路径沙盘</p>
          </div>
        </div>
        <div className="topbar-actions">
          <span className="round-chip">
            <Clock size={16} aria-hidden="true" />
            {movesMade}/{MAX_TURNS}
          </span>
          <button
            className="icon-button"
            type="button"
            title="重开"
            aria-label="重开"
            onClick={() => restart()}
          >
            <RotateCcw size={18} aria-hidden="true" />
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={movesMade < 3}
            onClick={() => setShowEnding(true)}
          >
            <CheckCircle2 size={18} aria-hidden="true" />
            结算
          </button>
        </div>
      </header>

      <ProfileSetupPanel
        profile={draftProfile}
        activeProfile={activeProfile}
        isPersonalized={isPersonalized}
        isGenerating={isGeneratingPath}
        generationSource={generationSource}
        generationNote={generationNote}
        isExpanded={isProfileExpanded}
        onChange={setDraftProfile}
        onGenerate={generateProfilePath}
        onToggleExpanded={() => setIsProfileExpanded((current) => !current)}
        onResetSample={() => {
          setDraftProfile(defaultProfile);
          setIsProfileExpanded(true);
        }}
      />

      <section className="persona-strip" aria-label="人设选择">
        {personas.map((item) => (
          <button
            key={item.id}
            className={item.id === personaId ? 'persona-option active' : 'persona-option'}
            type="button"
            onClick={() => restart(item.id)}
          >
            <span>{item.label}</span>
            <small>{item.title}</small>
          </button>
        ))}
      </section>

      <div className="workspace-grid">
        <LedgerPanel
          stats={stats}
          persona={persona}
          history={history}
          profile={activeProfile}
          isPersonalized={isPersonalized}
        />
        <PathSandbox
          nodes={pathNodes}
          currentEvent={currentEvent}
          movesMade={movesMade}
          stats={stats}
          isFinished={isFinished}
        />
        <DecisionPanel
          event={currentEvent}
          freeText={freeText}
          setFreeText={setFreeText}
          submitFreeText={submitFreeText}
          applyMove={applyMove}
          isFinished={isFinished}
          ending={ending}
          restart={restart}
        />
      </div>

      {isFinished ? (
        <EndingReport ending={ending} history={history} restart={restart} />
      ) : (
        <ForecastPanel forecast={forecast} inertia={getCurrentInertia(stats)} />
      )}

      {isFinished && (
        <CohortPanel
          cohort={cohort}
          loading={cohortLoading}
          error={cohortError}
          onLoad={loadCohort}
          movesMade={movesMade}
        />
      )}
    </main>
  );
}

function ProfileSetupPanel({
  profile,
  activeProfile,
  isPersonalized,
  isGenerating,
  generationSource,
  generationNote,
  isExpanded,
  onChange,
  onGenerate,
  onToggleExpanded,
  onResetSample,
}) {
  const modelChipClass = [
    'model-chip',
    isGenerating ? 'loading' : '',
    generationSource.includes('DeepSeek') ? 'deepseek' : '',
    generationSource.includes('本地') ? 'local' : '',
  ]
    .filter(Boolean)
    .join(' ');

  function updateField(key, value) {
    onChange((current) => ({ ...current, [key]: value }));
  }

  return (
    <section className={isPersonalized ? 'panel profile-panel personalized' : 'panel profile-panel'} aria-label="人生画像输入">
      <div className="panel-heading profile-heading">
        <span className="heading-icon">
          <MessageCircle size={18} aria-hidden="true" />
        </span>
        <div>
          <h2>先写下你的人生底稿</h2>
          <p>{isPersonalized ? `${activeProfile.name || '你'}的路径已生效` : '默认样例已填好，可以直接生成'}</p>
        </div>
        <span className={modelChipClass}>{generationSource}</span>
      </div>

      {isPersonalized && !isExpanded ? (
        <div className="profile-brief">
          <span>{activeProfile.name || '你'} · {activeProfile.age || '未知年龄'} · {activeProfile.city || '未知城市'}</span>
          <strong>{compactText(activeProfile.goal, 54)}</strong>
          <p>{compactText(activeProfile.currentPressure, 78)}</p>
        </div>
      ) : (
        <div className="profile-grid">
          <label className="profile-field compact-field">
            <span>名字</span>
            <input
              value={profile.name}
              onChange={(event) => updateField('name', event.target.value)}
              placeholder="小林"
            />
          </label>
          <label className="profile-field compact-field">
            <span>年龄</span>
            <input
              value={profile.age}
              onChange={(event) => updateField('age', event.target.value)}
              placeholder="24"
            />
          </label>
          <label className="profile-field compact-field">
            <span>城市</span>
            <input
              value={profile.city}
              onChange={(event) => updateField('city', event.target.value)}
              placeholder="杭州"
            />
          </label>

          {profileFields.map((field) => (
            <label className="profile-field" key={field.key}>
              <span>{field.label}</span>
              <textarea
                value={profile[field.key]}
                onChange={(event) => updateField(field.key, event.target.value)}
                placeholder={field.placeholder}
                rows={2}
              />
            </label>
          ))}
        </div>
      )}

      <div className="profile-actions">
        <p className="generation-note">{generationNote}</p>
        {isPersonalized && (
          <button className="secondary-button compact" type="button" onClick={onToggleExpanded}>
            <MessageCircle size={17} aria-hidden="true" />
            {isExpanded ? '收起底稿' : '编辑底稿'}
          </button>
        )}
        <button className="secondary-button compact" type="button" onClick={onResetSample}>
          <RotateCcw size={17} aria-hidden="true" />
          恢复样例
        </button>
        <button className="primary-button" type="button" disabled={isGenerating} onClick={onGenerate}>
          <Sparkles size={18} aria-hidden="true" />
          {isGenerating ? 'AI优化中' : isPersonalized ? '重新生成' : '生成我的路径'}
        </button>
      </div>
    </section>
  );
}

function LedgerPanel({ stats, persona, history, profile, isPersonalized }) {
  const recent = history.slice(-4).reverse();

  return (
    <aside className="panel ledger-panel">
      <div className="panel-heading">
        <span className="heading-icon">
          <Activity size={18} aria-hidden="true" />
        </span>
        <div>
          <h2>状态账本</h2>
          <p>{persona.title}</p>
        </div>
      </div>
      <p className="persona-scene">{persona.scene}</p>

      {isPersonalized && (
        <div className="profile-summary">
          <h3>画像摘要</h3>
          <p>{profile.name || '你'} · {profile.age || '未知年龄'} · {profile.city || '未知城市'}</p>
          <span>目标：{compactText(profile.goal, 34)}</span>
          <span>逃避：{compactText(profile.avoidancePattern, 34)}</span>
        </div>
      )}

      <div className="stat-list">
        {statMeta.map((meta) => (
          <StatRow key={meta.key} meta={meta} value={stats[meta.key]} />
        ))}
      </div>

      <div className="recent-log">
        <h3>最近路径</h3>
        {recent.length === 0 ? (
          <p className="empty-note">还没有做出第一步。</p>
        ) : (
          recent.map((entry) => (
            <div className={`log-row ${entry.tone}`} key={entry.id}>
              <strong>{entry.decision}</strong>
              <span>{entry.eventTitle}</span>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

function StatRow({ meta, value }) {
  const Icon = meta.icon;
  // 反焦虑改版：不再用红色告警制造紧张，数值低也只是「现在这样」，没什么可怕。
  const danger = false;

  return (
    <div className={danger ? 'stat-row danger' : 'stat-row'} style={{ '--accent': meta.color }}>
      <div className="stat-topline">
        <span>
          <Icon size={16} aria-hidden="true" />
          {meta.label}
        </span>
        <strong>{formatStatValue(meta.key, value)}</strong>
      </div>
      <div className="stat-track" aria-hidden="true">
        <span style={{ width: `${statProgress(meta.key, value)}%` }} />
      </div>
    </div>
  );
}

function PathSandbox({ nodes, currentEvent, movesMade, stats, isFinished }) {
  const positionedNodes = nodes.map((node, index) => ({
    ...node,
    index,
    ...pathLayout[Math.min(index, pathLayout.length - 1)],
  }));
  const currentNode = positionedNodes[positionedNodes.length - 1];
  const nextHint = pathLayout[Math.min(positionedNodes.length, pathLayout.length - 1)];

  return (
    <section className="panel map-panel">
      <div className="panel-heading map-heading">
        <span className="heading-icon">
          <MapIcon size={18} aria-hidden="true" />
        </span>
        <div>
          <h2>路径沙盘</h2>
          <p>{getCurrentInertia(stats)}</p>
        </div>
      </div>

      <div className="map-stage">
        <svg className="path-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {positionedNodes.slice(1).map((node, index) => {
            const previous = positionedNodes[index];
            return (
              <line
                key={node.id}
                x1={previous.x}
                y1={previous.y}
                x2={node.x}
                y2={node.y}
              />
            );
          })}
          {!isFinished && currentNode && (
            <line
              className="ghost-line"
              x1={currentNode.x}
              y1={currentNode.y}
              x2={nextHint.x}
              y2={nextHint.y}
            />
          )}
        </svg>

        {positionedNodes.map((node) => (
          <button
            key={node.id}
            className={`path-node ${node.tone} ${node.index === positionedNodes.length - 1 ? 'current' : ''}`}
            type="button"
            title={node.journal || node.detail}
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
          >
            <span>{node.index === 0 ? '始' : node.index}</span>
            <div>
              <strong>{node.title}</strong>
              <small>{node.subtitle}</small>
              {node.decision && <em>{compactText(node.decision, 22)}</em>}
            </div>
            <p>{node.journal || node.detail}</p>
          </button>
        ))}

        {!isFinished && (
          <div className="next-event-pin" style={{ left: `${nextHint.x}%`, top: `${nextHint.y}%` }}>
            <Zap size={16} aria-hidden="true" />
            <span>{currentEvent.phase}</span>
          </div>
        )}
      </div>

      <div className="map-readout">
        <span>当前节点</span>
        <strong>{currentNode?.title ?? '起点'}</strong>
        <em>
          {movesMade === 0
            ? currentNode?.journal ?? '第一步还没落下'
            : currentNode?.journal ?? `已经留下 ${movesMade} 次选择痕迹`}
        </em>
      </div>
    </section>
  );
}

function DecisionPanel({
  event,
  freeText,
  setFreeText,
  submitFreeText,
  applyMove,
  isFinished,
  ending,
  restart,
}) {
  if (isFinished) {
    return (
      <aside className="panel decision-panel final-side">
        <div className="panel-heading">
          <span className="heading-icon">
            <CheckCircle2 size={18} aria-hidden="true" />
          </span>
          <div>
            <h2>本轮结果</h2>
            <p>{ending.leading.label} · {ending.leading.percent}%</p>
          </div>
        </div>
        <p className="final-side-copy">{ending.summary}</p>
        <button className="primary-button full" type="button" onClick={() => restart()}>
          <RotateCcw size={18} aria-hidden="true" />
          再开一局
        </button>
      </aside>
    );
  }

  return (
    <aside className="panel decision-panel">
      <div className="event-meta">
        <Clock size={16} aria-hidden="true" />
        <span>{event.phase}</span>
      </div>
      <h2>{event.title}</h2>
      <p className="event-body">{event.body}</p>
      <blockquote>{event.thought}</blockquote>

      <div className="choice-list">
        {event.choices.map((choice) => (
          <button
            className={`choice-button ${choice.tone}`}
            type="button"
            key={choice.label}
            onClick={() => applyMove(choice)}
          >
            <span className="choice-copy">
              <strong>{choice.label}</strong>
              <small>{choice.description}</small>
            </span>
            <ImpactPills delta={choice.delta} />
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        ))}
      </div>

      <div className="free-input">
        <label htmlFor="free-thought">
          <MessageCircle size={16} aria-hidden="true" />
          真实想法
        </label>
        <textarea
          id="free-thought"
          value={freeText}
          onChange={(event) => setFreeText(event.target.value)}
          placeholder="比如：我想先睡一觉，明天只做一件小事"
          rows={4}
        />
        <button
          className="secondary-button"
          type="button"
          disabled={!freeText.trim()}
          onClick={submitFreeText}
        >
          <Send size={17} aria-hidden="true" />
          送入这一回合
        </button>
      </div>
    </aside>
  );
}

function ImpactPills({ delta }) {
  const entries = Object.entries(delta)
    .filter(([, value]) => value !== 0)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 3);

  return (
    <span className="impact-pills" aria-label="状态影响">
      {entries.map(([key, value]) => (
        <span className={value > 0 ? 'delta-pill up' : 'delta-pill down'} key={key}>
          {getStatLabel(key)}
          {key === 'money'
            ? `${value > 0 ? '+' : ''}${value}`
            : `${value > 0 ? '+' : ''}${value}`}
        </span>
      ))}
    </span>
  );
}

function ForecastPanel({ forecast, inertia }) {
  return (
    <section className="panel forecast-panel">
      <div className="panel-heading">
        <span className="heading-icon">
          <TrendingUp size={18} aria-hidden="true" />
        </span>
        <div>
          <h2>人生结果预测</h2>
          <p>{inertia}</p>
        </div>
      </div>
      <div className="forecast-list">
        {forecast.map((item) => (
          <div className="forecast-item" key={item.id} style={{ '--accent': item.color }}>
            <div>
              <strong>{item.label}</strong>
              <span>{item.copy}</span>
            </div>
            <b>{item.percent}%</b>
            <i aria-hidden="true">
              <span style={{ width: `${item.percent}%` }} />
            </i>
          </div>
        ))}
      </div>
    </section>
  );
}

function CohortPanel({ cohort, loading, error, onLoad, movesMade }) {
  return (
    <section className="panel cohort-panel">
      <div className="panel-heading">
        <span className="heading-icon">
          <Users size={18} aria-hidden="true" />
        </span>
        <div>
          <h2>同路人 · 真实预测</h2>
          <p>走到这一步的人，后来都怎么样了</p>
        </div>
      </div>

      {!cohort && !loading && (
        <div className="cohort-cta">
          <p>
            {movesMade === 0
              ? '先走几步，我帮你找几个有相似经历、却走了不同路的人，看看他们后来过得怎样。'
              : '找几个和你处境相似、却走了不同路的人，看看他们几年后过得怎样——多半没那么糟。'}
          </p>
          <button className="primary-button" type="button" onClick={onLoad}>
            <Sparkles size={18} aria-hidden="true" />
            看看同路人后来怎么样了
          </button>
          {error && <p className="cohort-error">{error}</p>}
        </div>
      )}

      {loading && (
        <div className="cohort-cta">
          <p className="cohort-loading">正在翻找和你走过相似路的人…</p>
        </div>
      )}

      {cohort && (
        <>
          <div className="cohort-list">
            {cohort.cohort.map((person, index) => (
              <div className="cohort-card" key={index}>
                <strong>{person.who}</strong>
                <span className="cohort-similar">当年 · {person.similar}</span>
                <span className="cohort-now">后来 · {person.now}</span>
              </div>
            ))}
          </div>
          <div className="cohort-prediction">
            <h3>给你的真实预测</h3>
            <p>{cohort.prediction}</p>
            {cohort.reassurance && <p className="cohort-reassure">🛟 {cohort.reassurance}</p>}
          </div>
          <button className="secondary-button" type="button" onClick={onLoad} disabled={loading}>
            <RotateCcw size={16} aria-hidden="true" />
            换一批同路人
          </button>
          {error && <p className="cohort-error">{error}</p>}
        </>
      )}
    </section>
  );
}

function EndingReport({ ending, history, restart }) {
  const pathText = history.map((entry) => entry.decision.replace('我想：', '')).join(' / ');

  return (
    <section className="panel ending-panel">
      <div className="ending-title">
        <span className="heading-icon">
          <CheckCircle2 size={20} aria-hidden="true" />
        </span>
        <div>
          <p>最终路径</p>
          <h2>{ending.title}</h2>
        </div>
      </div>
      <p className="ending-summary">{ending.summary}</p>

      <div className="ending-grid">
        <div className="ending-block">
          <h3>关键拐点</h3>
          <ol>
            {ending.intenseTurns.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.decision}</strong>
                <span>{entry.journal ?? entry.note}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="ending-block">
          <h3>状态结算</h3>
          <div className="settlement-row">
            <span>最大收益</span>
            <strong>
              {ending.biggestGain ? `${getStatLabel(ending.biggestGain[0])} +${ending.biggestGain[1]}` : '没有明显收益'}
            </strong>
          </div>
          <div className="settlement-row">
            <span>最大代价</span>
            <strong>
              {ending.biggestCost ? `${getStatLabel(ending.biggestCost[0])} ${ending.biggestCost[1]}` : '没有明显代价'}
            </strong>
          </div>
          <div className="settlement-row">
            <span>主导结局</span>
            <strong>{ending.leading.label} {ending.leading.percent}%</strong>
          </div>
        </div>

        <div className="ending-block path-sentence">
          <h3>你走过的路</h3>
          <p>{pathText || '还没有路径。'}</p>
        </div>
      </div>

      <button className="primary-button" type="button" onClick={() => restart()}>
        <RotateCcw size={18} aria-hidden="true" />
        重开一条路径
      </button>
    </section>
  );
}

export default App;
