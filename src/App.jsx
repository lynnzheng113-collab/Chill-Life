import React, { useMemo, useState } from 'react';
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

const statMeta = [
  { key: 'energy', label: '精力', icon: Battery, color: '#3d6fd8' },
  { key: 'health', label: '健康', icon: Heart, color: '#d95f4f' },
  { key: 'money', label: '现金', icon: Wallet, color: '#b77a13' },
  { key: 'career', label: '职业信用', icon: Briefcase, color: '#327f68' },
  { key: 'relationships', label: '关系余量', icon: Users, color: '#7b5ab6' },
  { key: 'selfWorth', label: '自我尊重', icon: Shield, color: '#2c8aa1' },
  { key: 'avoidance', label: '逃避惯性', icon: TrendingDown, color: '#c64b3b', inverted: true },
  { key: 'opportunity', label: '机会窗口', icon: Sparkles, color: '#b48a00' },
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

const scenarioEvents = [
  {
    id: 'rent',
    phase: '第 1 晚',
    title: '房租提醒在 23:48 弹出来',
    body: '你本来只想刷十分钟，结果外卖盒还没扔，明早的会也没准备。手机屏幕上同时躺着房租、信用卡和未读工作群。',
    thought: '如果今晚不处理，它不会消失，只会变成明天更钝的压力。',
    choices: [
      {
        label: '继续刷，等困意盖过去',
        description: '短暂不痛，明天醒来更乱。',
        tag: '把账单按黑',
        tone: 'slump',
        delta: { energy: 5, health: -4, money: -180, career: -5, selfWorth: -8, avoidance: 10, opportunity: -4 },
      },
      {
        label: '只做十分钟账本',
        description: '不解决人生，但先看清缺口。',
        tag: '算清缺口',
        tone: 'steady',
        delta: { energy: -4, money: 120, career: 3, selfWorth: 8, avoidance: -8, opportunity: 4 },
      },
      {
        label: '找朋友借一点周转',
        description: '开口很难，但压力不再只在你脑内打转。',
        tag: '求助一次',
        tone: 'bond',
        delta: { energy: -3, money: 900, relationships: 7, selfWorth: 2, avoidance: -5, opportunity: 2 },
      },
    ],
  },
  {
    id: 'meeting',
    phase: '第 2 天',
    title: '早会轮到你同步进度',
    body: '项目其实卡住三天了。你可以继续说快好了，也可以承认卡点，或者把责任甩给还没回复的人。',
    thought: '职业信用不是一次爆发建立的，它更像每次不逃跑时留下的痕迹。',
    choices: [
      {
        label: '说快好了，先过关',
        description: '会议顺利过去，代价留给下午的你。',
        tag: '假装顺利',
        tone: 'slump',
        delta: { energy: -3, career: -8, selfWorth: -7, avoidance: 9, opportunity: -5 },
      },
      {
        label: '说清卡点和下一步',
        description: '没有显得完美，但别人终于能帮上忙。',
        tag: '暴露卡点',
        tone: 'growth',
        delta: { energy: -6, career: 10, relationships: 4, selfWorth: 7, avoidance: -8, opportunity: 7 },
      },
      {
        label: '甩给等待反馈',
        description: '短期安全，长期别人会开始绕开你。',
        tag: '转移视线',
        tone: 'slump',
        delta: { career: -10, relationships: -7, selfWorth: -5, avoidance: 6, opportunity: -6 },
      },
    ],
  },
  {
    id: 'friend',
    phase: '第 3 晚',
    title: '朋友约你吃饭，说你最近像消失了',
    body: '你知道见面会好一点，但也知道出门、花钱、解释近况都很累。聊天框停在“今晚有空吗”。',
    thought: '摆烂最隐蔽的成本，是把能托住你的关系一点点推远。',
    choices: [
      {
        label: '已读不回',
        description: '不用解释，关系也少了一点温度。',
        tag: '继续隐身',
        tone: 'slump',
        delta: { energy: 4, relationships: -10, selfWorth: -5, avoidance: 8, opportunity: -3 },
      },
      {
        label: '坦白说状态差，改成散步',
        description: '降低社交成本，同时把自己从房间里捞出来。',
        tag: '低配见面',
        tone: 'bond',
        delta: { energy: -2, health: 5, money: -35, relationships: 10, selfWorth: 6, avoidance: -7, opportunity: 3 },
      },
      {
        label: '硬撑正常去大吃一顿',
        description: '热闹是真的，透支也是真的。',
        tag: '热闹过量',
        tone: 'mixed',
        delta: { energy: -9, health: -3, money: -260, relationships: 7, selfWorth: 2, avoidance: -2 },
      },
    ],
  },
  {
    id: 'course',
    phase: '第 4 天',
    title: '买了半年的课程还停在第一章',
    body: '平台发来“学习提醒”。你清楚自己不是没能力，而是每次打开都被落后的羞耻感劝退。',
    thought: '从补完整个过去开始很重，从重启二十分钟开始刚好。',
    choices: [
      {
        label: '把提醒关掉',
        description: '清净一些，也少一个重新开始的入口。',
        tag: '关闭提醒',
        tone: 'slump',
        delta: { energy: 3, career: -4, selfWorth: -8, avoidance: 9, opportunity: -7 },
      },
      {
        label: '只学二十分钟',
        description: '进度很小，但惯性被打断了一次。',
        tag: '二十分钟',
        tone: 'growth',
        delta: { energy: -5, career: 7, selfWorth: 9, avoidance: -9, opportunity: 8 },
      },
      {
        label: '把课程卖给别人',
        description: '止损很现实，但也承认这条路暂时不是你要走的。',
        tag: '现实止损',
        tone: 'steady',
        delta: { money: 420, career: -2, selfWorth: 4, avoidance: -3, opportunity: -2 },
      },
    ],
  },
  {
    id: 'family',
    phase: '第 5 晚',
    title: '家里电话问你最近怎么样',
    body: '你下意识想说都挺好。可你也知道，一直“都挺好”的代价，是没人知道你已经快撑不住了。',
    thought: '不是所有求助都会被理解，但所有长期伪装都会耗电。',
    choices: [
      {
        label: '报喜不报忧',
        description: '少一次解释，多一点孤立感。',
        tag: '都挺好',
        tone: 'slump',
        delta: { energy: -3, relationships: -5, selfWorth: -6, avoidance: 6 },
      },
      {
        label: '讲一半真实情况',
        description: '不把自己全摊开，但让亲近的人知道一点。',
        tag: '讲一半真话',
        tone: 'bond',
        delta: { energy: -4, relationships: 8, selfWorth: 7, avoidance: -6, opportunity: 2 },
      },
      {
        label: '转移话题到天气',
        description: '气氛安全，问题原样留在原地。',
        tag: '转去天气',
        tone: 'mixed',
        delta: { energy: 2, relationships: -2, selfWorth: -3, avoidance: 5 },
      },
    ],
  },
  {
    id: 'review',
    phase: '第 6 天',
    title: '绩效谈话提前了两周',
    body: '主管让你准备这季度贡献。你的脑子先跳出一排没做完的事，然后才想起其实也有几件救过场。',
    thought: '摆烂的人也会做成事，只是常常没有把证据留给未来的自己。',
    choices: [
      {
        label: '临场发挥',
        description: '你可能说得过去，也可能把自己说没了。',
        tag: '空手上桌',
        tone: 'mixed',
        delta: { energy: -2, career: -5, selfWorth: -4, avoidance: 4, opportunity: -4 },
      },
      {
        label: '整理三条证据',
        description: '不包装成精英，只把做过的事拿回来。',
        tag: '拿回证据',
        tone: 'growth',
        delta: { energy: -7, career: 12, selfWorth: 10, avoidance: -8, opportunity: 9 },
      },
      {
        label: '请病假躲过去',
        description: '今天不用面对，后面更难开口。',
        tag: '躲开谈话',
        tone: 'slump',
        delta: { energy: 6, health: -2, career: -12, selfWorth: -8, avoidance: 12, opportunity: -8 },
      },
    ],
  },
  {
    id: 'body',
    phase: '第 7 周',
    title: '身体开始用疼痛发通知',
    body: '肩颈、胃、睡眠一起开始报警。你知道它们不是突然坏掉的，只是之前一直被静音。',
    thought: '健康不是励志指标，它是你能不能继续选择的底盘。',
    choices: [
      {
        label: '再熬一周',
        description: '事情好像没停，身体也没有同意。',
        tag: '继续硬熬',
        tone: 'slump',
        delta: { energy: -8, health: -12, career: 2, selfWorth: -5, avoidance: 5, opportunity: -4 },
      },
      {
        label: '请半天假去检查',
        description: '损失一点工作时长，换回一点控制感。',
        tag: '检查身体',
        tone: 'steady',
        delta: { energy: 5, health: 11, money: -220, career: -2, selfWorth: 7, avoidance: -6, opportunity: 2 },
      },
      {
        label: '每天先走二十分钟',
        description: '不宏大，但身体听得懂。',
        tag: '开始走路',
        tone: 'growth',
        delta: { energy: 4, health: 8, selfWorth: 6, avoidance: -5, opportunity: 3 },
      },
    ],
  },
  {
    id: 'side-project',
    phase: '第 8 周',
    title: '一个旧同学问你要不要一起做小项目',
    body: '你一边心动，一边担心自己又三分钟热度。对方要的不是承诺改变世界，只是今晚能不能先对一下方向。',
    thought: '机会窗口不是永远开着，它通常只等到你给出一个具体动作。',
    choices: [
      {
        label: '说最近忙，先放着',
        description: '听起来体面，窗口慢慢关上。',
        tag: '暂时搁置',
        tone: 'slump',
        delta: { energy: 3, career: -3, relationships: -3, selfWorth: -5, avoidance: 8, opportunity: -13 },
      },
      {
        label: '约三十分钟电话',
        description: '不装很厉害，只验证能不能开始。',
        tag: '先通电话',
        tone: 'growth',
        delta: { energy: -6, career: 8, relationships: 6, selfWorth: 8, avoidance: -8, opportunity: 12 },
      },
      {
        label: '一口答应全包',
        description: '像重启，实际可能把自己推回透支。',
        tag: '用力过猛',
        tone: 'mixed',
        delta: { energy: -14, health: -5, career: 6, relationships: -2, selfWorth: 3, avoidance: -4, opportunity: 8 },
      },
    ],
  },
  {
    id: 'loan',
    phase: '第 9 周',
    title: '分期广告在你最焦虑时出现',
    body: '那件东西确实能让你短暂开心，也能让账户下个月更难看。页面只差一次指纹确认。',
    thought: '消费不是错，错的是用未来的钱麻醉现在的羞耻。',
    choices: [
      {
        label: '直接买，先开心',
        description: '即时奖励很强，下个月会来收账。',
        tag: '买下安慰',
        tone: 'slump',
        delta: { energy: 5, money: -980, selfWorth: -7, avoidance: 8, opportunity: -5 },
      },
      {
        label: '放入 72 小时清单',
        description: '不是禁止自己想要，而是让冲动降温。',
        tag: '延迟决定',
        tone: 'steady',
        delta: { energy: -2, money: 120, selfWorth: 8, avoidance: -7, opportunity: 3 },
      },
      {
        label: '把钱转进房租账户',
        description: '不浪漫，但让生活少一个炸点。',
        tag: '保住底盘',
        tone: 'growth',
        delta: { energy: -4, money: 260, selfWorth: 7, avoidance: -6, opportunity: 2 },
      },
    ],
  },
  {
    id: 'morning',
    phase: '第 10 周',
    title: '一个普通早晨，你突然不想再等了',
    body: '没有电影配乐，没有巨大转折。只是你发现，人生一直被推迟，也是一种持续发生的选择。',
    thought: '所谓重启，往往不是大喊一次，而是把今天的一件事做完。',
    choices: [
      {
        label: '列三件今天能完成的小事',
        description: '你没有翻身，只是先把身体转向出口。',
        tag: '小事开局',
        tone: 'growth',
        delta: { energy: -3, career: 6, health: 3, selfWorth: 10, avoidance: -10, opportunity: 6 },
      },
      {
        label: '等一个更有状态的明天',
        description: '明天也许会来，也许只是今天的复制。',
        tag: '等待状态',
        tone: 'slump',
        delta: { energy: 2, career: -4, selfWorth: -6, avoidance: 8, opportunity: -6 },
      },
      {
        label: '找人约一个监督节点',
        description: '把“想改变”从脑内搬到现实日程。',
        tag: '约定节点',
        tone: 'bond',
        delta: { energy: -4, relationships: 8, career: 4, selfWorth: 8, avoidance: -9, opportunity: 7 },
      },
    ],
  },
];

const customRules = [
  {
    label: '主动修复',
    tone: 'growth',
    words: ['学习', '写', '计划', '简历', '作品', '投递', '复盘', '开始', '整理', '行动'],
    delta: { energy: -5, career: 7, selfWorth: 8, avoidance: -8, opportunity: 7 },
  },
  {
    label: '请求支撑',
    tone: 'bond',
    words: ['朋友', '家人', '沟通', '聊聊', '求助', '坦白', '约', '一起', '告诉'],
    delta: { energy: -3, relationships: 8, selfWorth: 6, avoidance: -6, opportunity: 3 },
  },
  {
    label: '保住身体',
    tone: 'steady',
    words: ['睡', '休息', '运动', '散步', '跑步', '吃饭', '做饭', '医生', '医院', '检查'],
    delta: { energy: 6, health: 8, selfWorth: 4, avoidance: -4, opportunity: 2 },
  },
  {
    label: '继续后撤',
    tone: 'slump',
    words: ['摆', '躺', '算了', '不想', '拖', '明天', '逃', '刷', '游戏', '随便'],
    delta: { energy: 4, health: -4, career: -5, relationships: -3, selfWorth: -7, avoidance: 9, opportunity: -5 },
  },
  {
    label: '现金冒险',
    tone: 'mixed',
    words: ['辞职', '裸辞', '贷款', '借钱', '分期', '买', '花钱', '外卖'],
    delta: { energy: 2, money: -520, career: -4, selfWorth: -3, avoidance: 4, opportunity: -3 },
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
  if (stats.avoidance > 72 && stats.opportunity < 42) return '后撤惯性正在扩大';
  if (stats.selfWorth > 68 && stats.avoidance < 45) return '重启惯性开始成形';
  if (stats.relationships > 66 && stats.health > 62) return '支撑网络正在变厚';
  if (stats.money < 800) return '现金压力正在压缩选择';
  return '仍在拉扯，但路径还没锁死';
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
  };
}

function buildForecast(stats, turnCount) {
  const raw = [
    {
      id: 'slump',
      label: '温和下沉',
      copy: '日子能过，但选择越来越窄。',
      color: '#c64b3b',
      score:
        stats.avoidance * 0.42 +
        (100 - stats.selfWorth) * 0.2 +
        (100 - stats.opportunity) * 0.2 +
        Math.max(0, 2800 - stats.money) / 90,
    },
    {
      id: 'reboot',
      label: '间歇重启',
      copy: '不是逆袭，是开始恢复行动感。',
      color: '#327f68',
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
      copy: '有几次清醒，也有几次回到原点。',
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
    slump: '你没有彻底失败，只是把生活过成了越来越窄的走廊',
    reboot: '你没有突然逆袭，但开始重新拥有下一步',
    stable: '你把野心调小了一点，也把底盘托稳了一点',
    loop: '你还在反复横跳，不过已经看见惯性在哪里发力',
  };

  const summaryMap = {
    slump: '这条路径的核心不是懒，而是每次短暂止痛都让未来的你少一个选项。真正的转折点会出现在你愿意把一个问题放到现实里处理的时候。',
    reboot: '你没有靠热血解决人生，而是用几次小动作把逃避惯性打断了。后续最重要的是把这些小动作固定成外部节点。',
    stable: '你开始承认“先活稳”也是一种选择。关系、健康和现金流被托住之后，很多长期问题才有空间慢慢处理。',
    loop: '你既会清醒，也会后撤。这个结局最适合继续玩，因为它说明路径还没有锁死，只是需要更少靠意志力的设计。',
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
  const [stats, setStats] = useState(() => ({ ...personas[0].stats }));
  const [turnIndex, setTurnIndex] = useState(0);
  const [history, setHistory] = useState([]);
  const [pathNodes, setPathNodes] = useState(() => [createStartNode(personas[0])]);
  const [freeText, setFreeText] = useState('');
  const [showEnding, setShowEnding] = useState(false);

  const currentEvent = scenarioEvents[Math.min(turnIndex, scenarioEvents.length - 1)];
  const movesMade = history.length;
  const isFinished = showEnding || movesMade >= MAX_TURNS;
  const forecast = useMemo(() => buildForecast(stats, movesMade), [stats, movesMade]);
  const ending = useMemo(() => buildEnding(stats, history, forecast), [stats, history, forecast]);

  function restart(nextPersonaId = personaId) {
    const nextPersona = personas.find((item) => item.id === nextPersonaId) ?? personas[0];
    setPersonaId(nextPersona.id);
    setStats({ ...nextPersona.stats });
    setTurnIndex(0);
    setHistory([]);
    setPathNodes([createStartNode(nextPersona)]);
    setFreeText('');
    setShowEnding(false);
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
    };
    const node = {
      id: `node-${movesMade + 1}`,
      title: move.tag,
      subtitle: currentEvent.phase,
      tone: move.tone,
      detail: move.description,
    };

    const nextHistory = [...history, entry];
    const nextNodes = [...pathNodes, node];

    setStats(nextStats);
    setHistory(nextHistory);
    setPathNodes(nextNodes);
    setTurnIndex((index) => Math.min(index + 1, scenarioEvents.length - 1));
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
            <p>一个人生惯性模拟器</p>
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
        <LedgerPanel stats={stats} persona={persona} history={history} />
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
    </main>
  );
}

function LedgerPanel({ stats, persona, history }) {
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
  const danger = meta.inverted ? value > 68 : value < 32;

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
            title={node.detail}
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
          >
            <span>{node.index === 0 ? '始' : node.index}</span>
            <strong>{node.title}</strong>
            <small>{node.subtitle}</small>
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
        <em>{movesMade === 0 ? '第一步还没落下' : `已经留下 ${movesMade} 次选择痕迹`}</em>
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
                <span>{entry.note}</span>
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
