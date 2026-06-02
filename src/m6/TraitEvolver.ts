// M6 TraitEvolver — 特质偏移计算引擎
// Ref: docs/M6-design-v1.md §3.1

import type { SelfModelTraits, EvolutionSignal, EvolutionDecision } from './types/index.js';
import { SelfModelManager } from './SelfModelManager.js';

const NORMALIZATION: Record<string, number> = {
  openness: 0.5,
  conscientiousness: 0.5,
  extraversion: 0.4,
  agreeableness: 0.3,
  neuroticism: 0.3,
};

function clamp(v: number): number { return Math.max(0, Math.min(1, v)); }

export class TraitEvolver {
  private manager: SelfModelManager;
  private feedbackBuffer: EvolutionSignal[] = [];

  constructor(manager: SelfModelManager) {
    this.manager = manager;
  }

  /** 添加反馈信号 */
  addFeedback(signal: EvolutionSignal): void {
    this.feedbackBuffer.push(signal);
  }

  /** 获取同类反馈计数 */
  private countSimilar(dimension: string): number {
    return this.feedbackBuffer.filter(f => f.dimension === dimension).length;
  }

  /** 计算当前强度（最近反馈的 E1 均值） */
  private avgE1(dimension: string): number {
    const signals = this.feedbackBuffer.filter(f => f.dimension === dimension);
    if (signals.length === 0) return 0;
    return signals.reduce((s, f) => s + f.e1_pleasure, 0) / signals.length;
  }

  /** 提议演化，返回决策 */
  proposeEvolution(dimension: string, direction: 'increase' | 'decrease', delta: number): EvolutionDecision {
    // 底线锁定
    if (!this.manager.checkCoreIdentity(dimension, direction)) {
      return { applied: false, level: 'blocked', reason: 'CORE_IDENTITY_ANCHOR：核心身份不可修改' };
    }

    const count = this.countSimilar(dimension);
    const avgE1 = this.avgE1(dimension);

    // 小幅自动 (≤5%)
    if (delta <= 5) {
      if (count >= 5 && avgE1 > 0.4) {
        const traits = this.manager.getTraits();
        const key = dimension as keyof SelfModelTraits;
        const oldVal = traits[key];
        const step = direction === 'increase' ? delta / 100 : -delta / 100;
        traits[key] = clamp(oldVal + step);
        this.manager.updateTraits(traits);
        return { applied: true, level: 'auto', reason: `小幅自动微调 ${dimension} ${direction} ${delta}%`, oldValue: oldVal, newValue: traits[key] };
      }
      return { applied: false, level: 'auto', reason: `信号不足: need≥5, have=${count}` };
    }

    // 中幅软化 (5-15%)
    if (delta <= 15) {
      if (count >= 15) {
        return { applied: false, level: 'soften', reason: `中幅调整需梦境试探: ${dimension} ${direction} ${delta}%` };
      }
      return { applied: false, level: 'soften', reason: `信号不足: need≥15, have=${count}` };
    }

    // 大幅阻塞 (>15%)
    return { applied: false, level: 'blocked', reason: `大幅调整(>15%)需M7梦境确认 + M8历史仲裁` };
  }

  /** 执行已确认的大幅演化 */
  applyConfirmed(dimension: string, direction: 'increase' | 'decrease', delta: number): EvolutionDecision {
    if (!this.manager.checkCoreIdentity(dimension, direction)) {
      return { applied: false, level: 'blocked', reason: 'CORE_IDENTITY_ANCHOR' };
    }
    const traits = this.manager.getTraits();
    const key = dimension as keyof SelfModelTraits;
    const oldVal = traits[key];
    const step = direction === 'increase' ? delta / 100 : -delta / 100;
    traits[key] = clamp(oldVal + step);
    this.manager.updateTraits(traits);
    return { applied: true, level: 'auto', reason: `梦境确认后已演化 ${dimension}`, oldValue: oldVal, newValue: traits[key] };
  }

  getBufferSize(): number { return this.feedbackBuffer.length; }
  clearBuffer(): void { this.feedbackBuffer = []; }
}
