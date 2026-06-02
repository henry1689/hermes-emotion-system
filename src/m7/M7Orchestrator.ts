// M7 M7Orchestrator — 空闲时段批量处理
// Ref: docs/M7-design-v1.md §3-§6

import { DreamQueue } from './DreamQueue.js';
import { DreamInternalizer } from './DreamInternalizer.js';
import { ClueTracker } from './ClueTracker.js';
import type { M8Engine } from '../m8/M8Engine.js';

export class M7Orchestrator {
  public queue: DreamQueue;
  public internalizer: DreamInternalizer;
  public tracker: ClueTracker;

  constructor(m8: M8Engine) {
    this.queue = new DreamQueue();
    this.internalizer = new DreamInternalizer(this.queue, m8);
    this.tracker = new ClueTracker();
  }

  /** 空闲时段批处理 */
  async processIdle(): Promise<{ internalized: number; advice: string[] }> {
    const results = await this.internalizer.internalizeBatch();
    this.internalizer.discardStale();
    const advice = this.tracker.generateAdvice();
    return { internalized: results.length, advice };
  }
}
