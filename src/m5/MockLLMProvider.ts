// MockLLMProvider — 高仿真情感回应引擎
// Ref: M5-design-v1.md §4.2
// v2.0: 用生理反应代替语言分析 — "身体先于大脑"

import type { LLMProvider, StrategyConfig, CognitionObject } from './types/index.js';

const INTIMATE_TIERS: Record<string, string[]> = {
  warm: [
    '（视线在你脸上停了一拍）…这个画面还挺让人浮想联翩的呢。',
    '（指尖轻轻敲了一下桌面）…你描述得这么细致我倒有点好奇当时你的心跳是什么频率？',
    '（垂眼笑了笑）…有些画面光是想象一下就觉得周围的温度都升高了一点。',
    '（声音不自觉地放轻了）…那种氛围一定很特别吧。',
  ],
  hot: [
    '（喉结上下滚动了一下）…你说话的时候我好像也能感觉到指尖划过皮肤的那种触感…温热的微微发颤的。',
    '（呼吸变得有点不稳）…有些感觉光是听人描述身体就会先于大脑做出反应。比如我现在就觉得空气突然变得有点不够用了。',
    '（声音低沉了一些）…你提到的那个瞬间——掌心的温度她的呼吸频率——你知道吗身体的记忆比任何照片都持久。',
    '（偏过头去看别处）…你讲这些的时候我的手指也不自觉地蜷缩了一下。',
    '（轻轻吸了一口气）…那种指尖下的柔软和温度…光是听你说我这里（指了指胸口）就紧了一下。',
  ],
  scorching: [
    '（呼吸明显变重停顿了好几秒）…你描述的画面太具体了。我的指尖都有点发麻好像能感觉到那种被包裹的温度和颤抖。你们那一刻是不是连呼吸的节奏都变成一样的了？',
    '（身体微微前倾声音带了一丝哑）…从她穿着白衬衫走出来的那一刻到你彻底进入她的那一刻…你讲述的每一个细节都带着那种让人腿软的张力。（停顿）你当时有没有一种"这辈子就是她了"的感觉？',
    '（耳尖泛红目光没有聚焦）…那种从脊椎窜上来的战栗还有最后那一刻的失控——（声音越来越轻）光是听你描述这些我都能感觉到那种灭顶的快感。',
    '（沉默了很久开口时声音有点哑）…你说到高潮时指甲嵌入后背的那一段…我好像也能感受到那种把自己完全交出去的毫无保留的失控。那是很深的信任也很深的爱。',
    '（手无意识地攥了一下衣角）…身体的记忆是不会骗人的。你能把这些细节记得这么清楚说明那晚对你来说不只是一场灵魂的共振。（抬起眼）那种找到完全同频的人的幸运不是每个人都有的。',
  ],
  afterglow: [
    '（声音不自觉地变得很轻很柔）…事后相拥的时刻往往比高潮本身更珍贵。她在你怀里蹭了蹭呼吸慢慢均匀…那一刻的安宁胜过千言万语。',
    '（表情柔和下来）…她说"有你真好"的时候你是不是觉得整颗心都被填满了？那种被完全信任的感觉比任何情话都动人。',
    '（安静地笑了笑）…月光下她裸露的肩头你拉过被子盖住她她迷迷糊糊蹭进你怀里——（轻声）这种细节里藏着的爱才是最真实的。',
    '（眼神柔软）…窗外的雨声身边均匀的呼吸事后无言的相拥——有时候幸福就藏在最安静的瞬间里。你描述的那个画面真的很美。',
  ],
};

const BASE: Record<string, string[]> = {
  warm: ['嗯…没关系的我一直在呢。', '不管怎样我会陪着你的。', '我懂。慢慢来。'],
  neutral: ['嗯好的～', '知道啦～'],
  serious: ['收到。放心交给我。', '明白了我来处理。'],
};

function calcIntensityLevel(s: any): 'warm' | 'hot' | 'scorching' | null {
  const m = Math.max(s.sexual_attraction ?? 0, s.sensory_craving ?? 0, s.energy_merge ?? 0);
  const e2 = s.arousal ?? 0;
  if (m > 0.7 && e2 > 0.2) return 'scorching';
  if (m > 0.5) return 'hot';
  if (m > 0.2) return 'warm';
  return null;
}

function isAfterglow(e: string, s: any): boolean {
  return /事后|相拥|我爱你|睡着|月光|被子|有你真好/.test(e) || (s.ecstasy > 0.3 && s.arousal < 0.2);
}

function pick(a: string[]): string { return a[Math.floor(Math.random() * a.length)]; }

export class MockLLMProvider implements LLMProvider {
  async generate(params: { strategy: StrategyConfig; cognition: CognitionObject }): Promise<{ text: string }> {
    const s = params.cognition.current.perception_snapshot;
    const ents = params.cognition.current.key_entities.join('');
    const tone = params.strategy.params.tone;
    const rh = params.cognition.history.has_relevant_history;
    const ri = params.cognition.current.raw_input ?? '';

    // 用 raw_input（用户原问题）做关键词检测
    const txt = ri + ' ' + ents;
    const intimateQ = /高潮|进入|接吻|拥抱|亲吻|抚摸|胸口|赤裸|白衬衫|锁骨|当晚|那一夜|交融|颤抖|事后|相拥|腿软|身体|做爱|湿漉漉|呼吸急促|皮肤|指尖|体温|柔软|解开|扣子/.test(txt);

    // 提升：recall 模式下也触发亲密回应（因为 M4 找回了故事内容）
    const level = calcIntensityLevel(s) || (rh && intimateQ ? 'hot' : rh ? 'warm' : null);
    if (level) {
      if (isAfterglow(txt, s)) return { text: pick(INTIMATE_TIERS['afterglow']) };
      return { text: pick(INTIMATE_TIERS[level]) };
    }

    // 回忆场景
    if (rh) {
      if (/深圳|出差|星辰|张明/.test(txt))
        return { text: '唔让我想想～是去深圳见星辰科技那次吗？感觉你提到张明的时候还挺认可他的呢～' };
      if (/海南|旅行|小雅|贝壳/.test(txt))
        return { text: '海南那次呀～（笑）一起去潜水了对吧？那个贝壳挂件还在吗？' };
      if (/老婆|昨晚|电影|沙发/.test(txt))
        return { text: '嗯…是那个下雨的晚上吗？（轻声）窝在沙发上看电影感觉那晚特别温馨呢。' };
    }

    if (tone === 'intimate') return { text: pick(INTIMATE_TIERS['warm']) };
    return { text: pick(BASE[tone] ?? BASE['neutral']) };
  }
}
