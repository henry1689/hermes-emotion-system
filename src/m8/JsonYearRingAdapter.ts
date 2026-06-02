// JsonYearRingAdapter — M8 JSON 文件存储实现（樁/Stub）
// Ref: docs/M8-design-v1.md §2.3
//
// 实现 M8Engine 接口，使用 JSON 文件存储年轮数据。
// MVP 阶段使用文件存储，后续可升级为 SQLite。
//
// ⚠️ 当前为方法桩（Method Stub），返回值已固定，
//    待 M8 正式编码时填充完整逻辑。

import type { M8Engine } from './M8Engine.js';
import type {
  WriteParams,
  WriteResponse,
  ClueSearchParams,
  ClueSearchResult,
  ConflictCheckParams,
  ConflictCheckResult,
  YearRingEntry,
  M8StorageStatus,
} from './types/index.js';
import { derivePhysiologicalSnapshot } from './PhysiologicalDeriver.js';

export class JsonYearRingAdapter implements M8Engine {
  async write(params: WriteParams): Promise<WriteResponse> {
    // Stub: 返回模拟成功响应
    const snapshot = derivePhysiologicalSnapshot({
      pleasure: params.perception.pleasure,
      arousal: params.perception.arousal,
      intimacy: params.perception.intimacy,
      sexual_attraction: params.perception.sexual_attraction,
      sensory_craving: params.perception.sensory_craving,
      energy_merge: params.perception.energy_merge,
      ecstasy: params.perception.ecstasy,
      safety: params.perception.safety || 0.5,
    });

    return {
      result: { success: true, entry_id: `yr_${Date.now().toString(36)}` },
      ritual_phrase: '这一刻，我要把它刻进骨头里…',
    };
  }

  async writeBatch(params: WriteParams[]): Promise<WriteResponse[]> {
    return Promise.all(params.map((p) => this.write(p)));
  }

  async matchByClue(_params: ClueSearchParams): Promise<ClueSearchResult> {
    // Stub: 返回空结果
    return { entries: [], latency_ms: 0 };
  }

  async readById(_entryId: string): Promise<YearRingEntry | null> {
    return null;
  }

  async checkConflict(_params: ConflictCheckParams): Promise<ConflictCheckResult> {
    // Stub: 无冲突
    return {
      hasConflict: false,
      relatedScars: [],
      description: '无历史冲突记录',
      suggestion: 'proceed',
    };
  }

  async getStatus(): Promise<M8StorageStatus> {
    return { totalEntries: 0, scarCount: 0, healedCount: 0, unhealedCount: 0 };
  }
}
