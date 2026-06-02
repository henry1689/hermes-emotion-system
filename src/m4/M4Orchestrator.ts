// M4Orchestrator — M4 知识融合层主控制器
// Ref: M4-design-v1.md §5

import type { M3Decision } from '../m3/types/perception.js';
import type { M4Context } from './types/index.js';
import type { StorageAdapter } from '../m2/StorageAdapter.js';
import { MemoryRetriever } from './MemoryRetriever.js';
import { FamilyGraph } from './FamilyGraph.js';

export class M4Orchestrator {
  private memoryRetriever: MemoryRetriever;
  private familyGraph: FamilyGraph;

  constructor(storage: StorageAdapter, familyGraph?: FamilyGraph) {
    this.memoryRetriever = new MemoryRetriever(storage);
    this.familyGraph = familyGraph ?? new FamilyGraph();
  }

  async initialize(): Promise<void> {
    await this.familyGraph.initialize();
  }

  /**
   * 对 M3 决策执行完整的 M4 知识融合流程
   */
  async orchestrate(decision: M3Decision): Promise<M4Context> {
    const entities = decision.enhanced.entity_genes.map((g) => ({
      name: g.name,
      type: g.type,
    }));
    const locusPath = decision.enhanced.locus_path;

    // 1. 记忆检索 + 上下文压缩
    const memories = await this.memoryRetriever.retrieveMemories(locusPath, entities);
    const memorySummary = this.memoryRetriever.compressMemories(memories);

    // 2. 家族知识图谱自动推断
    const inferenceResult = await this.familyGraph.integrateFromEntity(
      decision.enhanced.entity_genes,
      decision.enhanced.raw_input
    );

    // 3. 获取家族知识摘要
    const familySummary = await this.familyGraph.getFamilySummary();

    // 4. 构建家族上下文
    const familyContext = familySummary.members.map((m) => ({
      entity: m.name,
      relation: m.relation_to_user,
      related_entity: '我',
    }));

    // 5. 输出 M4Context
    return {
      decision,
      memory_summary: memorySummary,
      family_context: familyContext.length > 0 ? familyContext : undefined,
      current_time: new Date().toISOString(),
      meta: {
        has_history: memories.length > 0,
        has_family_context: familySummary.members.length > 0,
        calcium_level: decision.enhanced.calcium_level,
        dominant_action: decision.actions[0] ?? 'memorize',
      },
    };
  }

  getFamilyGraph(): FamilyGraph {
    return this.familyGraph;
  }
}
