/**
 * EventDetector — 事件边界检测器
 *
 * 判断两条连续消息是否属于同一语义事件。
 * 纯函数，零状态，零 LLM，复用现有 24D 感知 + 实体基因。
 *
 * 认知依据:
 * - 同一事件内: 话题一致(locus_path)，实体重叠，情感连贯
 * - 事件边界: 话题切换，实体集变化，情感突转，时间断裂
 *
 * 使用方式:
 *   const boundary = detectEventBoundary(currentMsg, prevMsg);
 *   if (!boundary.isContinuation) { // 新事件开始 }
 */
import type { DNA } from '../m1/types/dna.js';
import type { Perception24D } from '../m3/types/perception.js';
import { emotionalSimilarity } from './math.js';

export interface EventBoundarySignals {
  /** true = 属于同一事件，false = 新事件开始 */
  isContinuation: boolean;
  /** 置信度 0..1 */
  confidence: number;
  signals: {
    /** locus_path 前缀是否匹配 */
    locusMatch: boolean;
    /** 实体集 Jaccard 相似度 */
    entityOverlap: number;
    /** 情感向量余弦相似度 (0..1) */
    perceptionSimilarity: number;
    /** 时间间隔（秒） */
    temporalGapSeconds: number;
  };
}

export interface MessageSnapshot {
  dna: DNA;
  perception: Perception24D;
  timestamp: number; // Date.now() 或 Date.parse(created_at)
}

/**
 * 检测两条连续消息之间是否存在事件边界。
 *
 * @param current  当前消息
 * @param previous 前一条消息（同一会话中）
 * @returns 边界检测信号
 */
export function detectEventBoundary(
  current: MessageSnapshot,
  previous: MessageSnapshot,
): EventBoundarySignals {
  // ── 信号 1: locus_path 前缀匹配 ──
  const curLocus = current.dna.locus_path;
  const prevLocus = previous.dna.locus_path;
  // 取共同前缀（如 user.family 和 user.family.conflict → 匹配）
  const minLen = Math.min(curLocus.length, prevLocus.length);
  const commonPrefix = curLocus.substring(0, minLen);
  const locusMatch = commonPrefix.length > 0 && prevLocus.startsWith(commonPrefix);

  // ── 信号 2: 实体 Jaccard 重叠 ──
  const curEntities = new Set(current.dna.entity_genes.map(e => e.name));
  const prevEntities = new Set(previous.dna.entity_genes.map(e => e.name));
  let entityOverlap = 0;
  const union = new Set([...curEntities, ...prevEntities]);
  if (union.size > 0) {
    const intersection = [...curEntities].filter(e => prevEntities.has(e));
    entityOverlap = intersection.length / union.size;
  }

  // ── 信号 3: 情感相似度 ──
  const perceptionSimilarity = emotionalSimilarity(
    current.perception,
    previous.perception,
    'balanced',
  );

  // ── 信号 4: 时间间隔 ──
  const temporalGapSeconds = Math.max(0, (current.timestamp - previous.timestamp) / 1000);

  // ── 综合决策 ──
  // 计算 locus 匹配深度（按段计数，如 "user.work" = 2 段）
  const curSegments = curLocus.split('.').filter(Boolean);
  const prevSegments = prevLocus.split('.').filter(Boolean);
  let locusDepth = 0;
  for (let i = 0; i < Math.min(curSegments.length, prevSegments.length); i++) {
    if (curSegments[i] === prevSegments[i]) locusDepth++;
    else break;
  }
  const exactLocusMatch = curLocus === prevLocus;

  // 强信号：话题相同（≥2段匹配）+ 情感相似度高
  const topicStrong = locusDepth >= 2 && perceptionSimilarity > 0.4;
  // 话题连续：话题路径匹配（同一个话题下）
  const topicContinuation = exactLocusMatch || locusDepth >= 2;
  // 强间断：话题不同且无实体重叠 → 边界
  const topicShift = !locusMatch && entityOverlap === 0;
  // 时间断裂：超过 5 分钟
  const temporalBreak = temporalGapSeconds > 300;
  // 情感突转：同一话题下情感剧变
  const emotionalFlip = perceptionSimilarity < 0.15 && topicContinuation && entityOverlap === 0;

  // 加权投票
  let score = 0;
  if (topicStrong) score += 0.4;
  if (topicContinuation) score += 0.25;  // 同话题路径就是强信号
  if (entityOverlap > 0.2) score += 0.25;
  if (perceptionSimilarity > 0.35) score += 0.15;
  if (temporalGapSeconds < 30) score += 0.1;

  // 阻断信号
  if (topicShift && temporalBreak) {
    return { isContinuation: false, confidence: 0.9, signals: { locusMatch, entityOverlap, perceptionSimilarity, temporalGapSeconds } };
  }
  if (temporalBreak && entityOverlap === 0 && !topicContinuation) {
    return { isContinuation: false, confidence: 0.8, signals: { locusMatch, entityOverlap, perceptionSimilarity, temporalGapSeconds } };
  }
  if (emotionalFlip && temporalBreak) {
    return { isContinuation: false, confidence: 0.7, signals: { locusMatch, entityOverlap, perceptionSimilarity, temporalGapSeconds } };
  }

  // 正常判定（阈值降低到 0.35）
  const isContinuation = score >= 0.35;
  return {
    isContinuation,
    confidence: Math.min(1, Math.max(0, score + (isContinuation ? 0.1 : -0.1))),
    signals: { locusMatch, entityOverlap, perceptionSimilarity, temporalGapSeconds },
  };
}

/**
 * 将一组消息按事件边界分组。
 * 每条消息依次与上一条比较，边界处切分新组。
 */
export function groupByEvents(
  messages: MessageSnapshot[],
): MessageSnapshot[][] {
  if (messages.length === 0) return [];
  if (messages.length === 1) return [[messages[0]]];

  const groups: MessageSnapshot[][] = [[messages[0]]];
  for (let i = 1; i < messages.length; i++) {
    const boundary = detectEventBoundary(messages[i], messages[i - 1]);
    if (boundary.isContinuation) {
      // 追加到当前事件组
      groups[groups.length - 1].push(messages[i]);
    } else {
      // 新事件开始
      groups.push([messages[i]]);
    }
  }
  return groups;
}
