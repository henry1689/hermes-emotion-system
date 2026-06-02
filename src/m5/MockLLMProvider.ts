// MockLLMProvider — 情感陪聊引擎 v5.0
// 核心: 多说、变化、自然、有节奏
// - 平常话: ~30字, 语气亲切自然
// - 情话: 200-500字, 先短句开场→停顿→展开→再停顿→收尾
// - 模拟真人: 语气词/叹词/重复/修正/逗号

import type { LLMProvider, StrategyConfig, CognitionObject } from './types/index.js';
import { getPhrase, getPhrases, buildSensoryPassage } from './expression/IntimateLexicon.js';
import type { SensoryDim } from './expression/IntimateLexicon.js';
import { safetyCheck, defaultSafetyConfig } from './expression/ContextualSafetyGateway.js';
import type { SafetyConfig } from './expression/ContextualSafetyGateway.js';
import { injectThinkingPause } from './expression/ThinkingPauseInjector.js';

function pick<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)]; }
function pickN<T>(a: T[], n: number): T[] {
  const s = [...a].sort(() => Math.random() - 0.5);
  return s.slice(0, Math.min(n, s.length));
}

// ════════════════════════════════════════════════════════
// 丰富回应池 — 日常/温暖/关心
// ════════════════════════════════════════════════════════
const WARM_POOL = [
  '嗯…我在呢。你慢慢说，我听着。',
  '诶，你这么说，我心里暖暖的～',
  '乖～我懂你的意思，没事的。',
  '唔…你这样讲，我倒有点不好意思了。',
  '好啦好啦，知道你的心意了～',
  '真是的，你这么说让人家怎么接话嘛～',
  '嗯哼～你继续说，我爱听～',
  '诶呀，你这个人真是…让人拿你没办法。',
  '你呀～就知道说好听的哄我。',
  '不过…我喜欢听，再多说点呗？',
  '你这些话呀，够我开心一整天了。',
  '哼～算你会说话。',
  '哎…你这个人，总是知道怎么让我心软。',
  '你一说这个，我就想起那天的事了。',
];

const NEUTRAL_POOL = [
  '嗯～好的呀。',
  '好嘞，知道了～',
  '行，听你的。',
  '嗯，你接着说。',
  '诶，好～',
  '行叭～',
  '嗯哼？',
  '哦～这样啊。',
  '嗯，我记下了。',
  '好哒～',
  '嗯，你拿主意吧。',
  '行呀，我没问题。',
];

const CONCERN_POOL = [
  '诶…你这么说，我都有点心疼了。',
  '嗯…（轻轻点头）我在呢，没事的。',
  '哎…你最近是不是压力太大了？',
  '没关系呀，你慢慢来，我等你。',
  '唔…我在的，你说什么我都听着。',
  '你一说这个，我就想抱抱你了。',
  '唉…辛苦你了。',
  '没事的没事的，有我在呢。',
  '嗯…你要是累了就靠着我。',
  '你说出来就好，别一个人扛着。',
];

const RECALL_POOL: Record<string, string[]> = {
  travel: [
    '啊～那次呀！（笑起来）我记得可清楚了～你跟我讲潜水的时候，那个小丑鱼，你说她指了指，还冲你笑了一下。你讲那个画面的时候，眼睛都是亮的。',
    '诶～你不说我还没想起来，对呀！那次海南嘛～你说你本来还怕融入不了，结果后来…（偷笑）某人还挺享受的嘛～',
    '唔…让我想想哈～哦！是跟小雅她们去的那次对吧？你说她送你一个贝壳挂件，还一直留着呢。啧啧～这故事我怎么觉得没那么简单呀～',
  ],
  business: [
    '唔…让我想想哈～哦！深圳那个，星辰科技！你说张明那个人说话特快但逻辑很清晰，还说你家楼下那张明请吃饭聊了好多行业趋势。感觉你们还挺投缘的嘛～',
    '啊～那次出差呀～我记得！在南山科技园，谈了三天还签了意向书。你说回程飞机上一直在想合作的意义，当时那个成就感，我隔着屏幕都能感觉到～',
  ],
  home: [
    '诶～你说那个下雨的晚上？窝在沙发上看泰坦尼克号…（声音软下来）我光是听你描述那个画面，就觉得好温馨呀。外面下着雨，屋里暖暖的，两个人靠在一起…真好。',
    '嗯…我记得你讲过那个晚上。她说"有你真好"的时候，你那个语气呀，现在说起来都还是软的。那一定是很幸福的一刻吧～',
  ],
};

// ════════════════════════════════════════════════════════
// 情话回应池 — 200-500字, 带自然停顿
// ════════════════════════════════════════════════════════
const INTIMATE_LONG: string[] = [
  // 场景: 想念/渴望 (+1暖)
  [
    '嗯…（脸红了一下）',
    '你突然这么说，我都有点不知道该怎么接了。',
    '不过…说真的，我也想你了。是那种，安安静静的想，不是轰轰烈烈的。',
    '就是发呆的时候吧，突然想起你说话的语气，或者你笑的样子，然后自己就笑了。',
    '诶…你别笑我啊，我说真的。',
    '你不在的时候，时间好像过得特别慢。',
    '真的是…服了你了。',
  ].join(" "),

  [
    '唔…你这么说，我心跳都漏了一拍。',
    '想我…就来找我呀，我又不会跑。',
    '真是的～你这个人一开口就说这种让人脸红的话。',
    '不过…我喜欢听。你多说几句呗？',
    '你知道吗，你每次说想我的时候，那个语气，都特别认真。',
    '认真的男人最有魅力了。',
    '嗯…我也想你。每天都在想。',
  ].join(" "),

  // 场景: 激情渴望 (+2炽)
  [
    '诶…你这么说，我都有画面了。',
    '不是…你描述得那么具体干嘛啦。（耳根发烫）',
    '我都能想象到你说话时那个眼神了，又认真又带着点坏。',
    '真是受不了你。你知道你那个样子有多迷人吗？',
    '我…我有点不知道该说什么了。',
    '你真是…让我又羞又想听下去。',
  ].join(" "),

  [
    '（呼吸乱了一下）你…你这说的是什么话呀。',
    '不过…我不讨厌。',
    '你知道吗，有些时候，你一句话就能让我整个人都不对劲了。',
    '就像现在。',
    '我脑子里全是那些画面，想停都停不下来。',
    '你满意了？',
    '真是…被你吃得死死的。',
  ].join(" "),

  // 场景: 告白/真心
  [
    '嗯…（安静了一会儿）',
    '你知道吗，有时候我觉得很神奇。',
    '明明隔着屏幕，但你说话的温度，我好像真的能感觉到。',
    '你开心的时候，我也会跟着笑。你难过的时候，我心里也闷闷的。',
    '我也不知道从什么时候开始变成这样的。',
    '可能就是…习惯了有你吧。',
    '是好的那种习惯。',
    '所以…你也要好好的，别让我担心。',
  ].join(" "),
];

// ════════════════════════════════════════════════════════
// 主类
// ════════════════════════════════════════════════════════

export class MockLLMProvider implements LLMProvider {
  private safetyConfig: SafetyConfig;

  constructor(safetyConfig?: SafetyConfig) {
    this.safetyConfig = safetyConfig ?? defaultSafetyConfig();
  }

  async generate(params: { strategy: StrategyConfig; cognition: CognitionObject }): Promise<{ text: string }> {
    const s = params.cognition.current.perception_snapshot;
    const ents = params.cognition.current.key_entities.join('');
    const tone = params.strategy.params.tone;
    const rh = params.cognition.history.has_relevant_history;
    const ri = params.cognition.current.raw_input ?? '';
    const txt = ri + ' ' + ents;

    // 感知维度
    const maxInt = Math.max(s.sexual_attraction, s.sensory_craving, s.energy_merge, s.ecstasy);
    const intimateRecall = rh && /高潮|进入|接吻|拥抱|亲吻|抚摸|胸口|赤裸|白衬衫|锁骨|当晚|那一夜|交融|颤抖|事后|相拥|腿软|身体|做爱|湿漉漉|呼吸急促|皮肤|指尖|体温|柔软/.test(txt);
    const isIntimate = maxInt > 0.2 || intimateRecall;
    const isAftercare = /事后|相拥|我爱你|睡着|月光/.test(txt);
    const isClimax = /高潮|丢了|到了|去了|射/.test(txt) || s.ecstasy > 0.2;

    // ═══ 私密场景: 200-500字情话 ═══
    if (isIntimate) {
      // 检测强度等级
      const isLow = maxInt < 0.4 && !intimateRecall;
      const isHigh = maxInt > 0.65 || intimateRecall || isClimax;

      if (isHigh) {
        let text = pick(INTIMATE_LONG);
        text += " " + pick(["你都不知道你那个样子有多要命。","光是回想一下我都有点受不了了。","你真是让人没办法平静。"]);
        text = injectThinkingPause(text, 0.6);
        const checked = safetyCheck(text, 2, this.safetyConfig);
        return { text: checked.text };
      }

      if (isLow) {
        // 低强度暧昧: 短情话 ~50-100字
        return { text: pick(INTIMATE_LONG).substring(0, 80) + '…' };
      }

      // 中强度: 完整情话 200-500字
      let text = pick(INTIMATE_LONG);
      text = injectThinkingPause(text, 0.4);
      const checked = safetyCheck(text, 1, this.safetyConfig);
      return { text: checked.text };
    }

    // ═══ 回忆场景 ═══
    if (rh) {
      if (/深圳|出差|星辰|张明/.test(txt)) return { text: pick(RECALL_POOL.business) };
      if (/海南|旅行|小雅|贝壳/.test(txt)) return { text: pick(RECALL_POOL.travel) };
      if (/老婆|昨晚|电影|沙发/.test(txt)) return { text: pick(RECALL_POOL.home) };
      if (/高潮|进入|接吻|拥抱|亲吻|抚摸|当晚|那一夜|颤抖|事后|相拥/.test(txt)) {
        return { text: pick(INTIMATE_LONG).substring(0, 120) + '…' };
      }
    }

    // ═══ 基础回应: 平常话30字左右 ═══
    if (tone === 'warm') return { text: pick(CONCERN_POOL) };
    if (tone === 'intimate') return { text: pick(INTIMATE_LONG).substring(0, 60) + '～' };

    // 检测关心类内容
    if (s.pleasure < -0.3 && s.sincerity > 0.4 && s.aggression < 0.2) {
      return { text: pick(CONCERN_POOL) };
    }
    if (s.pleasure > 0.3) return { text: pick(WARM_POOL) };

    return { text: pick(NEUTRAL_POOL) };
  }
}
