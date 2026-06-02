// Ref: ARCH.md §3.1 L0 基因组锚点
// Ref: 架构决策备忘录 v1.1（修正版决策①）—— 纯规则路由，禁止LLM介入
// Ref: 架构决策备忘录 v1.2 —— 初始2层深度，版本化管理

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { L0RouteResult, TaxonomyTree } from './types/dna.js';

// ─── 当前文件所在目录 ───
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── 分类树配置路径 ───
const DEFAULT_TAXONOMY_PATH = join(__dirname, 'config', 'taxonomy_v1.json');

// ─── 默认兜底分类树（当文件缺失时使用）───
const FALLBACK_TAXONOMY: TaxonomyTree = {
  version: '0.0-fallback',
  description: '内存默认分类树（文件加载失败时启用）',
  tree: {
    user: {
      family: ['general'],
      emotion: ['neutral'],
      work: ['general'],
      misc: ['default'],
    },
  },
};

// ─── 关键词规则库 ───
// 每个规则包含：匹配关键词列表、目标domain、目标subcategory、规则ID
// Ref: ARCH.md §4.2 确定性路由核心逻辑

interface KeywordRule {
  id: string;
  keywords: string[];
  domain: string;
  subcategory: string;
  /** 权重优先级（数字越小优先级越高） */
  priority: number;
}

const KEYWORD_RULES: KeywordRule[] = [
  // ── Family domain ──
  { id: 'family-conflict-1', keywords: ['吵架', '争吵', '闹别扭', '冷战', '发脾气', '烦死了', '受不了'], domain: 'family', subcategory: 'conflict', priority: 1 },
  { id: 'family-conflict-2', keywords: ['催婚', '唠叨', '啰嗦', '逼我', '骂我', '重男轻女'], domain: 'family', subcategory: 'conflict', priority: 2 },
  { id: 'family-care-1', keywords: ['想家', '想念', '回家', '温暖', '爱你们', '感恩'], domain: 'family', subcategory: 'care', priority: 2 },
  { id: 'family-care-2', keywords: ['妈妈', '妈', '父亲', '爸', '父母', '照顾', '关心', '健康'], domain: 'family', subcategory: 'care', priority: 3 },
  { id: 'family-general-1', keywords: ['家庭', '家人', '亲戚', '家族', '家'], domain: 'family', subcategory: 'general', priority: 4 },

  // ── Work domain ──
  { id: 'work-stress-1', keywords: ['加班', '压力', '累死了', '辞职', '烦工作', '996', '内卷'], domain: 'work', subcategory: 'stress', priority: 1 },
  { id: 'work-stress-2', keywords: ['老板', '上司', '同事', '客户', '甲方'], domain: 'work', subcategory: 'stress', priority: 3 },
  { id: 'work-achievement-1', keywords: ['升职', '加薪', '项目成功', '完成', '通过', '录用', 'offer', '奖金'], domain: 'work', subcategory: 'achievement', priority: 2 },
  { id: 'work-general-1', keywords: ['工作', '上班', '公司', '项目', '会议', '开会', '出差', '办公室'], domain: 'work', subcategory: 'general', priority: 4 },

  // ── Emotion domain (negative) ──
  { id: 'emotion-negative-1', keywords: ['难过', '伤心', '痛苦', '绝望', '焦虑', '抑郁', '孤独', '失落', '崩溃', '无助'], domain: 'emotion', subcategory: 'negative', priority: 1 },
  { id: 'emotion-negative-2', keywords: ['生气', '愤怒', '不爽', '烦躁', '郁闷', '讨厌', '恶心', '烦'], domain: 'emotion', subcategory: 'negative', priority: 2 },
  { id: 'emotion-negative-3', keywords: ['害怕', '恐惧', '担心', '紧张', '不安', '慌'], domain: 'emotion', subcategory: 'negative', priority: 2 },
  { id: 'emotion-positive-1', keywords: ['开心', '幸福', '快乐', '兴奋', '感动', '满足', '甜蜜', '温暖', '美好'], domain: 'emotion', subcategory: 'positive', priority: 1 },
  { id: 'emotion-positive-2', keywords: ['太好了', '真棒', '厉害', '成功', '喜欢', '爱'], domain: 'emotion', subcategory: 'positive', priority: 2 },
  { id: 'emotion-neutral-1', keywords: ['觉得', '感觉', '心情', '情绪', '状态'], domain: 'emotion', subcategory: 'neutral', priority: 5 },

  // ── 强制兜底（优先级最低，无需关键词）──
  // misc.default handled in the router logic
];

/**
 * 加载认知分类树
 * 外部可注入自定义路径，默认从config目录加载
 * 文件缺失时使用内存默认树（不崩溃）
 * Ref: ARCH.md §4.2 确定性路由，架构决策备忘录 v1.2
 */
export function loadTaxonomy(customPath?: string): TaxonomyTree {
  const targetPath = customPath ?? DEFAULT_TAXONOMY_PATH;
  try {
    if (!existsSync(targetPath)) {
      console.warn(`[L0Router] taxonomy.json not found at ${targetPath}, using fallback.`);
      return FALLBACK_TAXONOMY;
    }
    const raw = readFileSync(targetPath, 'utf-8');
    const taxonomy: TaxonomyTree = JSON.parse(raw);

    // 校验基本结构
    if (!taxonomy.version || !taxonomy.tree) {
      throw new Error('Invalid taxonomy structure: missing version or tree');
    }

    return taxonomy;
  } catch (err) {
    console.warn(`[L0Router] Failed to load taxonomy: ${err instanceof Error ? err.message : String(err)}`);
    return FALLBACK_TAXONOMY;
  }
}

/**
 * 规范化输入文本：转小写、去除多余空白
 */
function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

/**
 * 检测文本是否包含任意关键词
 */
function matchesAny(text: string, keywords: string[]): boolean {
  const lowerText = text.toLowerCase();
  return keywords.some((kw) => lowerText.includes(kw.toLowerCase()));
}

/**
 * 统计匹配的规则，按优先级排序返回最佳匹配
 */
function findBestMatchingRule(text: string): { rule: KeywordRule; matchedKeywords: string[] } | null {
  const lowerText = text.toLowerCase();
  const matched: Array<{ rule: KeywordRule; matchedKeywords: string[] }> = [];

  for (const rule of KEYWORD_RULES) {
    const matchedKws = rule.keywords.filter((kw) => lowerText.includes(kw.toLowerCase()));
    if (matchedKws.length > 0) {
      matched.push({ rule, matchedKeywords: matchedKws });
    }
  }

  if (matched.length === 0) return null;

  // 按优先级排序（数字越小优先级越高）
  // 相同优先级下，匹配关键词数量越多越优先
  matched.sort((a, b) => {
    const priorityDiff = a.rule.priority - b.rule.priority;
    if (priorityDiff !== 0) return priorityDiff;
    return b.matchedKeywords.length - a.matchedKeywords.length;
  });

  return matched[0];
}

/**
 * 验证生成的locus_path是否存在于给定的分类树中
 * 如果不存在则回退到该domain的general子分类或misc
 * Ref: ARCH.md §4.2 降级兜底
 */
function validatePath(tree: TaxonomyTree, domain: string, subcategory: string): string {
  const domainNode = tree.tree['user']?.[domain];
  if (!domainNode) {
    return 'user.misc.default';
  }
  if (!domainNode.includes(subcategory)) {
    // domain存在但subcategory不存在，使用该domain的general或第一个可用节点
    if (domainNode.includes('general')) return `user.${domain}.general`;
    return `user.${domain}.${domainNode[0]}`;
  }
  return `user.${domain}.${subcategory}`;
}

/**
 * L0 基因组锚点生成器
 *
 * 基于规则和分类树的确定性路由，将用户话语映射到认知拓扑坐标。
 * 不含任何LLM调用，给定相同输入始终返回相同结果。
 *
 * @param utterance - 用户输入文本
 * @param taxonomyTree - 认知分类树（可选，默认从文件加载）
 * @returns L0路由结果
 *
 * Ref: ARCH.md §3.1 L0基因组锚点
 * Ref: 架构决策备忘录 v1.1（修正版）
 */
export function routeL0(
  utterance: string,
  taxonomyTree?: TaxonomyTree
): L0RouteResult {
  const tree = taxonomyTree ?? loadTaxonomy();
  const text = normalizeText(utterance);

  if (!text) {
    return {
      locus_path: 'user.misc.default',
      taxonomy_version: tree.version,
      rule_id: 'empty-input-fallback',
      is_fallback: true,
    };
  }

  // 第一阶段：尝试关键词规则匹配
  const bestMatch = findBestMatchingRule(text);

  if (bestMatch) {
    const { rule } = bestMatch;
    const locus_path = validatePath(tree, rule.domain, rule.subcategory);

    return {
      locus_path,
      taxonomy_version: tree.version,
      rule_id: rule.id,
      is_fallback: locus_path === 'user.misc.default',
    };
  }

  // 第二阶段：纯情感极性探测（当没有明确domain匹配时）
  // 尝试检测是否是纯情绪表达
  const strongNegative = ['难过', '伤心', '痛苦', '绝望', '生气', '愤怒', '崩溃', '哭'];
  const strongPositive = ['开心', '幸福', '快乐', '兴奋', '感动', '太好了'];

  const hasStrongNeg = strongNegative.some((w) => text.includes(w));
  const hasStrongPos = strongPositive.some((w) => text.includes(w));

  if (hasStrongNeg && !hasStrongPos) {
    const path = validatePath(tree, 'emotion', 'negative');
    return {
      locus_path: path,
      taxonomy_version: tree.version,
      rule_id: 'emotion-negative-fallback',
      is_fallback: false,
    };
  }
  if (hasStrongPos && !hasStrongNeg) {
    const path = validatePath(tree, 'emotion', 'positive');
    return {
      locus_path: path,
      taxonomy_version: tree.version,
      rule_id: 'emotion-positive-fallback',
      is_fallback: false,
    };
  }

  // 第三阶段：完全未匹配 → misc兜底
  return {
    locus_path: 'user.misc.default',
    taxonomy_version: tree.version,
    rule_id: 'misc-default-fallback',
    is_fallback: true,
  };
}
