import React, { useMemo, useRef, useState } from 'react';
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

const MAX_TURNS = 8;
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

const personas = [
  {
    id: 'office',
    label: '上班第2年',
    title: '刚毕业两年的职场人',
    scene: '工资够活，热情不够用，周末总在补觉和自责之间切换。',
    stats: {
      energy: 46,
      health: 68,
      money: 3200,
      career: 50,
      relationships: 55,
      selfWorth: 48,
      avoidance: 64,
      opportunity: 43,
    },
  },
  {
    id: 'freelance',
    label: '自由职业',
    title: '接单不稳定的自由职业者',
    scene: '时间看起来很多，现金流像天气，最大的敌人是没有边界的一天。',
    stats: {
      energy: 52,
      health: 61,
      money: 2100,
      career: 44,
      relationships: 48,
      selfWorth: 54,
      avoidance: 58,
      opportunity: 61,
    },
  },
  {
    id: 'exam',
    label: '考研边缘',
    title: '在备考和找工作之间摇摆的人',
    scene: '计划表很满，执行很薄，最常见的安慰是明天一定开始。',
    stats: {
      energy: 42,
      health: 57,
      money: 1500,
      career: 35,
      relationships: 51,
      selfWorth: 43,
      avoidance: 71,
      opportunity: 49,
    },
  },
];

// 反焦虑改版：数值语义全部正向化，不再有「越高越糟」的惩罚式指标。
const statMeta = [
  { key: 'energy', label: '精力', icon: Battery, color: '#3d6fd8' },
  { key: 'health', label: '健康', icon: Heart, color: '#d95f4f' },
  { key: 'money', label: '现金', icon: Wallet, color: '#b77a13' },
  { key: 'career', label: '做事手感', icon: Briefcase, color: '#327f68' },
  { key: 'relationships', label: '关系', icon: Users, color: '#7b5ab6' },
  { key: 'selfWorth', label: '自我接纳', icon: Shield, color: '#2c8aa1' },
  { key: 'avoidance', label: '松弛度', icon: Heart, color: '#6f9b6a' },
  { key: 'opportunity', label: '可能性', icon: Sparkles, color: '#b48a00' },
];

const defaultProfile = {
  name: '小林',
  age: '24',
  city: '杭州',
  lifeStage: '上班第二年，想换方向但还没有作品和底气。',
  currentPressure: '房租、早会、项目卡住、父母问近况时不知道怎么回答。',
  goal: '三个月内做出一个能展示能力的小作品，同时把睡眠和现金流稳住。',
  avoidancePattern: '一焦虑就刷短视频、熬夜、把重要消息拖到最后才回。',
  support: '有一个愿意散步聊天的朋友，但最近联系变少了。',
  moneyState: '现金够撑一个月，但没有安全垫，看到分期广告会心动。',
  healthState: '肩颈紧、睡眠晚、周末经常补觉。',
  hiddenWish: '希望别人别只觉得我懒，而是看见我其实卡住了。',
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
    id: 'rent',
    phase: '第 1 晚',
    title: '房租提醒在 23:48 弹出来',
    body: '你本来只想刷十分钟，结果外卖盒还没扔，明早的会也没准备。手机屏幕上躺着房租提醒和几条没读的工作群消息。',
    thought: '账单不会因为你今晚没看就翻倍。它会安安静静地等你，明天再处理也完全来得及。',
    choices: [
      {
        label: '继续刷，等困意盖过去',
        description: '今晚先放过自己，账单明天还在那儿，跑不掉也不会变大。',
        tag: '今晚先歇',
        tone: 'slump',
        delta: { energy: 6, health: 1, selfWorth: -1, avoidance: 5 },
      },
      {
        label: '只做十分钟账本',
        description: '不解决人生，只是看一眼缺口——通常没你想的多。',
        tag: '看一眼缺口',
        tone: 'steady',
        delta: { energy: -3, money: 120, career: 2, selfWorth: 6, avoidance: -4, opportunity: 3 },
      },
      {
        label: '找朋友借一点周转',
        description: '开口有点难，但朋友大多比你想的更愿意搭把手。',
        tag: '求助一次',
        tone: 'bond',
        delta: { energy: -2, money: 900, relationships: 7, selfWorth: 3, avoidance: -3, opportunity: 2 },
      },
    ],
  },
  {
    id: 'meeting',
    phase: '第 2 天',
    title: '早会轮到你同步进度',
    body: '项目其实卡住三天了。你可以继续说快好了，也可以承认卡点，或者把它先放一放。',
    thought: '一次说得不漂亮，没人会因此记你一辈子。做事手感掉了还能补，谁都有卡住的时候。',
    choices: [
      {
        label: '说快好了，先过关',
        description: '会议平稳过去。这点小拖延，没人会真的揪着不放。',
        tag: '先稳住',
        tone: 'slump',
        delta: { energy: -1, career: -2, selfWorth: -1, avoidance: 5 },
      },
      {
        label: '说清卡点和下一步',
        description: '不用显得完美，说出来别人反而能搭把手。',
        tag: '说出卡点',
        tone: 'growth',
        delta: { energy: -5, career: 8, relationships: 4, selfWorth: 7, avoidance: -6, opportunity: 6 },
      },
      {
        label: '先把它放一放',
        description: '今天没力气就先搁着，卡点不会因为你不提就恶化。',
        tag: '暂时搁置',
        tone: 'slump',
        delta: { energy: 3, career: -2, selfWorth: -1, avoidance: 5 },
      },
    ],
  },
  {
    id: 'friend',
    phase: '第 3 晚',
    title: '朋友约你吃饭，说你最近像消失了',
    body: '你知道见面会好一点，但也知道出门、花钱、解释近况都很累。聊天框停在“今晚有空吗”。',
    thought: '真朋友不会因为你消失一阵就走掉。等你有力气了再回，关系还在那儿。',
    choices: [
      {
        label: '今晚先不回，攒攒电',
        description: '一个人待着也没什么不对。等想见了再约，来得及。',
        tag: '先攒攒电',
        tone: 'slump',
        delta: { energy: 5, relationships: -2, selfWorth: 0, avoidance: 5 },
      },
      {
        label: '坦白说状态差，改成散步',
        description: '降低社交成本，也把自己从房间里捞出来一会儿。',
        tag: '低配见面',
        tone: 'bond',
        delta: { energy: -1, health: 5, money: -20, relationships: 10, selfWorth: 6, avoidance: -5, opportunity: 3 },
      },
      {
        label: '正常去吃一顿',
        description: '热闹是真的，累也是真的——开心了就值。',
        tag: '出门热闹',
        tone: 'mixed',
        delta: { energy: -6, health: -1, money: -160, relationships: 7, selfWorth: 3 },
      },
    ],
  },
  {
    id: 'course',
    phase: '第 4 天',
    title: '买了半年的课程还停在第一章',
    body: '平台发来“学习提醒”。你清楚自己不是没能力，只是每次打开都觉得落下太多。',
    thought: '一门没学完的课，不代表什么。它会一直在那儿等你，想学了随时能从第二章开始。',
    choices: [
      {
        label: '把提醒关掉',
        description: '眼不见心不烦。课还在，哪天想学再打开就是了。',
        tag: '关掉提醒',
        tone: 'slump',
        delta: { energy: 3, career: -1, selfWorth: 0, avoidance: 5 },
      },
      {
        label: '只学二十分钟',
        description: '进度很小，但「重新开始」其实没那么难。',
        tag: '二十分钟',
        tone: 'growth',
        delta: { energy: -4, career: 6, selfWorth: 8, avoidance: -7, opportunity: 6 },
      },
      {
        label: '把课程卖给别人',
        description: '换回点钱，也大方承认这条路暂时不适合自己。',
        tag: '潇洒止损',
        tone: 'steady',
        delta: { money: 420, selfWorth: 5, avoidance: -2 },
      },
    ],
  },
  {
    id: 'family',
    phase: '第 5 晚',
    title: '家里电话问你最近怎么样',
    body: '你下意识想说都挺好。你也知道，一直“都挺好”有点累，但今晚未必有力气解释。',
    thought: '报喜不报忧不是错，那是你在保护自己。哪天想说了，家其实一直都在。',
    choices: [
      {
        label: '报喜不报忧',
        description: '今晚不想解释就别解释，没人规定一定要全摊开。',
        tag: '都挺好',
        tone: 'slump',
        delta: { energy: -1, relationships: -1, selfWorth: 0, avoidance: 4 },
      },
      {
        label: '讲一半真实情况',
        description: '不全摊开，但让亲近的人知道一点，心里会松些。',
        tag: '讲一半真话',
        tone: 'bond',
        delta: { energy: -3, relationships: 8, selfWorth: 7, avoidance: -5, opportunity: 2 },
      },
      {
        label: '聊聊天气就好',
        description: '气氛轻松也挺好，不是每通电话都得解决问题。',
        tag: '随便聊聊',
        tone: 'mixed',
        delta: { energy: 2, relationships: 1, selfWorth: 0, avoidance: 3 },
      },
    ],
  },
  {
    id: 'review',
    phase: '第 6 天',
    title: '绩效谈话提前了两周',
    body: '主管让你准备这季度贡献。脑子先跳出一排没做完的事，然后才想起其实也有几件做成了。',
    thought: '绩效再差也不过是这一档的事，天塌不下来。而且你做成的，比你记得的多。',
    choices: [
      {
        label: '临场发挥',
        description: '随便聊聊也能过去，结果通常没想象中糟。',
        tag: '轻装上桌',
        tone: 'mixed',
        delta: { energy: -2, career: -2, selfWorth: -1, avoidance: 3 },
      },
      {
        label: '整理三条证据',
        description: '不用包装成精英，只把做过的事拿回来给自己看。',
        tag: '拿回证据',
        tone: 'growth',
        delta: { energy: -6, career: 10, selfWorth: 9, avoidance: -6, opportunity: 8 },
      },
      {
        label: '请半天假缓一缓',
        description: '没状态就先歇半天，谈话改期也不是什么大事。',
        tag: '缓一缓',
        tone: 'slump',
        delta: { energy: 6, health: 2, career: -2, selfWorth: 0, avoidance: 5 },
      },
    ],
  },
  {
    id: 'body',
    phase: '第 7 周',
    title: '身体开始用疲惫发通知',
    body: '肩颈、胃、睡眠都有点不对劲。它们不是突然坏掉的，只是想提醒你慢一点。',
    thought: '身体发出的不是警报，是邀请你歇会儿。它很皮实，你善待它一点它就回来了。',
    choices: [
      {
        label: '先躺平休息几天',
        description: '什么都不干、好好睡——这正是身体现在最想要的。',
        tag: '躺平回血',
        tone: 'slump',
        delta: { energy: 8, health: 6, career: -1, selfWorth: 1, avoidance: 5 },
      },
      {
        label: '请半天假去检查',
        description: '花点钱看一眼，多半没事，换回不少安心。',
        tag: '检查一下',
        tone: 'steady',
        delta: { energy: 5, health: 9, money: -220, selfWorth: 6, avoidance: -3, opportunity: 2 },
      },
      {
        label: '每天先走二十分钟',
        description: '不宏大，但身体听得懂，也最容易坚持。',
        tag: '出门走走',
        tone: 'growth',
        delta: { energy: 4, health: 8, selfWorth: 6, avoidance: -3, opportunity: 2 },
      },
    ],
  },
  {
    id: 'side-project',
    phase: '第 8 周',
    title: '一个旧同学问你要不要一起做小项目',
    body: '你一边心动，一边担心自己又三分钟热度。对方要的不是承诺改变世界，只是今晚先对一下方向。',
    thought: '机会从来不止一班车。这次没接住也没关系，下一个还会来，你随时能上车。',
    choices: [
      {
        label: '说最近想歇着，先放着',
        description: '不勉强自己开新坑，也是一种清醒的选择。',
        tag: '先不接',
        tone: 'slump',
        delta: { energy: 3, selfWorth: 1, avoidance: 5, opportunity: -3 },
      },
      {
        label: '约三十分钟电话',
        description: '不装很厉害，只是先聊聊能不能开始，零压力。',
        tag: '先通电话',
        tone: 'growth',
        delta: { energy: -5, career: 7, relationships: 6, selfWorth: 8, avoidance: -6, opportunity: 10 },
      },
      {
        label: '一口答应全包',
        description: '热情上头，记得给自己留点回血的空间就好。',
        tag: '一腔热血',
        tone: 'mixed',
        delta: { energy: -10, health: -3, career: 6, relationships: 2, selfWorth: 4, opportunity: 8 },
      },
    ],
  },
  {
    id: 'loan',
    phase: '第 9 周',
    title: '一件想买的东西，正好在你最累时出现',
    body: '它确实能让你开心一阵，也会让下个月账户紧一点。页面只差一次指纹确认。',
    thought: '想要点东西犒劳自己，太正常了。买了也不会破产，缓缓再决定也完全没问题。',
    choices: [
      {
        label: '直接买，先开心',
        description: '偶尔哄哄自己没什么，这点钱不会动摇你的底盘。',
        tag: '犒劳一下',
        tone: 'slump',
        delta: { energy: 5, money: -480, selfWorth: 2, avoidance: 4 },
      },
      {
        label: '放入 72 小时清单',
        description: '不禁止自己想要，只是让冲动先降降温。',
        tag: '缓三天',
        tone: 'steady',
        delta: { energy: -1, money: 120, selfWorth: 7, avoidance: -4, opportunity: 2 },
      },
      {
        label: '把钱转进房租账户',
        description: '不浪漫，但让生活更稳，心里更踏实。',
        tag: '保住底盘',
        tone: 'growth',
        delta: { energy: -3, money: 260, selfWorth: 7, avoidance: -4, opportunity: 2 },
      },
    ],
  },
  {
    id: 'morning',
    phase: '第 10 周',
    title: '一个普通早晨，你发现也没什么大事发生',
    body: '没有电影配乐，没有巨大转折。摆烂了这一阵，天没塌，你还好好的——日子原来这么禁得起折腾。',
    thought: '回头看，你担心的那些最坏情况，几乎没一个真的发生。想动的时候，从一件小事开始就够了。',
    choices: [
      {
        label: '列三件今天能完成的小事',
        description: '不用翻身，只是先把身体轻轻转向出口。',
        tag: '小事开局',
        tone: 'growth',
        delta: { energy: -2, career: 6, health: 3, selfWorth: 9, avoidance: -7, opportunity: 6 },
      },
      {
        label: '再多歇一阵也行',
        description: '休息够了自然会想动，不必逼自己赶哪个进度。',
        tag: '继续歇着',
        tone: 'slump',
        delta: { energy: 4, health: 2, selfWorth: 1, avoidance: 5 },
      },
      {
        label: '找人约一个轻松的节点',
        description: '把“想动一动”从脑内搬到日程，有人陪着更轻松。',
        tag: '约个节点',
        tone: 'bond',
        delta: { energy: -3, relationships: 8, career: 4, selfWorth: 8, avoidance: -6, opportunity: 6 },
      },
    ],
  },
];

// 反焦虑改版：摆烂关键词不再重罚，反而承认它的休息价值；其它规则保持温和正向。
const customRules = [
  {
    label: '动一动',
    tone: 'growth',
    words: ['学习', '写', '计划', '简历', '作品', '投递', '复盘', '开始', '整理', '行动'],
    delta: { energy: -4, career: 6, selfWorth: 8, avoidance: -6, opportunity: 6 },
  },
  {
    label: '找人靠一靠',
    tone: 'bond',
    words: ['朋友', '家人', '沟通', '聊聊', '求助', '坦白', '约', '一起', '告诉'],
    delta: { energy: -2, relationships: 8, selfWorth: 6, avoidance: -5, opportunity: 3 },
  },
  {
    label: '善待身体',
    tone: 'steady',
    words: ['睡', '休息', '运动', '散步', '跑步', '吃饭', '做饭', '医生', '医院', '检查'],
    delta: { energy: 6, health: 8, selfWorth: 4, avoidance: -2, opportunity: 2 },
  },
  {
    label: '歇一会儿',
    tone: 'slump',
    words: ['摆', '躺', '算了', '不想', '拖', '明天', '逃', '刷', '游戏', '随便'],
    delta: { energy: 6, health: 2, selfWorth: 1, avoidance: 5 },
  },
  {
    label: '花点钱',
    tone: 'mixed',
    words: ['辞职', '裸辞', '贷款', '借钱', '分期', '买', '花钱', '外卖'],
    delta: { energy: 3, money: -260, selfWorth: 1, avoidance: 2 },
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

  if (hasAny(text, ['房租', '负债', '贷款', '分期', '月光', '没钱', '现金', '还款'])) {
    delta = mergeDeltas(delta, { money: -680, energy: -4, avoidance: 5, opportunity: -3 });
  }
  if (hasAny(text, ['熬夜', '睡', '胃', '肩颈', '焦虑', '身体', '医院', '疼'])) {
    delta = mergeDeltas(delta, { energy: -8, health: -7, selfWorth: -2 });
  }
  if (hasAny(text, ['绩效', '早会', '项目', '简历', '转行', '作品', '找工作', '考研', '论文'])) {
    delta = mergeDeltas(delta, { career: -4, opportunity: 7, selfWorth: -3 });
  }
  if (hasAny(profile.support, ['没有', '没人', '暂时没有', '一个人'])) {
    delta = mergeDeltas(delta, { relationships: -8, avoidance: 4 });
  } else {
    delta = mergeDeltas(delta, { relationships: 7, selfWorth: 3 });
  }
  if (profile.goal) {
    delta = mergeDeltas(delta, { opportunity: 6, selfWorth: 3 });
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
  if (stats.avoidance > 72 && stats.opportunity < 42) return '你在好好歇着——这没什么不对';
  if (stats.selfWorth > 68 && stats.avoidance < 45) return '状态在慢慢回来，不急';
  if (stats.relationships > 66 && stats.health > 62) return '有人和身体在稳稳托着你';
  if (stats.money < 800) return '现金紧一点，但退路还有的是';
  return '怎么走都行，路还很宽';
}

function deriveCustomMove(rawText) {
  const text = rawText.trim();
  const matched = [];
  let delta = { selfWorth: 4, avoidance: -2 };
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
      id: 'slump',
      label: '低配人生',
      copy: '钱包瘦一点、节奏慢一点，但你饿不着、塌不了。',
      color: '#b88a5a',
      score:
        stats.avoidance * 0.42 +
        (100 - stats.selfWorth) * 0.2 +
        (100 - stats.opportunity) * 0.2 +
        Math.max(0, 2800 - stats.money) / 90,
    },
    {
      id: 'reboot',
      label: '慢慢回血',
      copy: '不是逆袭，只是行动感一点点回来。',
      color: '#5f8f6b',
      score:
        (100 - stats.avoidance) * 0.26 +
        stats.career * 0.2 +
        stats.opportunity * 0.25 +
        stats.selfWorth * 0.18 +
        Math.min(turnCount * 2, 12),
    },
    {
      id: 'stable',
      label: '低欲稳定',
      copy: '不追求爆发，先把生活托住。',
      color: '#3d6fd8',
      score:
        stats.health * 0.2 +
        stats.relationships * 0.22 +
        Math.max(0, stats.money) / 95 +
        (100 - Math.abs(stats.energy - 58)) * 0.16,
    },
    {
      id: 'loop',
      label: '反复横跳',
      copy: '清醒几次，也躺平几次——路没锁死，随时能选。',
      color: '#b48a00',
      score:
        stats.energy * 0.16 +
        stats.selfWorth * 0.17 +
        stats.relationships * 0.14 +
        (100 - Math.abs(stats.career - 50)) * 0.16 +
        (stats.avoidance > 55 ? 14 : 4),
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
    slump: '你没有失败，只是把日子过成了低配版——而它依然能过',
    reboot: '你没有突然逆袭，但下一步已经重新长出来了',
    stable: '你把野心调小了一点，也把日子托得更稳了',
    loop: '你还在反复横跳，而这恰恰说明：什么都还来得及',
  };

  const summaryMap = {
    slump: '摆烂的代价远没有想象中可怕：钱少花点、节奏慢一点，但你饿不着、塌不了，随时能重新开始。你担心的那些最坏结局，几乎一个都没发生。最坏，也不过如此。',
    reboot: '你不需要靠热血翻盘。几个小动作就够把惯性松一松，剩下的交给时间——它一直站在你这边。',
    stable: '先把自己活稳，也是一种了不起的选择。关系、身体、现金被托住之后，很多事自然就有了喘息的空间。',
    loop: '会清醒也会躺平，太正常了。这一局最适合继续玩，因为它证明：你随时能换个方向，没有什么是定死的。',
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
            <h1>开摆之后</h1>
            <p>最坏也不过如此 · 一个让你松口气的人生模拟器</p>
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
        onChange={setDraftProfile}
        onGenerate={generateProfilePath}
        onResetSample={() => setDraftProfile(defaultProfile)}
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

      <CohortPanel
        cohort={cohort}
        loading={cohortLoading}
        error={cohortError}
        onLoad={loadCohort}
        movesMade={movesMade}
      />
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
  onChange,
  onGenerate,
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
    <section className="panel profile-panel" aria-label="人生画像输入">
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

      <div className="profile-actions">
        <p className="generation-note">{generationNote}</p>
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
