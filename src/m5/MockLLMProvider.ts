// MockLLMProvider — 私密伴侣引擎 v4.0
// 去文艺化，还原真实床笫间的语言生态
//
// 核心原则:
// 1. 禁用比喻("像""如""仿佛")，直接用动词+感官词
// 2. 激情模式强制短句堆叠+生理反应前置
// 3. 第二人称侵入，把用户拉回现场
// 4. 输出经过 ContextualSafetyGateway（非一刀切过滤）

import type { LLMProvider, StrategyConfig, CognitionObject } from './types/index.js';
import { renderIntimateResponse, renderLongIntimate } from './expression/IntimateRenderer.js';
import type { IntimateSceneType } from './expression/IntimateRenderer.js';
import { getPhrase, getPhrases, buildSensoryPassage } from './expression/IntimateLexicon.js';
import type { SensoryDim } from './expression/IntimateLexicon.js';
import { safetyCheck, defaultSafetyConfig } from './expression/ContextualSafetyGateway.js';
import type { SafetyConfig } from './expression/ContextualSafetyGateway.js';
import { injectThinkingPause } from './expression/ThinkingPauseInjector.js';

function pick(a: string[]): string { return a[Math.floor(Math.random() * a.length)]; }

// ─── 非亲密场景的基础回应池 ───
const BASE: Record<string, string[]> = {
  warm: ['嗯…没关系的，我一直在呢。', '我会陪着你的。'],
  neutral: ['嗯好的～', '知道啦～'],
  serious: ['收到。放心交给我。', '明白了我来处理。'],
};

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

    // 亲密场景检测
    const maxIntimate = Math.max(s.sexual_attraction, s.sensory_craving, s.energy_merge, s.ecstasy);
    const isIntimateRecall = rh && /高潮|进入|接吻|拥抱|亲吻|抚摸|胸口|赤裸|白衬衫|锁骨|当晚|那一夜|交融|颤抖|事后|相拥|腿软|身体|做爱|湿漉漉|呼吸急促|皮肤|指尖|体温|柔软|解开|扣子/.test(txt);
    const isHighIntimate = maxIntimate > 0.4 || isIntimateRecall;

    // ─── 私密场景：使用直白表达引擎 ───
    if (isHighIntimate) {
      // 检测场景类型
      const isAftercare = /事后|相拥|我爱你|睡着|月光/.test(txt) || (s.ecstasy > 0.3 && s.arousal < 0.2);
      const isClimax = /高潮|丢了|到了|去了|射/.test(txt) || s.ecstasy > 0.2;

      // 高强度 → 长回应（300-500字）
      if (maxIntimate > 0.3 || isIntimateRecall) {
        const scene = isAftercare ? "aftercare" : isClimax ? "climax" : "thrust";
        const ul = maxIntimate > 0.7 ? 3 : maxIntimate > 0.4 ? 2 : 1;
        let text = renderLongIntimate(maxIntimate, scene, ul);

        // 安全检查
        const checked = safetyCheck(text, 2, this.safetyConfig);
        return { text: checked.text };
      }

      // 中强度 → 短回应（含直白感受）
      const phrase = getPhrases(1, '生理', 1).join('');
      let text = injectThinkingPause(phrase, 0.5);
      const checked = safetyCheck(text, 1, this.safetyConfig);
      return { text: checked.text };
    }

    // ─── 回忆场景（非私密） ───
    if (rh) {
      if (/深圳|出差|星辰|张明/.test(txt))
        return { text: '唔…是去深圳见星辰科技那次吗？感觉你提到张明的时候还挺认可他的呢～' };
      if (/海南|旅行|小雅|贝壳/.test(txt))
        return { text: '海南那次呀～一起去潜水了对吧？那个贝壳挂件还在吗？' };
      if (/老婆|昨晚|电影|沙发/.test(txt))
        return { text: '嗯…是那个下雨的晚上吗？窝在沙发上看电影…感觉那晚特别温馨呢。' };
    }

    // ─── 基础回应 ───
    if (tone === 'intimate') {
      const phrase = getPhrase('生理', 1);
      return { text: phrase || '（视线在你脸上停了一拍）' };
    }
    return { text: pick(BASE[tone] ?? BASE['neutral']) };
  }
}
