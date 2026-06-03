/**
 * M9 WorkingMemory — 工作记忆缓冲
 *
 * 短期记忆环缓冲区。所有消息先进入这里，
 * 只有达到毕业阈值（钙化够高或有实体）才写入 M2 长期存储。
 * 粉末级的日常噪音直接丢弃。
 */
import type { FusionStorageAdapter } from '../fusion/FusionStorageAdapter.js';
import type { Perception24D } from '../m3/types/perception.js';
import type { DNA } from '../m1/types/dna.js';
import type { WriteResult } from '../fusion/types/index.js';
import { computeCalcium } from '../fusion/math.js';

interface WorkingEntry {
  dna: DNA;
  perception: Perception24D;
  calciumScore: number;
  calciumLevel: number;
  /** 在缓冲中停留的轮数 */
  cycleCount: number;
  /** 是否有值得保留的实体 */
  hasMeaningfulEntity: boolean;
  createdAt: number;
}

export class WorkingMemory {
  private buffer: WorkingEntry[] = [];
  private maxSize: number;
  private storage: FusionStorageAdapter;

  constructor(storage: FusionStorageAdapter, maxSize = 50) {
    this.storage = storage;
    this.maxSize = maxSize;
  }

  /** 推入一条新记录 */
  push(dna: DNA, perception: Perception24D): void {
    const calcium = computeCalcium(perception);
    const meaningful = dna.entity_genes.some(g =>
      g.type !== 'self' && g.name.length > 0
    );

    this.buffer.push({
      dna,
      perception,
      calciumScore: calcium.score,
      calciumLevel: calcium.level,
      cycleCount: 0,
      hasMeaningfulEntity: meaningful,
      createdAt: Date.now(),
    });

    // 超过阈值时触发巩固
    if (this.buffer.length >= this.maxSize) {
      this.consolidate();
    }
  }

  /** 巩固：毕业高价值记录到 M2，丢弃噪音 */
  async consolidate(): Promise<WriteResult[]> {
    const results: WriteResult[] = [];

    // 按创建时间排序（最早的先处理）
    this.buffer.sort((a, b) => a.createdAt - b.createdAt);

    // 逐条判定
    const keep: WorkingEntry[] = [];
    for (const entry of this.buffer) {
      entry.cycleCount++;

      // 毕业规则
      const shouldGraduate =
        entry.calciumLevel >= 2 ||                    // 固体/晶体级 → 必须有意义
        (entry.calciumLevel === 1 && entry.hasMeaningfulEntity) || // 液体级 + 有实体
        (entry.calciumLevel === 1 && entry.cycleCount >= 3);      // 液体级且停留了3轮

      const shouldDiscard =
        entry.calciumLevel === 0 ||                    // 粉末级 → 噪音
        (!entry.hasMeaningfulEntity && entry.cycleCount >= 2);    // 无实体且停留2轮

      if (shouldGraduate) {
        // 晋升到 M2
        try {
          const result = await this.storage.write(entry.dna, entry.perception);
          results.push(result);
        } catch {
          results.push({ success: false, real_ref: '', seq_pos: -1, error: 'write failed' });
        }
      } else if (!shouldDiscard) {
        // 还不确定 → 留在缓冲中等下一轮
        keep.push(entry);
      }
      // shouldDiscard → 直接丢弃
    }

    this.buffer = keep;

    if (results.length > 0) {
      console.log(`[WM] 巩固: ${results.length} 条毕业, ${keep.length} 条保留在缓冲`);
    }

    return results;
  }

  /** 获取缓冲状态 */
  getStatus(): { size: number; maxSize: number; utilization: number } {
    return {
      size: this.buffer.length,
      maxSize: this.maxSize,
      utilization: Math.round(this.buffer.length / this.maxSize * 100),
    };
  }

  /** 强制写入所有剩余记录（服务器关闭前调用） */
  async flushAll(): Promise<WriteResult[]> {
    // 全部毕业
    const toGraduate = [...this.buffer];
    const results: WriteResult[] = [];
    for (const entry of toGraduate) {
      try {
        results.push(await this.storage.write(entry.dna, entry.perception));
      } catch {
        results.push({ success: false, real_ref: '', seq_pos: -1, error: 'write failed' });
      }
    }
    this.buffer = [];
    if (results.length > 0) {
      console.log(`[WM] 强制刷出: ${results.length} 条`);
    }
    return results;
  }
}
