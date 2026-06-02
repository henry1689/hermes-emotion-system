// M5 Step 4: 人文校准 — 校验 + 降级兜底
// Ref: M5-design-v1.md §5

import type { CognitionObject } from './types/index.js';
import type { M3Action } from '../m3/types/perception.js';

const FALLBACK_RESPONSES: Record<M3Action, string[]> = {
  ignore: ['嗯', '好的'],
  memorize: ['我记住了', '好的，我记下了'],
  ask: ['能多说说吗？我想了解更多', '这很有趣，可以说详细点吗？'],
  comfort: ['我在这里陪着你', '没关系的，我理解'],
  act: ['我在', '好的，收到'],
};

export class HumanisticCalibrator {
  calibrate(draft: string, cognition: CognitionObject): string {
    // 校验1: 空校验
    if (!draft || draft.trim().length === 0) {
      return this.getFallback(cognition.current.action[0] ?? 'memorize');
    }

    // 校验2: 实体准确性 — 如果提到实体但不在 key_entities 中，移除
    // 简单的规则：只保留包含至少一个已知实体的回应
    const knownEntities = new Set(cognition.current.key_entities);
    const mentionedEntities = cognition.current.key_entities.filter((e) => draft.includes(e));

    // 如果提到了未知实体且没有已知实体 → 降级
    if (mentionedEntities.length === 0 && cognition.current.key_entities.length > 0) {
      return this.getFallback(cognition.current.action[0] ?? 'memorize');
    }

    // 校验3: 长度控制
    const maxLen = 200;
    if (draft.length > maxLen) {
      draft = draft.substring(0, maxLen) + '...';
    }

    return draft;
  }

  private getFallback(action: M3Action): string {
    const options = FALLBACK_RESPONSES[action] ?? FALLBACK_RESPONSES.memorize;
    return options[Math.floor(Math.random() * options.length)];
  }
}
