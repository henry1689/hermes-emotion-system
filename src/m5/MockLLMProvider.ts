// MockLLMProvider — 测试用 LLM 模拟实现
// Ref: M5-design-v1.md §4.2

import type { LLMProvider, StrategyConfig, CognitionObject } from './types/index.js';

const TEMPLATES: Record<string, string> = {
  'mem-general': '嗯，好的。',
  'ask-curious': '{{EMOTION}}这件事能多说说吗？{{ENTITY}}听起来很有意思。',
  'com-warm': '我理解你的感受，没关系的。{{ENTITY}}的事情慢慢来，我一直在这里。',
  'mem-ask': '好的，我记住了。{{EMOTION}}你愿意多说一些吗？',
  'act-core': '收到。{{EMOTION}}我会全力处理。{{ENTITY}}的事情我们一起面对。',
};

export class MockLLMProvider implements LLMProvider {
  async generate(params: { strategy: StrategyConfig; cognition: CognitionObject }): Promise<{ text: string }> {
    const template = TEMPLATES[params.strategy.strategy_id] ?? TEMPLATES['mem-general'];
    let text = template
      .replace('{{EMOTION}}', params.cognition.current.emotion_summary ? params.cognition.current.emotion_summary + '。' : '')
      .replace('{{ENTITY}}', params.cognition.current.key_entities[0] ?? '你');

    return { text };
  }
}
