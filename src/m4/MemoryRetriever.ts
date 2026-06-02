// MemoryRetriever — 从 M2 检索历史记忆 + 上下文压缩
// Ref: M4-design-v1.md §4

import type { StorageAdapter } from '../m2/StorageAdapter.js';
import type { DNA } from '../m1/types/dna.js';
import type { MemorySummary, M4Context } from './types/index.js';
import type { M3Action } from '../m3/types/perception.js';

export class MemoryRetriever {
  private storage: StorageAdapter;

  constructor(storage: StorageAdapter) {
    this.storage = storage;
  }

  /**
   * 根据 M3 决策检索相关历史记忆
   */
  async retrieveMemories(
    locusPath: string,
    entities: Array<{ name: string; type: string }>,
    options?: { limit?: number; minCalcium?: number }
  ): Promise<DNA[]> {
    const limit = options?.limit ?? 5;

    // 1. 按话题前缀检索
    const byLocus = await this.storage.findByLocus(locusPath, { limit: 20 });

    // 2. 按实体名称检索
    const entityResults = new Map<string, DNA>();
    for (const entity of entities) {
      if (entity.type !== 'person' && entity.type !== 'place') continue;
      const all = await this.storage.findByLocus(entity.name, { limit: 10 });
      for (const dna of all) {
        if (dna.raw_input.includes(entity.name)) {
          entityResults.set(dna.branch_id, dna);
        }
      }
    }
    // 按时间降序排列
    const byEntity = [...entityResults.values()]
      .sort((a, b) => b.seq_pos - a.seq_pos)
      .slice(0, limit);

    // 3. 合并去重
    const seen = new Set<string>();
    const merged: DNA[] = [];
    for (const dna of [...byEntity, ...byLocus]) {
      if (!seen.has(dna.branch_id) && merged.length < limit) {
        seen.add(dna.branch_id);
        merged.push(dna);
      }
    }

    return merged;
  }

  /**
   * 上下文窗口压缩 — 将多条 DNA 压缩为自然语言摘要
   */
  compressMemories(dnas: DNA[]): MemorySummary {
    if (dnas.length === 0) {
      return {
        timeline: [],
        frequentEntities: [],
        timeSpan: { earliest: '', latest: '' },
      };
    }

    const timeline = dnas.map((dna) => ({
      time: dna.created_at,
      summary: dna.raw_input.length > 60
        ? dna.raw_input.substring(0, 60) + '...'
        : dna.raw_input,
      calcium_level: 1, // 简略值
    }));

    // 统计高频实体（从 raw_input 中粗略提取）
    const freqMap = new Map<string, { type: string; count: number }>();
    for (const dna of dnas) {
      for (const gene of dna.entity_genes) {
        const key = `${gene.type}:${gene.name}`;
        const existing = freqMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          freqMap.set(key, { type: gene.type, count: 1 });
        }
      }
    }

    const frequentEntities = [...freqMap.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([key, val]) => {
        const [type, name] = key.split(':');
        return { name, type, mentionCount: val.count };
      });

    const sorted = [...dnas].sort((a, b) => a.seq_pos - b.seq_pos);

    return {
      timeline,
      frequentEntities,
      timeSpan: {
        earliest: sorted[0]?.created_at ?? '',
        latest: sorted[sorted.length - 1]?.created_at ?? '',
      },
    };
  }

  /**
   * 构建 M4Context
   */
  async buildContext(
    decision: { enhanced: { calcium_level: number; calcium_score: number }; actions: M3Action[]; timestamp: string },
    locusPath: string,
    entities: Array<{ name: string; type: string }>
  ): Promise<M4Context> {
    const memories = await this.retrieveMemories(locusPath, entities);
    const memorySummary = this.compressMemories(memories);

    return {
      decision: decision as any,
      memory_summary: memorySummary,
      current_time: new Date().toISOString(),
      meta: {
        has_history: memories.length > 0,
        has_family_context: false,
        calcium_level: decision.enhanced.calcium_level,
        dominant_action: decision.actions[0] ?? 'memorize',
      },
    };
  }
}
