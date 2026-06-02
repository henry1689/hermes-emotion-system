// PerceptionAnalyzer — 24维语义感知 + 钙质强度计算
// Ref: 24维语义感知与钙质强度定义规范
//
// ╔═══════════════════════════════════════════════════════╗
// ║  PerceptionAnalyzer.ts  v1.0                          ║
// ║  归属: M3 (逻辑决策层) — M1只做L0-L3编码             ║
// ║  变更: 从 M1 迁移至 M3 (架构纠偏)                    ║
// ║  原因: 24维感知是M3逻辑层的"眼睛"，不是M1编码层的"手" ║
// ║  日期: 2026-06-02                                    ║
// ╚═══════════════════════════════════════════════════════╝
//
// 设计原则:
// - 纯规则驱动，不调用任何LLM/ML模型
// - 所有评分基于关键词匹配 + 逻辑判断
// - 确定性：相同输入永远返回相同结果
// - 独立模块：只负责计算，不负责存储
//
// 调用时间: M2 存储完成后 → M3LogicOrchestrator 调用此分析器
// 不被 M1 调用，不在编码阶段执行

import type { DNA, EntityGene } from '../m1/types/dna.js';
import type {
  Perception24D,
  EnhancedDNA,
  CalciumResult,
  CalciumLevel,
  M3Context,
} from './types/perception.js';

// ════════════════════════════════════════════════════════
// 第一层：情感极性词表
// ════════════════════════════════════════════════════════

const POSITIVE_WORDS = new Set([
  '开心', '快乐', '幸福', '感动', '兴奋', '满足', '温暖',
  '甜蜜', '美好', '爱', '喜欢', '棒', '成功', '顺利',
  '感恩', '感谢', '珍惜', '赞', '优秀', '厉害',
  '满意', '舒适', '安心', '放松', '喜悦', '升职', '加薪', '好消息',
]);

const NEGATIVE_WORDS = new Set([
  '难过', '伤心', '痛苦', '绝望', '焦虑', '抑郁', '孤独',
  '失落', '崩溃', '无助', '生气', '愤怒', '烦躁', '郁闷',
  '讨厌', '恶心', '害怕', '恐惧', '紧张', '不安',
  '累', '难', '差', '糟', '失败', '压力', '折磨', '担心',
  'ICU', '癌症', '生病', '住院', '手术', '病危', '急救',
  '加班', '熬夜', '疲惫', '撑不住', '迷茫', '辛苦',
  '烦', '睡不着', '失眠', '难受', '疼痛',
]);

const HIGH_AROUSAL_WORDS = new Set([
  '崩溃', '绝望', '愤怒', '狂喜', '震惊', '吓死', '兴奋极了',
  '气死', '爱死', '受不了', '抓狂', '疯掉',
]);

const LOW_AROUSAL_WORDS = new Set([
  '平静', '放松', '安静', '困', '累', '疲倦', '淡然',
  '无所谓', '随便', '随意',
]);

const DOMINANT_WORDS = new Set([
  '必须', '一定', '绝对', '肯定', '要你', '给我', '命令',
  '要求', '我说了算', '听我的', '我决定',
]);

const SUBMISSIVE_WORDS = new Set([
  '求求你', '帮帮我', '听你的', '随便你', '你做主', '我不行',
  '没办法', '无力', '无可奈何', '只能',
]);

const AGGRESSION_WORDS = new Set([
  '去死', '滚', '杀了', '打你', '揍你', '废了你',
  '混蛋', '垃圾', '废物', '蠢', '傻逼',
]);

const SINCERITY_WORDS = new Set([
  '说实话', '真的', '其实', '心里话', '坦诚', '老实说',
  '欺骗', '说谎', '虚伪', '假装', '装',
]);

const HUMOR_WORDS = new Set([
  '哈哈', '呵呵', '玩笑', '开玩笑', '搞笑', '好笑',
  '逗你', '幽默',
]);

const CERTAIN_WORDS = new Set([
  '一定', '绝对', '肯定', '必然', '毫无疑问', '坚信', '确信',
]);

const HEDGE_WORDS = new Set([
  '可能', '大概', '也许', '或许', '好像', '似乎', '不一定',
  '说不定', '猜测', '估计',
]);

const LOGICAL_WORDS = new Set([
  '因为', '所以', '因此', '既然', '如果', '那么', '但是',
  '然而', '虽然', '不过', '而且', '并且',
]);

const ABSTRACT_WORDS = new Set([
  '人生', '命运', '意义', '哲学', '道理', '本质', '真理',
  '灵魂', '意识', '宇宙', '存在',
]);

const TEMPORAL_PAST = new Set([
  '以前', '曾经', '那时', '那年', '过去', '回忆', '往事',
  '怀旧', '后悔', '当初', '原来',
]);

const TEMPORAL_FUTURE = new Set([
  '以后', '将来', '未来', '打算', '计划', '希望', '憧憬',
  '梦想', '目标', '即将', '明天',
]);

const INTIMACY_WORDS = new Set([
  '悄悄话', '秘密', '只告诉你', '心里话', '最私密',
  '昵称', '宝贝', '亲爱的', '想你了',
]);

const DEPENDENCY_WORDS = new Set([
  '需要你', '离不开', '没有你', '陪伴', '一起', '陪着我',
  '想要你', '需要你',
]);

const MORAL_POSITIVE = new Set([
  '正义', '善良', '道德', '高尚', '伟大', '公正', '公平',
]);

const MORAL_NEGATIVE = new Set([
  '邪恶', '不公', '缺德', '卑鄙', '无耻', '恶心', '卑鄙',
]);

const ETIQUETTE_WORDS = new Set([
  '谢谢', '感谢', '请', '对不起', '抱歉', '不好意思',
  '劳驾', '打扰', '麻烦你', '您好',
]);

const SEXUAL_ATTRACTION = new Set([
  '性感', '迷人', '身材', '嘴唇', '眼睛', '触摸',
  '诱惑', '欲望', '想要你', '占有你',
]);

const SENSORY_CRAVING = new Set([
  '拥抱', '抱抱', '亲吻', '吻', '抚摸', '牵手',
  '靠近', '贴贴', '需要你',
]);

const ENERGY_MERGE = new Set([
  '心灵相通', '默契', '灵魂伴侣', '知己', '心意相通',
  '融合', '合一', '同频', '共振',
]);

const POSSESSIVENESS = new Set([
  '我的', '属于我', '不许', '不准', '吃醋', '嫉妒',
  '只有我', '专属', '独占',
]);

const ECSTASY_WORDS = new Set([
  '极致', '完美', '最幸福', '太棒了', '无与伦比',
  '天堂', '最美', '最快乐',
]);

const SAFETY_WORDS = new Set([
  '放心', '安心', '信任', '相信你', '安全', '踏实',
  '可靠', '稳妥', '不怕',
]);

const INSECURITY_WORDS = new Set([
  '害怕', '担心', '不安', '焦虑', '不信任', '怀疑',
  '恐惧', '慌', '没安全感',
]);

// ════════════════════════════════════════════════════════
// 第二层：辅助函数
// ════════════════════════════════════════════════════════

function countHits(text: string, wordSet: Set<string>): number {
  let hits = 0;
  for (const word of wordSet) {
    if (text.includes(word)) hits++;
  }
  return hits;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function normalizeHits(hits: number, max: number = 5): number {
  return clamp(hits / max, 0, 1);
}

function countFirstPerson(text: string): number {
  const patterns = ['我', '我自己', '我的', '我想', '我觉得', '我认为', '我感'];
  let count = 0;
  for (const p of patterns) {
    let idx = 0;
    while ((idx = text.indexOf(p, idx)) !== -1) {
      count++;
      idx += p.length;
    }
  }
  return count;
}

function countWe(text: string): number {
  const patterns = ['我们', '咱们', '大家一起', '我俩'];
  let count = 0;
  for (const p of patterns) {
    let idx = 0;
    while ((idx = text.indexOf(p, idx)) !== -1) {
      count++;
      idx += p.length;
    }
  }
  return count;
}

// ════════════════════════════════════════════════════════
// 第三层：24维评分引擎
// ════════════════════════════════════════════════════════

class EmotionScorer {
  static pleasure(text: string): number {
    const pos = countHits(text, POSITIVE_WORDS);
    const neg = countHits(text, NEGATIVE_WORDS);
    if (pos === 0 && neg === 0) return 0;
    const total = pos + neg;
    return clamp((pos - neg) / Math.max(total, 1), -1, 1);
  }

  static arousal(text: string): number {
    const high = countHits(text, HIGH_AROUSAL_WORDS);
    const low = countHits(text, LOW_AROUSAL_WORDS);
    const exclamationCount = (text.match(/！|!/g) || []).length;
    const hasEmoji = /[😡😭😤🔥😍🥰😘😱]/g.test(text);
    let score = 0;
    score += normalizeHits(high) * 0.5;
    score += clamp(exclamationCount * 0.1, 0, 0.3);
    if (hasEmoji) score += 0.2;
    if (low > 0) score = Math.max(0, score - normalizeHits(low) * 0.3);
    return clamp(score, 0, 1);
  }

  static dominance(text: string): number {
    const dom = countHits(text, DOMINANT_WORDS);
    const sub = countHits(text, SUBMISSIVE_WORDS);
    if (dom === 0 && sub === 0) return 0;
    const total = dom + sub;
    return clamp((dom - sub) / Math.max(total, 1), -1, 1);
  }

  static aggression(text: string): number {
    return normalizeHits(countHits(text, AGGRESSION_WORDS), 3);
  }

  static sincerity(text: string): number {
    const sincere = countHits(text, SINCERITY_WORDS);
    const firstPerson = countFirstPerson(text);
    let score = 0.5;
    score += normalizeHits(sincere) * 0.3;
    score += clamp(firstPerson * 0.05, 0, 0.2);
    return clamp(score, 0, 1);
  }

  static humor(text: string): number {
    return normalizeHits(countHits(text, HUMOR_WORDS), 3);
  }

  static all(text: string): Pick<Perception24D, 'pleasure' | 'arousal' | 'dominance' | 'aggression' | 'sincerity' | 'humor'> {
    return {
      pleasure: this.pleasure(text),
      arousal: this.arousal(text),
      dominance: this.dominance(text),
      aggression: this.aggression(text),
      sincerity: this.sincerity(text),
      humor: this.humor(text),
    };
  }
}

class CognitionScorer {
  static factual(text: string): number {
    const hasNumbers = /\d+/.test(text);
    let score = 0.2;
    if (hasNumbers) score += 0.3;
    if (text.length > 20) score += 0.2;
    if (text.length > 50) score += 0.1;
    const emoCount = countHits(text, POSITIVE_WORDS) + countHits(text, NEGATIVE_WORDS);
    if (emoCount > 3) score -= 0.2;
    return clamp(score, 0, 1);
  }

  static logical(text: string): number {
    return normalizeHits(countHits(text, LOGICAL_WORDS), 4);
  }

  static certainty(text: string): number {
    const certain = countHits(text, CERTAIN_WORDS);
    const hedge = countHits(text, HEDGE_WORDS);
    let score = 0.5;
    score += normalizeHits(certain, 3) * 0.3;
    score -= normalizeHits(hedge, 3) * 0.4;
    return clamp(score, 0, 1);
  }

  static abstract(text: string): number {
    return clamp(normalizeHits(countHits(text, ABSTRACT_WORDS), 3), 0, 1);
  }

  static temporalFocus(text: string): number {
    const past = countHits(text, TEMPORAL_PAST);
    const future = countHits(text, TEMPORAL_FUTURE);
    if (past === 0 && future === 0) return 0;
    return clamp((future - past) / Math.max(past + future, 1), -1, 1);
  }

  static selfRef(text: string): number {
    return clamp(countFirstPerson(text) * 0.15, 0, 1);
  }

  static all(text: string): Pick<Perception24D, 'factual' | 'logical' | 'certainty' | 'abstract' | 'temporal_focus' | 'self_ref'> {
    return {
      factual: this.factual(text),
      logical: this.logical(text),
      certainty: this.certainty(text),
      abstract: this.abstract(text),
      temporal_focus: this.temporalFocus(text),
      self_ref: this.selfRef(text),
    };
  }
}

class SocialScorer {
  static intimacy(text: string): number {
    return normalizeHits(countHits(text, INTIMACY_WORDS), 3);
  }

  static powerDiff(text: string): number {
    const dom = countHits(text, DOMINANT_WORDS);
    const sub = countHits(text, SUBMISSIVE_WORDS);
    if (dom === 0 && sub === 0) return 0;
    return clamp((dom - sub) / Math.max(dom + sub, 1), -1, 1);
  }

  static dependency(text: string): number {
    return normalizeHits(countHits(text, DEPENDENCY_WORDS), 3);
  }

  static moralJudgment(text: string): number {
    const pos = countHits(text, MORAL_POSITIVE);
    const neg = countHits(text, MORAL_NEGATIVE);
    if (pos === 0 && neg === 0) return 0;
    return clamp((pos - neg) / Math.max(pos + neg, 1), -1, 1);
  }

  static etiquette(text: string): number {
    return normalizeHits(countHits(text, ETIQUETTE_WORDS), 4);
  }

  static belonging(text: string): number {
    const weCount = countWe(text);
    const iCount = countFirstPerson(text);
    let score = 0;
    if (weCount > 0) score += clamp(weCount * 0.2, 0, 0.6);
    if (iCount > weCount * 3) score *= 0.5;
    return clamp(score, 0, 1);
  }

  static all(text: string): Pick<Perception24D, 'intimacy' | 'power_diff' | 'dependency' | 'moral_judgment' | 'etiquette' | 'belonging'> {
    return {
      intimacy: this.intimacy(text),
      power_diff: this.powerDiff(text),
      dependency: this.dependency(text),
      moral_judgment: this.moralJudgment(text),
      etiquette: this.etiquette(text),
      belonging: this.belonging(text),
    };
  }
}

class IntimacyScorer {
  static sexualAttraction(text: string): number {
    return normalizeHits(countHits(text, SEXUAL_ATTRACTION), 3);
  }

  static sensoryCraving(text: string): number {
    return normalizeHits(countHits(text, SENSORY_CRAVING), 3);
  }

  static energyMerge(text: string): number {
    return normalizeHits(countHits(text, ENERGY_MERGE), 3);
  }

  static possessiveness(text: string): number {
    return normalizeHits(countHits(text, POSSESSIVENESS), 3);
  }

  static ecstasy(text: string): number {
    return normalizeHits(countHits(text, ECSTASY_WORDS), 3);
  }

  static safety(text: string): number {
    const safe = countHits(text, SAFETY_WORDS);
    const insecure = countHits(text, INSECURITY_WORDS);
    let score = 0.5;
    score += normalizeHits(safe) * 0.3;
    score -= normalizeHits(insecure) * 0.4;
    return clamp(score, 0, 1);
  }

  static all(text: string): Pick<Perception24D, 'sexual_attraction' | 'sensory_craving' | 'energy_merge' | 'possessiveness' | 'ecstasy' | 'safety'> {
    return {
      sexual_attraction: this.sexualAttraction(text),
      sensory_craving: this.sensoryCraving(text),
      energy_merge: this.energyMerge(text),
      possessiveness: this.possessiveness(text),
      ecstasy: this.ecstasy(text),
      safety: this.safety(text),
    };
  }
}

// ════════════════════════════════════════════════════════
// 第四层：钙质强度计算
// ════════════════════════════════════════════════════════

function calculateCalcium(p: Perception24D): CalciumResult {
  const avgEmotion = (
    Math.abs(p.pleasure) + p.arousal + Math.abs(p.dominance) +
    p.aggression + p.sincerity + p.humor
  ) / 6;
  const avgCognition = (
    p.factual + p.logical + p.certainty + p.abstract +
    Math.abs(p.temporal_focus) + p.self_ref
  ) / 6;
  const baseCore = avgEmotion * 0.3 + avgCognition * 0.3;

  const emotionalBoost = Math.max(
    Math.abs(p.pleasure), p.arousal, Math.abs(p.dominance), p.aggression
  ) * 0.4;

  const threatBonus =
    (p.aggression > 0.7 || p.safety < 0.2 || p.sexual_attraction > 0.8)
      ? 0.3 : 0.0;

  const score = clamp(baseCore + emotionalBoost + threatBonus, 0, 1);

  let level: CalciumLevel;
  if (score < 0.3) level = 0;
  else if (score < 0.6) level = 1;
  else if (score < 0.8) level = 2;
  else level = 3;

  return {
    score,
    level,
    breakdown: {
      base_core: Math.round(baseCore * 1000) / 1000,
      emotional_boost: Math.round(emotionalBoost * 1000) / 1000,
      threat_bonus: Math.round(threatBonus * 1000) / 1000,
    },
  };
}

// ════════════════════════════════════════════════════════
// 第五层：PerceptionAnalyzer 主类
// ════════════════════════════════════════════════════════

/**
 * 感知分析器 — 将 M1 原始 DNA 增强为 EnhancedDNA
 *
 * 这是一个 M3 逻辑层的工具类，不在 M1 编码阶段执行。
 * 由 M3LogicOrchestrator 在 M2 存储完成后调用。
 *
 * 输入: DNA 对象（branch_id, locus_path, raw_input, entity_genes）
 * 输出: EnhancedDNA 对象（含 24 维感知 + 钙质强度）
 *
 * 三步走算法:
 * 1. 语境剥离 (Context Stripping): 忽略位置信息，只看 raw_input
 * 2. 情感着色 (Emotional Coloring): 结合语气词和实体基因
 * 3. 潜意识扫描 (Subconscious Scanning): 代词和隐喻扫描
 *
 * Ref: 24维语义感知与钙质强度定义规范 §第三部分
 */
export class PerceptionAnalyzer {
  /**
   * 分析一条 DNA，产出增强型 DNA
   */
  analyze(dna: DNA): EnhancedDNA {
    const text = dna.raw_input;
    const emotion = EmotionScorer.all(text);
    const cognition = CognitionScorer.all(text);
    const social = SocialScorer.all(text);
    const intimacy = IntimacyScorer.all(text);
    const perception: Perception24D = { ...emotion, ...cognition, ...social, ...intimacy };
    const calcium = calculateCalcium(perception);

    return {
      branch_id: dna.branch_id,
      locus_path: dna.locus_path,
      raw_input: dna.raw_input,
      entity_genes: dna.entity_genes,
      perception,
      calcium_score: calcium.score,
      calcium_level: calcium.level,
    };
  }

  /** 批量分析多条 DNA */
  analyzeBatch(dnas: DNA[]): EnhancedDNA[] {
    return dnas.map((dna) => this.analyze(dna));
  }

  /** 直接分析原始文本（快捷方式，仅用于测试/调试） */
  analyzeText(text: string): EnhancedDNA {
    const mockDNA: DNA = {
      locus_path: 'user.misc.default',
      taxonomy_version: '1.0',
      branch_id: 'evt_00000000_000',
      seq_pos: 0,
      leaf_zone: 'language_semantic_zone',
      ref: 'tmp_na_00000',
      entity_genes: [],
      raw_input: text,
      created_at: new Date().toISOString(),
    };
    return this.analyze(mockDNA);
  }

  /**
   * 注入决策上下文到增强型 DNA 中
   *
   * 根据 M3Context 中的时间、地点信息，修正感知维度。
   *
   * Ref: M3-design-v1.md §4.2
   */
  injectContext(enhanced: EnhancedDNA, context?: M3Context): void {
    if (!context) return;

    const text = enhanced.raw_input;

    // 时效性规则：时间词修正 C5 temporal_focus
    if (text.includes('今天') || text.includes('现在')) {
      enhanced.perception.temporal_focus = Math.max(enhanced.perception.temporal_focus, 0.2);
    }
    if (text.includes('刚才') || text.includes('刚刚')) {
      enhanced.perception.arousal = Math.min(enhanced.perception.arousal + 0.1, 1.0);
    }
    if (text.includes('明天') || text.includes('将来') || text.includes('以后')) {
      enhanced.perception.temporal_focus = Math.max(enhanced.perception.temporal_focus, 0.3);
    }
    if (text.includes('以前') || text.includes('过去') || text.includes('曾经')) {
      enhanced.perception.temporal_focus = Math.min(enhanced.perception.temporal_focus, -0.2);
    }

    // 地点感知规则：本地地点提升 S6 belonging
    if (context.current_location) {
      const hasLocalPlace = enhanced.entity_genes.some(
        (e) => e.type === 'place' && e.name === context.current_location
      );
      if (hasLocalPlace) {
        enhanced.perception.belonging = Math.min(enhanced.perception.belonging + 0.15, 1.0);
        enhanced.perception.intimacy = Math.min(enhanced.perception.intimacy + 0.1, 1.0);
      }
    }

    // 情感基线异常检测
    if (context.emotion_baseline) {
      const base = context.emotion_baseline;
      const pDelta = Math.abs(enhanced.perception.pleasure - base.avg_pleasure);
      const aDelta = Math.abs(enhanced.perception.arousal - base.avg_arousal);
      if (pDelta > 0.5 || aDelta > 0.4) {
        enhanced.perception.arousal = Math.min(enhanced.perception.arousal + 0.15, 1.0);
      }
    }
  }

  /** 获取钙质强度的中文描述 */
  static describeLevel(level: CalciumLevel): string {
    switch (level) {
      case 0: return '粉末 — 忽略/合并';
      case 1: return '液体 — 流动/理解';
      case 2: return '固体 — 记忆/回应';
      case 3: return '晶体 — 刻录/行动';
    }
  }

  /** 根据感知向量重新计算钙质强度（在 injectContext 后调用） */
  static recalculateCalcium(perception: Perception24D): CalciumResult {
    return calculateCalcium(perception);
  }
}
