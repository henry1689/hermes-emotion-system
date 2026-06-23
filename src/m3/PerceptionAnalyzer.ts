/**
 * PerceptionAnalyzer — 24维语义感知 + 钙质强度计算（v2.0 密度感知版）
 *
 * v2.0 核心变更：
 *   从「词频固定上限」升级为「信号密度感知」。
 *   24D 评分不再依赖文本长度——短句用密度估准，长文用情感弧量化。
 *   DNA 编码单元可以是任何长度（一句话/一段话/一篇文章），感知不受影响。
 *
 * Ref: 24维语义感知与钙质强度定义规范
 */
import type { DNA, EntityGene } from '../m1/types/dna.js';
import { loadSet } from '../m1/LexiconLoader.js';
const hitCounters = new Map<string, number>();
export function getHitReport(): Record<string,number> { return Object.fromEntries(hitCounters); }
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

const POSITIVE_WORDS = loadSet('emotion_lexicon.json', 'positive_words');
const NEGATIVE_WORDS = loadSet('emotion_lexicon.json', 'negative_words');
const HIGH_AROUSAL_WORDS = loadSet('emotion_lexicon.json', 'high_arousal');
const LOW_AROUSAL_WORDS = loadSet('emotion_lexicon.json', 'low_arousal');
const DOMINANT_WORDS = loadSet('emotion_lexicon.json', 'dominant');
const SUBMISSIVE_WORDS = loadSet('emotion_lexicon.json', 'submissive');
const AGGRESSION_WORDS = loadSet('emotion_lexicon.json', 'aggression');
const SINCERITY_WORDS = loadSet('emotion_lexicon.json', 'sincerity');
const HUMOR_WORDS = loadSet('emotion_lexicon.json', 'humor');
const CERTAIN_WORDS = loadSet('emotion_lexicon.json', 'certain');
const HEDGE_WORDS = loadSet('emotion_lexicon.json', 'hedge');
const LOGICAL_WORDS = loadSet('emotion_lexicon.json', 'logical');
const ABSTRACT_WORDS = loadSet('emotion_lexicon.json', 'abstract');
const TEMPORAL_PAST = loadSet('emotion_lexicon.json', 'temporal_past');
const TEMPORAL_FUTURE = loadSet('emotion_lexicon.json', 'temporal_future');
const INTIMACY_WORDS = loadSet('emotion_lexicon.json', 'intimacy');
const DEPENDENCY_WORDS = loadSet('emotion_lexicon.json', 'dependency');
const MORAL_POSITIVE = loadSet('emotion_lexicon.json', 'moral_positive');
const MORAL_NEGATIVE = loadSet('emotion_lexicon.json', 'moral_negative');
const ETIQUETTE_WORDS = loadSet('emotion_lexicon.json', 'etiquette');
const SEXUAL_ATTRACTION = loadSet('emotion_lexicon.json', 'sexual_attraction');
const SENSORY_CRAVING = loadSet('emotion_lexicon.json', 'sensory_craving');
const ENERGY_MERGE = loadSet('emotion_lexicon.json', 'energy_merge');
const ECSTASY_WORDS = loadSet('emotion_lexicon.json', 'ecstasy');

// 硬编码词表（不在 JSON 中）
const POSSESSIVENESS = new Set([
  '我的', '属于我', '不许', '不准', '吃醋', '嫉妒',
  '只有我', '专属', '独占',
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
// 第二层：密度感知辅助函数（替代旧 countHits + normalizeHits）
// ════════════════════════════════════════════════════════

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * 信号密度：每 100 字符中命中的关键词数量。
 * 替代旧的 countHits()——不随文本长度线性放大。
 * 中文 100 字 ≈ 一段话，作为密度基准单位。
 */
function signalDensity(text: string, wordSet: Set<string>): number {
  const charLen = text.length;
  if (charLen < 3) return 0;

  // 记录 hit 计数器（兼容老的调试报告）
  const key = [...wordSet].slice(0, 1).join('');
  if (key) {
    if (hitCounters.has(key)) hitCounters.set(key, hitCounters.get(key)! + 1);
    else hitCounters.set(key, 1);
  }

  let hits = 0;
  for (const word of wordSet) {
    if (text.includes(word)) hits++;
  }
  // 密度 = 每百字命中数
  return hits / (charLen / 100);
}

/**
 * 密度归一化：将信号密度映射到 [0, 1]。
 * threshold=3 意味着"每百字 3 个情感词 = 情感密集"的上界。
 */
function normalizeDensity(density: number, threshold: number = 3): number {
  return clamp(density / threshold, 0, 1);
}

/**
 * 密度比值：用于 bipolar 维度（愉悦度、支配度、道德审判等）。
 * 用密度而非绝对计数，避免长文本中随机噪声正负抵消的问题。
 *
 * 引入置信度衰减：当正负信号都很弱时结果趋向保守（不轻易判极性）；
 * 当信号密度高时趋向明确。避免短文本中偶然的正负各一词就完全抵消。
 */
function bipolarDensity(text: string, posSet: Set<string>, negSet: Set<string>): number {
  const pos = signalDensity(text, posSet);
  const neg = signalDensity(text, negSet);
  if (pos === 0 && neg === 0) return 0;
  const diff = pos - neg;
  const sum = pos + neg;
  // 纯极性方向
  const polarity = diff / Math.max(sum, 0.01);
  // 置信度：sum 越高，结果越自信；sum 低时保守倾向中性
  const confidence = sum / (sum + 0.8);
  return clamp(polarity * confidence, -1, 1);
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

/**
 * 情感弧检测 — 针对超长文本（500+ 字符）。
 * 将文本分割为句子，计算每句的情感密度，输出峰值、方向和波动度。
 */
interface EmotionalArc {
  /** 情感最密集的段落密度值（用于 M3 决策增强） */
  peakDensity: number;
  /** 情感弧方向：+1 渐强（越来越积极），-1 渐弱，0 平稳 */
  arcDirection: number;
  /** 情感波动度（标准差） */
  variance: number;
}

function detectEmotionalArc(text: string, wordSet: Set<string>): EmotionalArc {
  // 按句号/感叹号/问号/换行分割
  const segments = text.split(/[。！？\n\r]+/).filter(s => s.trim().length > 2);
  if (segments.length < 2) {
    return { peakDensity: signalDensity(text, wordSet), arcDirection: 0, variance: 0 };
  }

  const densities = segments.map(s => signalDensity(s, wordSet));
  const peakDensity = Math.max(...densities, 0);

  // 弧方向：后三分之一均值 - 前三分之一均值
  const thirdLen = Math.max(1, Math.floor(densities.length / 3));
  const firstThird = densities.slice(0, thirdLen).reduce((a, b) => a + b, 0) / thirdLen;
  const lastThird = densities.slice(-thirdLen).reduce((a, b) => a + b, 0) / thirdLen;
  const rawDir = lastThird - firstThird;
  const arcDirection = clamp(rawDir * 5, -1, 1); // 缩放因子使得方向更敏感

  // 方差
  const mean = densities.reduce((a, b) => a + b, 0) / densities.length;
  const variance = Math.sqrt(densities.reduce((sum, d) => sum + (d - mean) ** 2, 0) / densities.length);

  return { peakDensity, arcDirection, variance };
}

// ════════════════════════════════════════════════════════
// 第三层：24维评分引擎（密度感知版）
// ════════════════════════════════════════════════════════

class EmotionScorer {
  static pleasure(text: string): number {
    return bipolarDensity(text, POSITIVE_WORDS, NEGATIVE_WORDS);
  }

  static arousal(text: string): number {
    const highDensity = signalDensity(text, HIGH_AROUSAL_WORDS);
    const exclamationCount = (text.match(/！|!/g) || []).length;
    const exclamationDensity = exclamationCount / Math.max(text.length / 100, 1);
    const hasEmoji = /[😡😭😤🔥😍🥰😘😱]/g.test(text) ? 0.15 : 0;
    const lowDensity = signalDensity(text, LOW_AROUSAL_WORDS);
    let score = 0;
    score += normalizeDensity(highDensity, 3) * 0.5;
    score += clamp(exclamationDensity * 0.15, 0, 0.25);
    score += hasEmoji;
    if (lowDensity > 0) score = Math.max(0, score - normalizeDensity(lowDensity, 2) * 0.3);
    return clamp(score, 0, 1);
  }

  static dominance(text: string): number {
    return bipolarDensity(text, DOMINANT_WORDS, SUBMISSIVE_WORDS);
  }

  static aggression(text: string): number {
    return normalizeDensity(signalDensity(text, AGGRESSION_WORDS), 2);
  }

  static sincerity(text: string): number {
    const sincereDensity = signalDensity(text, SINCERITY_WORDS);
    const firstPersonDensity = countFirstPerson(text) / Math.max(text.length / 100, 1);
    let score = 0.5;
    score += normalizeDensity(sincereDensity, 3) * 0.3;
    score += clamp(firstPersonDensity * 0.03, 0, 0.2);
    return clamp(score, 0, 1);
  }

  static humor(text: string): number {
    return normalizeDensity(signalDensity(text, HUMOR_WORDS), 2);
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
    // 密度感知：长文本的篇幅不再自动增加 factual 分
    const factualDensity = signalDensity(text, new Set(['真实', '实际', '具体', '数据', '统计', '证据']));
    let score = 0.2;
    if (hasNumbers) score += 0.2;
    if (text.length > 50 && text.length < 500) score += 0.1; // 仅中等长度文本才加
    score += normalizeDensity(factualDensity, 2) * 0.2;
    const emoDensity = signalDensity(text, POSITIVE_WORDS) + signalDensity(text, NEGATIVE_WORDS);
    if (emoDensity > 5) score -= 0.2;
    return clamp(score, 0, 1);
  }

  static logical(text: string): number {
    return normalizeDensity(signalDensity(text, LOGICAL_WORDS), 3);
  }

  static certainty(text: string): number {
    const certain = signalDensity(text, CERTAIN_WORDS);
    const hedge = signalDensity(text, HEDGE_WORDS);
    let score = 0.5;
    score += normalizeDensity(certain, 2) * 0.3;
    score -= normalizeDensity(hedge, 2) * 0.4;
    return clamp(score, 0, 1);
  }

  static abstract(text: string): number {
    return normalizeDensity(signalDensity(text, ABSTRACT_WORDS), 2);
  }

  static temporalFocus(text: string): number {
    return bipolarDensity(text, TEMPORAL_FUTURE, TEMPORAL_PAST);
  }

  static selfRef(text: string): number {
    const density = countFirstPerson(text) / Math.max(text.length / 100, 1);
    return clamp(density * 0.12, 0, 1);
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
    return normalizeDensity(signalDensity(text, INTIMACY_WORDS), 3);
  }

  static powerDiff(text: string): number {
    return bipolarDensity(text, DOMINANT_WORDS, SUBMISSIVE_WORDS);
  }

  static dependency(text: string): number {
    return normalizeDensity(signalDensity(text, DEPENDENCY_WORDS), 3);
  }

  static moralJudgment(text: string): number {
    return bipolarDensity(text, MORAL_POSITIVE, MORAL_NEGATIVE);
  }

  static etiquette(text: string): number {
    return normalizeDensity(signalDensity(text, ETIQUETTE_WORDS), 3);
  }

  static belonging(text: string): number {
    const weDensity = countWe(text) / Math.max(text.length / 100, 1);
    const iDensity = countFirstPerson(text) / Math.max(text.length / 100, 1);
    let score = 0;
    if (weDensity > 0) score += clamp(weDensity * 0.15, 0, 0.6);
    if (iDensity > weDensity * 3) score *= 0.5;
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
    return normalizeDensity(signalDensity(text, SEXUAL_ATTRACTION), 3);
  }

  static sensoryCraving(text: string): number {
    return normalizeDensity(signalDensity(text, SENSORY_CRAVING), 3);
  }

  static energyMerge(text: string): number {
    return normalizeDensity(signalDensity(text, ENERGY_MERGE), 3);
  }

  static possessiveness(text: string): number {
    return normalizeDensity(signalDensity(text, POSSESSIVENESS), 2);
  }

  static ecstasy(text: string): number {
    return normalizeDensity(signalDensity(text, ECSTASY_WORDS), 2);
  }

  static safety(text: string): number {
    const safe = signalDensity(text, SAFETY_WORDS);
    const insecure = signalDensity(text, INSECURITY_WORDS);
    let score = 0.5;
    score += normalizeDensity(safe, 2) * 0.3;
    score -= normalizeDensity(insecure, 2) * 0.4;
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

export class PerceptionAnalyzer {
  analyze(dna: DNA): EnhancedDNA {
    const text = dna.raw_input;
    const emotion = EmotionScorer.all(text);
    const cognition = CognitionScorer.all(text);
    const social = SocialScorer.all(text);
    const intimacy = IntimacyScorer.all(text);
    const perception: Perception24D = { ...emotion, ...cognition, ...social, ...intimacy };
    const calcium = calculateCalcium(perception);

    // 对超长文本附加情感弧信息（通过 injectContext 可注入 M3 决策）
    const arcInfo = text.length > 500 ? detectEmotionalArc(text, POSITIVE_WORDS) : null;

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

  analyzeBatch(dnas: DNA[]): EnhancedDNA[] {
    return dnas.map((dna) => this.analyze(dna));
  }

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

  injectContext(enhanced: EnhancedDNA, context?: M3Context): void {
    if (!context) return;
    const text = enhanced.raw_input;

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

    if (context.current_location) {
      const hasLocalPlace = enhanced.entity_genes.some(
        (e) => e.type === 'place' && e.name === context.current_location
      );
      if (hasLocalPlace) {
        enhanced.perception.belonging = Math.min(enhanced.perception.belonging + 0.15, 1.0);
        enhanced.perception.intimacy = Math.min(enhanced.perception.intimacy + 0.1, 1.0);
      }
    }

    if (context.emotion_baseline) {
      const base = context.emotion_baseline;
      const pDelta = Math.abs(enhanced.perception.pleasure - base.avg_pleasure);
      const aDelta = Math.abs(enhanced.perception.arousal - base.avg_arousal);
      if (pDelta > 0.5 || aDelta > 0.4) {
        enhanced.perception.arousal = Math.min(enhanced.perception.arousal + 0.15, 1.0);
      }
    }
  }

  static describeLevel(level: CalciumLevel): string {
    switch (level) {
      case 0: return '粉末 — 忽略/合并';
      case 1: return '液体 — 流动/理解';
      case 2: return '固体 — 记忆/回应';
      case 3: return '晶体 — 刻录/行动';
    }
  }

  static recalculateCalcium(perception: Perception24D): CalciumResult {
    return calculateCalcium(perception);
  }
}
