// M5 Step 1: 认知组装 — 纯函数，零LLM，<20ms
// Ref: M5-design-v1.md §2

import type { M4Context } from '../m4/types/index.js';
import type { CognitionObject } from './types/index.js';

export class CognitionAssembler {
  assemble(m4ctx: M4Context): CognitionObject {
    const decision = m4ctx.decision;
    const p = decision.enhanced.perception;

    // 构建情绪摘要
    let emotionSummary = '中性表达';
    if (p.pleasure > 0.3) emotionSummary = '表达了积极情绪';
    else if (p.pleasure < -0.3) emotionSummary = '表达了负面情绪';
    if (p.aggression > 0.5) emotionSummary += '，带有明显攻击性';
    if (p.humor > 0.5) emotionSummary += '，带有幽默感';

    // 构建历史摘要
    const hasHistory = m4ctx.memory_summary.timeline.length > 0;
    let historySummary = '无相关历史记忆';
    let timeSpan = '';
    if (hasHistory) {
      const latest = m4ctx.memory_summary.timeline[0];
      historySummary = `提及相关话题: "${latest.summary}"`;
      timeSpan = `${m4ctx.memory_summary.timeSpan.earliest} ~ ${m4ctx.memory_summary.timeSpan.latest}`;
    }

    // 策略提示
    const tone: CognitionObject['strategy_hint']['tone'] =
      decision.actions.includes('comfort') ? 'warm'
      : decision.actions.includes('act') ? 'serious'
      : 'neutral';
    const depth: CognitionObject['strategy_hint']['depth'] =
      decision.enhanced.calcium_level >= 3 ? 'deep'
      : decision.enhanced.calcium_level >= 2 ? 'medium'
      : 'shallow';
    const urgency: CognitionObject['strategy_hint']['urgency'] =
      decision.actions.includes('act') ? 'high'
      : decision.actions.includes('comfort') || decision.actions.includes('ask') ? 'medium'
      : 'low';

    return {
      current: {
        action: decision.actions,
        emotion_summary: emotionSummary,
        key_entities: decision.enhanced.entity_genes.map((e) => e.name),
        calcium_level: decision.enhanced.calcium_level,
      },
      history: {
        has_relevant_history: hasHistory,
        summary: historySummary,
        time_span: timeSpan,
      },
      family: m4ctx.family_context
        ? {
            has_family_context: true,
            relationships: m4ctx.family_context.map(
              (f) => `${f.entity} 是你的${f.relation}`
            ),
          }
        : undefined,
      strategy_hint: { tone, depth, urgency },
    };
  }
}
