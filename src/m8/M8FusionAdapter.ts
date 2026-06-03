/**
 * M8FusionAdapter — 融合存储视图下的 M8 引擎
 *
 * M8 不再是独立的 JSON 存储。年轮 = FusionStorageAdapter 中 is_landmark=true 的记录。
 * 疤痕 = memories 表中 scar_type 非空的记录。
 */
import type { FusionStorageAdapter } from '../fusion/FusionStorageAdapter.js';
import type { EmotionalMemoryRecord } from '../fusion/types/index.js';
import type { M8Engine } from './M8Engine.js';
import type {
  WriteParams, WriteResponse, ClueSearchParams, ClueSearchResult,
  ClueSearchResultEntry, ConflictCheckParams, ConflictCheckResult,
  YearRingEntry, M8StorageStatus, ScarTag, PerceptionSnapshot,
  SimulatedPhysiologicalSnapshot,
} from './types/index.js';

export class M8FusionAdapter implements M8Engine {
  private storage: FusionStorageAdapter;

  constructor(storage: FusionStorageAdapter) {
    this.storage = storage;
  }

  // ── 写入：晋升一条记忆为地标 ──

  async write(params: WriteParams): Promise<WriteResponse> {
    // 通过情感检索找到最匹配的记忆，标记为地标
    const results = this.storage.findByEmotionalSimilarity({
      current_perception: params.perception,
      similarity_mode: 'balanced',
      limit: 5,
    });

    const bestMatch = results[0];
    if (bestMatch && bestMatch.composite > 0.3) {
      this.storage.promoteToLandmark(
        bestMatch.record.id,
        params.narrative_tag,
        params.sensory_anchor,
      );
      return {
        result: { success: true, entry_id: bestMatch.record.id },
      };
    }

    return { result: { success: false, entry_id: '', error: 'No matching memory to promote' } };
  }

  async writeBatch(params: WriteParams[]): Promise<WriteResponse[]> {
    return Promise.all(params.map(p => this.write(p)));
  }

  // ── 检索：委托给情感检索 ──

  async matchByClue(params: ClueSearchParams): Promise<ClueSearchResult> {
    const start = Date.now();
    const results = this.storage.getEmotionalLandscape();

    const entries: ClueSearchResultEntry[] = results.peaks.map(p => ({
      entry: this.toYearRingEntry(p),
      clue_match_score: 0.5,
      semantic_score: 0.5,
      physiological_score: 0.5,
      composite_score: p.calcium,
    }));

    return { entries: entries.slice(0, params.limit || 5), latency_ms: Date.now() - start };
  }

  async readById(entryId: string): Promise<YearRingEntry | null> {
    const sqlite = this.storage.getSQLite();
    const record = sqlite.findById(entryId);
    if (!record || !record.is_landmark) return null;

    return {
      id: record.id,
      created_at: record.created_at,
      updated_at: record.strength_updated_at,
      sensory_anchor: record.sensory_anchor ?? record.raw_input.substring(0, 20),
      simulated_physiological_snapshot: this.derivePhysiological(record),
      emotional_valence: record.narrative_tag ?? '日常',
      narrative_tag: record.narrative_tag ?? 'general',
      retrieval_clues: record.entity_genes.map(g => g.name).filter(Boolean),
      recall_count: record.recall_count,
      last_recalled_at: record.last_recalled_at,
      calcium_at_event: record.calcium_score,
      perception_snapshot: this.toPerceptionSnapshot(record.perception),
    };
  }

  // ── 疤痕仲裁 ──

  async checkConflict(params: ConflictCheckParams): Promise<ConflictCheckResult> {
    const landscape = this.storage.getEmotionalLandscape();
    const unhealed = landscape.scars.filter(s => {
      const entry = landscape.peaks.find(p => p.id === s.id);
      return entry && (entry.narrative_tag?.includes(params.target) || params.target.includes(entry.narrative_tag ?? ''));
    });

    if (unhealed.length > 0) {
      return {
        hasConflict: true,
        relatedScars: unhealed.map(s => ({
          entry_id: s.id,
          type: s.type as any,
          healed: false,
          healed_at: null,
          healed_by: null,
        })),
        description: `检测到 ${unhealed.length} 条未愈合疤痕与 "${params.target}" 相关`,
        suggestion: 'block',
      };
    }

    return {
      hasConflict: false,
      relatedScars: [],
      description: '无历史冲突记录',
      suggestion: 'proceed',
    };
  }

  // ── 状态 ──

  async getStatus(): Promise<M8StorageStatus> {
    const s = this.storage.getSQLite().getStatus();
    const landscape = this.storage.getEmotionalLandscape();
    return {
      totalEntries: s.landmarks,
      scarCount: landscape.scars.length,
      healedCount: 0,
      unhealedCount: landscape.scars.length,
    };
  }

  // ── 私有 ──

  private toYearRingEntry(peak: any): YearRingEntry {
    return {
      id: peak.id,
      created_at: peak.created_at,
      updated_at: peak.created_at,
      sensory_anchor: peak.snippet?.substring(0, 20) ?? '',
      simulated_physiological_snapshot: {
        estimated_hr: 70,
        estimated_temp_offset: 37.0,
        estimated_arousal: peak.calcium,
        estimated_gsr: 0.3,
        derivation_version: 'fusion-v1',
      },
      emotional_valence: `钙化 ${peak.calcium.toFixed(2)}`,
      narrative_tag: peak.narrative_tag ?? 'general',
      retrieval_clues: [],
      recall_count: 0,
      last_recalled_at: null,
      calcium_at_event: peak.calcium,
      perception_snapshot: {
        pleasure: peak.pleasure,
        arousal: 0.3,
        intimacy: peak.intimacy,
        sexual_attraction: 0,
        sensory_craving: 0,
        energy_merge: 0,
        ecstasy: 0,
        safety: 0.5,
      },
    };
  }

  private derivePhysiological(record: EmotionalMemoryRecord): SimulatedPhysiologicalSnapshot {
    return {
      estimated_hr: Math.round(50 + record.calcium_score * 130),
      estimated_temp_offset: 36.5 + (record.perception.pleasure + 1) / 2 * 0.8,
      estimated_arousal: record.calcium_score,
      estimated_gsr: (record.perception.pleasure > 0.3 ? 0.6 : 0.2),
      derivation_version: 'fusion-v1',
    };
  }

  private toPerceptionSnapshot(p: any): PerceptionSnapshot {
    return {
      pleasure: p.pleasure, arousal: p.arousal,
      intimacy: p.intimacy, sexual_attraction: p.sexual_attraction,
      sensory_craving: p.sensory_craving, energy_merge: p.energy_merge,
      ecstasy: p.ecstasy, safety: p.safety ?? 0.5,
    };
  }
}
