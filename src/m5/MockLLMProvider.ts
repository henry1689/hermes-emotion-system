// MockLLMProvider — 测试用 LLM 模拟实现（高仿真情感版）
// Ref: M5-design-v1.md §4.2
// v1.1: 升级表达自然度 — 语气词/停顿/共情/回忆模式

import type { LLMProvider, StrategyConfig, CognitionObject } from './types/index.js';
import type { M3Action } from '../m3/types/perception.js';

const TEMPLATES: Record<string, string[]> = {
  'mem-general': [
    '嗯，好的呢～',
    '知道啦～',
    '好哒，我记住了～',
  ],
  'ask-curious': [
    '嗯…{{EMOTION}}这件事能多说说吗？那个{{ENTITY}}后来怎么样了呀？',
    '哦？{{EMOTION}}听起来好有意思…（好奇）可以再多讲一点关于{{ENTITY}}的吗～',
    '诶～{{EMOTION}}那个{{ENTITY}}，我感觉背后是不是还有什么故事呀？',
  ],
  'com-warm': [
    '嗯…（轻轻点头）我懂的。{{ENTITY}}的事情确实不容易，不过没关系的，我一直在呢。',
    '听到你这么说…我也觉得有点心疼。（轻声）不管怎样，我会陪着你的。',
    '我理解你的感受。那种时候一定很难熬吧…慢慢来，{{ENTITY}}的事我们一起面对就好。',
  ],
  'mem-ask': [
    '好的呀，我记住了～{{EMOTION}}不过…你是不是还有些话没说？我听着呢～',
    '嗯嗯，记下了记下了～{{EMOTION}}然后呢？我有点好奇后面发生了什么诶～',
    '好嘞～{{EMOTION}}这个印象挺深刻的。诶？我突然想问…那个{{ENTITY}}后来怎么样了呀？',
  ],
  'act-core': [
    '嗯，收到。（认真）{{EMOTION}}我会全力处理好的，{{ENTITY}}的事我们一起面对。',
    '明白了。{{EMOTION}}这件事我来想办法，你放心。（语气坚定）',
    '好的，交给我吧。{{EMOTION}}不管怎么样，有我在呢。{{ENTITY}}我们一起搞定。',
  ],
};

// 针对个人记忆召回的专门模板（更自然、更有温度）
const RECALL_TEMPLATES: Record<string, string[]> = {
  '出差': [
    '唔…让我想想～哦！是去深圳见星辰科技那次吗？感觉你提到张明的时候还挺认可他的呢～',
    '深圳出差那次呀…我记得！南山科技园那个，谈了三天还签了意向书对吧？挺有成就感的事呢～',
  ],
  '旅行': [
    '海南那次呀～（笑）跟小雅她们一起，你们去潜水了对吧？那个贝壳挂件…现在还在吗？',
    '当然记得呀～海南团建嘛，你说你原本还担心融入不了，结果后来…（轻笑）还挺开心的对吧？',
  ],
  '家庭': [
    '嗯…是那个下雨的晚上吗？（轻声）窝在沙发上看泰坦尼克号…感觉那晚特别温馨呢。',
    '啊～那个晚上我记得，外面下着雨屋里暖暖的。看完电影相拥着入睡…光是听着就觉得好幸福呢～',
  ],
};

export class MockLLMProvider implements LLMProvider {
  async generate(params: { strategy: StrategyConfig; cognition: CognitionObject }): Promise<{ text: string }> {
    const strategyId = params.strategy.strategy_id;
    const cogn = params.cognition;
    const rawInput = params.cognition.current.key_entities.join(' ');

    // 检测是否为个人记忆召回
    const recallMatch = this.detectRecallScenario(cogn);
    if (recallMatch) {
      const recallTemplates = RECALL_TEMPLATES[recallMatch];
      if (recallTemplates) {
        const text = recallTemplates[Math.floor(Math.random() * recallTemplates.length)];
        return { text };
      }
    }

    // 普通模板
    const templates = TEMPLATES[strategyId] ?? TEMPLATES['mem-general'];
    const template = templates[Math.floor(Math.random() * templates.length)];

    let text = template
      .replace('{{EMOTION}}', cogn.current.emotion_summary ? cogn.current.emotion_summary : '')
      .replace('{{ENTITY}}', cogn.current.key_entities[0] ?? '你');

    return { text };
  }

  private detectRecallScenario(cogn: CognitionObject): string | null {
    const text = cogn.current.key_entities.join(' ');
    if (text.includes('深圳') || text.includes('出差') || text.includes('星辰') || text.includes('张明')) return '出差';
    if (text.includes('海南') || text.includes('旅行') || text.includes('小雅') || text.includes('贝壳')) return '旅行';
    if (text.includes('老婆') || text.includes('昨晚') || text.includes('电影') || text.includes('沙发')) return '家庭';
    return null;
  }
}
