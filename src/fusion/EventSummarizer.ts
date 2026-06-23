/**
 * EventSummarizer — 事件摘要生成器
 *
 * 将同一事件内的多条消息聚合为一条带摘要的情感记忆记录。
 * 两层策略：
 *   Tier 1（规则）：取 24D 均值 + 高频实体 + 模板摘要，始终可用
 *   Tier 2（LLM 可选）：调用 DeepSeek 生成自然语言摘要
 *
 * 认知映射：
 *   聚合 24D ≈ 事件的情感重心（element-wise mean）
 *   摘要 ≈ gist trace（主旨记忆痕迹）
 *   peakMomentIndex ≈ 事件中最生动的瞬间
 */
import type { Perception24D } from '../m3/types/perception.js';
import type { DNA, EntityGene } from '../m1/types/dna.js';
import type { LLMProvider } from '../m5/types/index.js';
import { computeCalcium } from './math.js';
import { emotionalSimilarity } from './math.js';

/** 事件摘要产出 */
export interface EventSummary {
  /** 1-3 句自然语言摘要 */
  summary: string;
  /** 聚合后的 24D 感知向量 */
  aggregatePerception: Perception24D;
  /** 聚合感知的钙质 */
  aggregateCalcium: { score: number; level: 0|1|2|3 };
  /** 事件中钙质最高的消息索引 */
  peakMomentIndex: number;
  /** 事件中出现过的高频实体（去重） */
  topEntities: string[];
  /** 合并后的实体基因列表（去重） */
  mergedEntities: EntityGene[];
  /** 合并后的原始文本（用换行拼接） */
  mergedRawInput: string;
  /** 议题路径（取钙质最高的消息的 locus_path） */
  dominantLocusPath: string;
  /** 所属语义区域（取钙质最高的消息的 leaf_zone） */
  dominantLeafZone: string;
}

/** 事件中的单条消息快照 */
export interface EventEntry {
  dna: DNA;
  perception: Perception24D;
  calciumScore: number;
  calciumLevel: number;
}

// ─── Tier 1: 规则摘要 ───

/**
 * 将事件内多条消息聚合为一条带摘要的总结。
 * 纯规则，不依赖 LLM。
 */
export function summarizeEvent(entries: EventEntry[]): EventSummary {
  if (entries.length === 0) throw new Error('summarizeEvent: empty entries');

  // 1. 找峰值（钙质最高的消息）
  let peakIdx = 0;
  for (let i = 1; i < entries.length; i++) {
    if (entries[i].calciumScore > entries[peakIdx].calciumScore) peakIdx = i;
  }
  const peak = entries[peakIdx];

  // 2. 聚合 24D：逐元素均值
  const dimKeys: (keyof Perception24D)[] = [
    'pleasure','arousal','dominance','aggression','sincerity','humor',
    'factual','logical','certainty','abstract','temporal_focus','self_ref',
    'intimacy','power_diff','dependency','moral_judgment','etiquette','belonging',
    'sexual_attraction','sensory_craving','energy_merge','possessiveness','ecstasy','safety',
  ];
  const sum: Record<string, number> = {};
  for (const k of dimKeys) sum[k] = 0;
  for (const e of entries) {
    for (const k of dimKeys) sum[k] += e.perception[k] ?? 0;
  }
  const avg: any = {};
  for (const k of dimKeys) avg[k] = sum[k] / entries.length;
  const aggregatePerception = avg as Perception24D;

  // 3. 合并实体（去重）
  const seenEntities = new Map<string, EntityGene>();
  for (const e of entries) {
    for (const gene of e.dna.entity_genes) {
      if (!seenEntities.has(gene.name)) {
        seenEntities.set(gene.name, { ...gene });
      }
    }
  }
  const mergedEntities = [...seenEntities.values()];

  // 4. 合并原始文本
  const mergedRawInput = entries.map(e => e.dna.raw_input).join('\n');

  // 5. 提取 top 实体（按出现次数）
  const entityFreq = new Map<string, number>();
  for (const e of entries) {
    for (const gene of e.dna.entity_genes) {
      entityFreq.set(gene.name, (entityFreq.get(gene.name) ?? 0) + 1);
    }
  }
  const topEntities = [...entityFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);

  // 6. 构建摘要文本（模板式）
  const locusParts = peak.dna.locus_path.split('.').filter(Boolean);
  const topicLabel = locusParts.length >= 2
    ? `${locusParts[0]}·${locusParts[1]}`
    : peak.dna.locus_path;

  const emotionLabel = describeEmotion(aggregatePerception);
  const entityLabel = topEntities.length > 0 ? `提到了 ${topEntities.join('、')}` : '';

  let summary = `关于${topicLabel}的对话。`;
  if (emotionLabel) summary += `对话${emotionLabel}。`;
  if (entityLabel) summary += entityLabel + '。';
  if (entries.length > 1) summary += `共${entries.length}条消息。`;

  // 7. 钙质
  const aggregateCalcium = computeCalcium(aggregatePerception);

  return {
    summary,
    aggregatePerception,
    aggregateCalcium,
    peakMomentIndex: peakIdx,
    topEntities,
    mergedEntities,
    mergedRawInput,
    dominantLocusPath: peak.dna.locus_path,
    dominantLeafZone: peak.dna.leaf_zone,
  };
}

// ─── Tier 2: LLM 摘要（可选） ───

/**
 * 使用 LLM 生成更自然的事件摘要。
 * 当 LLM 不可用时回退到 Tier 1 规则摘要。
 */
export async function summarizeEventWithLLM(
  entries: EventEntry[],
  llm?: LLMProvider,
): Promise<EventSummary> {
  if (!llm || entries.length <= 1) {
    // 单条消息不需要 LLM 摘要
    return summarizeEvent(entries);
  }

  // 先用规则摘要做基础
  const base = summarizeEvent(entries);

  try {
    const prompt = `请用一句话概括以下对话的主题和情感（20字以内）：
${entries.map((e, i) => `[${i + 1}] ${e.dna.raw_input}`).join('\n')}`;

    const result = await llm.generate({
      strategy: { strategy_id: 'summarize', params: { tone: 'neutral', max_length: 80, include_entity: [], include_history: false, include_family: false }, description: '' },
      cognition: {
        current: {
          action: ['memorize'], emotion_summary: '', key_entities: [],
          calcium_level: 0, raw_input: prompt,
          perception_snapshot: base.aggregatePerception as any,
        },
        history: { has_relevant_history: false, summary: '', time_span: '' },
        strategy_hint: { tone: 'neutral', depth: 'shallow', urgency: 'low' },
      },
    });

    return {
      ...base,
      summary: result.text.trim() || base.summary,
    };
  } catch {
    return base;
  }
}

// ─── 辅助函数 ───

function describeEmotion(p: Perception24D): string {
  const parts: string[] = [];
  if (p.pleasure > 0.3) parts.push('情感积极');
  else if (p.pleasure < -0.3) parts.push('情绪低落');
  if (p.arousal > 0.5) parts.push('情绪强烈');
  if (p.intimacy > 0.3) parts.push('带有亲密感');
  if (p.aggression > 0.3) parts.push('带有攻击性');
  if (p.humor > 0.3) parts.push('带有幽默感');
  if (p.sexual_attraction > 0.3) parts.push('带有性吸引');
  return parts.join('、');
}
