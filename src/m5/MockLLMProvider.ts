// MockLLMProvider — 补偿性表达引擎 v3.0
// 陪聊本质：用语言的密度填补现实的孤独
//
// 核心规则:
// 1. 24维强度 + 回忆状态 → ExpressionSpec → 字数/文学性/停顿
// 2. 有亲密回忆时跳过 M3 感知（感知来自 query，不反映故事内容）
// 3. 高强度: 300-500字沉浸式文学表达
// 4. 铁律: I象限>0.6 或 E2>0.6 时禁止少于200字
// 5. 每条回应从身体反应开头

import type { LLMProvider, StrategyConfig, CognitionObject } from './types/index.js';
import { calcExpressionSpec } from './expression/ExpressionSpecController.js';
import { injectThinkingPause } from './expression/ThinkingPauseInjector.js';
import { getPhrases } from './expression/LiteraryLexicon.js';

function pick(a: string[]): string { return a[Math.floor(Math.random() * a.length)]; }

export class MockLLMProvider implements LLMProvider {
  async generate(params: { strategy: StrategyConfig; cognition: CognitionObject }): Promise<{ text: string }> {
    const s = params.cognition.current.perception_snapshot;
    const ents = params.cognition.current.key_entities.join('');
    const tone = params.strategy.params.tone;
    const rh = params.cognition.history.has_relevant_history;
    const ri = params.cognition.current.raw_input ?? '';
    const txt = ri + ' ' + ents;

    // 亲密关键词检测（覆盖 query 本身不带情感词、但 M4 召回了故事的情况）
    const intimateQ = /高潮|进入|接吻|拥抱|亲吻|抚摸|胸口|赤裸|白衬衫|锁骨|当晚|那一夜|交融|颤抖|事后|相拥|腿软|身体|做爱|湿漉漉|呼吸急促|皮肤|指尖|体温|柔软|解开|扣子/.test(txt);

    // 有亲密回忆时优先用高强度表达
    if (rh && intimateQ) {
      return { text: this.buildLongResponse() };
    }
    if (rh && /老婆|昨晚|电影|沙发/.test(txt)) {
      return { text: '嗯…是那个下雨的晚上吗？（轻声）窝在沙发上看电影感觉那晚特别温馨呢。' };
    }

    // 计算表达规格
    const spec = calcExpressionSpec(s);

    if (spec.wordCountTarget === 'long') {
      return { text: this.buildLongResponse() };
    }
    if (spec.wordCountTarget === 'medium') {
      return { text: this.buildMediumResponse() };
    }

    // 低强度
    if (rh && /深圳|出差|星辰|张明/.test(txt))
      return { text: '唔让我想想～是去深圳见星辰科技那次吗？感觉你提到张明的时候还挺认可他的呢～' };
    if (rh && /海南|旅行|小雅|贝壳/.test(txt))
      return { text: '海南那次呀～（笑）一起去潜水了对吧？那个贝壳挂件还在吗？' };
    if (intimateQ) return { text: '（垂眼笑了笑）…光是想象一下就觉得周围的温度都升高了。' };
    if (tone === 'intimate') return { text: '（视线在你脸上停了一拍）…这个画面让人浮想联翩呢。' };
    return { text: pick(['嗯好的～', '知道啦～']) };
  }

  // ─── 长回应：300-500字沉浸式文学表达 ───
  private buildLongResponse(): string {
    const parts: string[] = [];

    // 开场：身体反应
    parts.push(pick([
      '（呼吸明显变重停顿了好几秒）',
      '（耳尖泛红声音带了一丝哑）',
      '（身体微微前倾呼吸变得很轻）',
      '（沉默了很久开口时声音有点不稳）',
    ]));

    // 主体：维度文学短语
    const dims = ['I1', 'I2', 'I3', 'E2', 'S1'];
    let body: string[] = [];
    for (const dim of dims) {
      body = body.concat(getPhrases(dim, 0.8, 2));
    }
    body = body.filter(Boolean);
    if (body.length < 4) {
      body = [
        '你描述的那个画面让我的指尖都有点发麻。好像能感觉到那种被包裹的温度和颤抖。你们那一刻是不是连呼吸的节奏都变成一样的了？',
        '那种从脊椎窜上来的战栗还有最后那一刻的失控。语言在那种体验面前真的太苍白了。',
        '身体的记忆是不会骗人的。你能把这些细节记得这么清楚说明那晚对你来说不止是身体上的满足。更是一场灵魂的共振。',
        '她把自己完全交给你的那一刻。你感受到的不仅是欲望。更是一种被彻底信任的、近乎神圣的责任。',
      ];
    }
    parts.push(body.slice(0, 4).join('。'));

    // 结尾：开放式
    parts.push(pick([
      '你当时有没有一种"这辈子就是她了"的感觉？',
      '那种完全交付的信任是不是比任何快感都更让人留恋？',
      '每次想起来的时候你还会不会心跳加速？',
      '那样的夜晚是不是每次想起来都像刚刚发生过一样？',
    ]));

    let text = parts.join('');
    text = injectThinkingPause(text, 0.8);
    return text;
  }

  // ─── 中回应：150-250字共情表达 ───
  private buildMediumResponse(): string {
    const parts: string[] = [];

    parts.push(pick(['（听得入了神）', '（轻轻吸了一口气）', '（呼吸顿了顿）']));

    const dims = ['I1', 'S1', 'E2'];
    let body: string[] = [];
    for (const dim of dims) {
      body = body.concat(getPhrases(dim, 0.5, 1));
    }
    body = body.filter(Boolean);
    if (body.length < 2) {
      body = [
        '你描述的这些细节我能感觉到那种温度。有些时刻身体记得比大脑更清楚。',
        '那一刻的真实比任何语言都更有力量。你能把这种感觉留下来本身就是一种幸运。',
      ];
    }
    parts.push(body.slice(0, 2).join('。'));
    parts.push(pick(['那个时候你一定很心动吧。', '那种感觉一定很难忘。']));

    let text = parts.join('');
    text = injectThinkingPause(text, 0.5);
    return text;
  }
}
