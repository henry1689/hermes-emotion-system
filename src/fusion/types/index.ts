/**
 * Fusion Memory Types — 融合记忆系统的核心类型定义
 *
 * 24 维情感向量作为记忆的主索引，文本/实体/话题作为次级索引。
 */
import type { Perception24D } from '../../m3/types/perception.js';
import type { EntityGene } from '../../m1/types/dna.js';

/** 相似度检索模式 */
export type SimilarityMode =
  | 'balanced'          // 默认：四象限均匀
  | 'mood_congruent'    // 情绪主导（高arousal时）
  | 'intimacy_search'   // 亲密维度主导
  | 'cognitive_match'   // 认知维度主导
  | 'social_resonance'  // 社会维度主导
  | 'by_calcium';       // 极端维度主导

/** 记忆地标/年轮状态 */
export interface MemoryScar {
  type: 'argument' | 'boundary_test' | 'misunderstanding' | 'disappointment';
  healed: boolean;
  healed_at: string | null;
}

/**
 * 融合记忆记录 — 统一存储单元
 *
 * 取代旧的 ZoneRecord。核心变化：
 * - perception 作为主索引（不再是可选的 metadata）
 * - 记忆动力学字段（强度/衰减/增强）作为一等公民
 * - 年轮/地标字段嵌入（M8 不再是独立存储）
 */
export interface EmotionalMemoryRecord {
  /** 唯一标识（原 branch_id） */
  id: string;
  /** 全局原子序号 */
  seq_pos: number;
  /** 创建时间 ISO8601 */
  created_at: string;

  /** ── 主索引：完整 24 维情感向量 ── */
  perception: Perception24D;
  calcium_score: number;
  calcium_level: 0 | 1 | 2 | 3;

  /** ── 内容次级索引 ── */
  raw_input: string;
  locus_path: string;
  entity_genes: EntityGene[];
  leaf_zone: string;

  /** ── 记忆动力学 ── */
  recall_count: number;
  last_recalled_at: string | null;
  reinforcement_accumulator: number;
  effective_strength: number;
  strength_updated_at: string;

  /** ── 年轮/地标 ── */
  is_landmark: boolean;
  landmarked_at: string | null;
  narrative_tag?: string;
  sensory_anchor?: string;
  scar?: MemoryScar;
}

/** 检索查询 */
export interface RetrievalQuery {
  current_perception: Perception24D;
  locus_path?: string;
  entities?: string[];
  similarity_mode: SimilarityMode;
  limit: number;
}

/** 评分后的记忆 */
export interface ScoredMemory {
  record: EmotionalMemoryRecord;
  scores: {
    emotional: number;    // 0..1
    topic: number;        // 0..1
    entity: number;       // 0..1
    calcium: number;      // 0..1
  };
  composite: number;
}

/** 情感地形图（取代旧 M8 的独立视图） */
export interface EmotionalLandscape {
  peaks: Array<{
    id: string;
    created_at: string;
    calcium: number;
    pleasure: number;
    intimacy: number;
    snippet: string;
    narrative_tag?: string;
  }>;
  scars: Array<{
    id: string;
    created_at: string;
    calcium: number;
    pleasure: number;
    type: string;
    snippet: string;
  }>;
  cluster_count: number;
}

/** 高阶归纳摘要 */
export interface InductionSummary {
  period_type: 'daily' | 'weekly' | 'monthly';
  period_start: string;
  period_end: string;
  summary_text: string;
  source_record_count: number;
  dominant_mood: Perception24D | null;
  trait_updates: Record<string, number> | null;
}
