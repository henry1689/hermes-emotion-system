/**
 * M9 WorkingMemory — 工作记忆缓冲（事件级聚合）
 *
 * 短期记忆环缓冲区。所有消息先进入这里。
 * 检测到事件边界时，将同事件的消息聚合为一条带摘要的情感记忆。
 *
 * 写入由 server.ts 的 FusionStorageAdapter 负责（保证 seq_pos 正确），
 * WM 只负责事件边界检测和摘要生成。
 */
import type { FusionStorageAdapter } from '../fusion/FusionStorageAdapter.js';
import type { Perception24D } from '../m3/types/perception.js';
import type { DNA } from '../m1/types/dna.js';
import { computeCalcium } from '../fusion/math.js';
import { detectEventBoundary } from '../fusion/EventDetector.js';
import { summarizeEvent, type EventEntry } from '../fusion/EventSummarizer.js';

interface WorkingEntry {
  dna: DNA;
  perception: Perception24D;
  calciumScore: number;
  calciumLevel: number;
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

  /**
   * 推入一条新记录。
   * 检测事件边界，当话题切换时将 buffer 中已结束的事件做聚合更新。
   */
  async push(dna: DNA, perception: Perception24D): Promise<void> {
    const calcium = computeCalcium(perception);

    const newEntry: WorkingEntry = {
      dna,
      perception,
      calciumScore: calcium.score,
      calciumLevel: calcium.level,
      createdAt: Date.now(),
    };

    // 检查新消息与 buffer 中最后一条消息的事件边界
    if (this.buffer.length > 0) {
      const lastEntry = this.buffer[this.buffer.length - 1];
      const boundary = detectEventBoundary(
        { dna: newEntry.dna, perception: newEntry.perception, timestamp: newEntry.createdAt },
        { dna: lastEntry.dna, perception: lastEntry.perception, timestamp: lastEntry.createdAt },
      );

      if (!boundary.isContinuation) {
        // 话题切换 → 为当前 buffer（已完成的事件）生成摘要并更新存储
        await this.finalizeCurrentEvent();
      }
    }

    this.buffer.push(newEntry);

    // buffer 超过阈值 → 强制收官
    if (this.buffer.length >= this.maxSize) {
      await this.finalizeCurrentEvent();
    }
  }

  /**
   * 为当前 buffer 中的事件生成摘要并更新存储记录。
   * 将多条同事件消息的存储记录更新为 event_summary + 聚合感知。
   */
  private async finalizeCurrentEvent(): Promise<void> {
    if (this.buffer.length <= 1) {
      this.buffer = [];
      return;
    }

    const entries = [...this.buffer];
    this.buffer = [];

    // 生成摘要 + 聚合感知
    const eventEntries: EventEntry[] = entries.map(e => ({
      dna: e.dna,
      perception: e.perception,
      calciumScore: e.calciumScore,
      calciumLevel: e.calciumLevel,
    }));
    const summary = summarizeEvent(eventEntries);

    try {
      // 用第一条消息的 branch_id 作为事件ID，更新其存储记录
      const firstId = entries[0].dna.branch_id;
      const sqlite = this.storage.getSQLite();
      const existing = sqlite.findById(firstId);
      if (existing) {
        existing.event_summary = summary.summary;
        existing.message_ids = entries.map(e => e.dna.branch_id);
        existing.source_message_count = entries.length;
        existing.perception = summary.aggregatePerception;
        existing.calcium_score = summary.aggregateCalcium.score;
        existing.calcium_level = summary.aggregateCalcium.level;
        existing.raw_input = summary.mergedRawInput;
        existing.entity_genes = summary.mergedEntities;
        sqlite.write(existing);
        console.log(`[WM] 事件聚合: ${entries.length} 条消息 → ${summary.summary}`);
      } else {
        console.log(`[WM] 未找到 ${firstId}，无法聚合`);
      }
    } catch (e) {
      console.error('[WM] 聚合失败:', e);
    }
  }

  /** 强制收官（关闭前调用） */
  async flushAll(): Promise<void> {
    await this.finalizeCurrentEvent();
    this.buffer = [];
  }

  getStatus(): { size: number; maxSize: number; utilization: number } {
    return {
      size: this.buffer.length,
      maxSize: this.maxSize,
      utilization: Math.round(this.buffer.length / this.maxSize * 100),
    };
  }
}
