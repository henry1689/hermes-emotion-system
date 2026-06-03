// Ref: ARCH.md §3.1 L3 实体基因槽 — entity_genes
// Ref: ARCH.md §4.2 编码时 entity_genes 标注 phenotype / knowledge_type
// Ref: 设计意图宣言 §4 AI自我模型四大支柱

import type {
  EntityGene,
  EntityType,
  PhenotypeLabel,
  L3AnnotationResult,
  SelfModelV1,
} from './types/dna.js';

/**
 * 实体提取规则：带规范化名称的匹配规则
 * 每个规则包含：
 * - name: 规范化后的实体名称（DNA中存储的值）
 * - type: 实体类型
 * - patterns: 在输入文本中匹配的关键词（匹配任意一个即触发）
 * Ref: ARCH.md §4.2 确定性路由
 */
interface NormalizedEntityRule {
  name: string;
  type: EntityType;
  patterns: string[];
}

const ENTITY_EXTRACTION_RULES: NormalizedEntityRule[] = [
  // ── Self ──
  { name: '我', type: 'self', patterns: ['我'] },

  // ── Person — 亲属关系 ──
  { name: '妈妈', type: 'person', patterns: ['妈妈', '妈'] },
  { name: '爸爸', type: 'person', patterns: ['爸爸', '爸'] },
  { name: '母亲', type: 'person', patterns: ['母亲'] },
  { name: '父亲', type: 'person', patterns: ['父亲'] },
  { name: '爷爷', type: 'person', patterns: ['爷爷'] },
  { name: '奶奶', type: 'person', patterns: ['奶奶'] },
  { name: '外公', type: 'person', patterns: ['外公'] },
  { name: '外婆', type: 'person', patterns: ['外婆'] },
  { name: '哥哥', type: 'person', patterns: ['哥哥'] },
  { name: '弟弟', type: 'person', patterns: ['弟弟'] },
  { name: '姐姐', type: 'person', patterns: ['姐姐'] },
  { name: '妹妹', type: 'person', patterns: ['妹妹'] },
  { name: '老公', type: 'person', patterns: ['老公'] },
  { name: '老婆', type: 'person', patterns: ['老婆'] },
  { name: '男朋友', type: 'person', patterns: ['男朋友'] },
  { name: '女朋友', type: 'person', patterns: ['女朋友'] },
  { name: '亲戚', type: 'person', patterns: ['亲戚'] },
  { name: '姑姑', type: 'person', patterns: ['姑姑'] },
  { name: '舅舅', type: 'person', patterns: ['舅舅'] },
  { name: '阿姨', type: 'person', patterns: ['阿姨'] },
  { name: '叔叔', type: 'person', patterns: ['叔叔'] },
  { name: '朋友', type: 'person', patterns: ['朋友', '好友'] },
  { name: '同事', type: 'person', patterns: ['同事'] },
  { name: '同学', type: 'person', patterns: ['同学'] },
  { name: '室友', type: 'person', patterns: ['室友'] },
  { name: '老板', type: 'person', patterns: ['老板', '上司', '领导'] },

  // ── Emotion ──
  { name: '开心', type: 'emotion', patterns: ['开心'] },
  { name: '快乐', type: 'emotion', patterns: ['快乐'] },
  { name: '幸福', type: 'emotion', patterns: ['幸福'] },
  { name: '感动', type: 'emotion', patterns: ['感动'] },
  { name: '兴奋', type: 'emotion', patterns: ['兴奋'] },
  { name: '满足', type: 'emotion', patterns: ['满足'] },
  { name: '难过', type: 'emotion', patterns: ['难过'] },
  { name: '伤心', type: 'emotion', patterns: ['伤心'] },
  { name: '痛苦', type: 'emotion', patterns: ['痛苦'] },
  { name: '焦虑', type: 'emotion', patterns: ['焦虑'] },
  { name: '抑郁', type: 'emotion', patterns: ['抑郁'] },
  { name: '孤独', type: 'emotion', patterns: ['孤独'] },
  { name: '失落', type: 'emotion', patterns: ['失落'] },
  { name: '崩溃', type: 'emotion', patterns: ['崩溃'] },
  { name: '愤怒', type: 'emotion', patterns: ['愤怒', '生气'] },
  { name: '烦躁', type: 'emotion', patterns: ['烦躁', '烦'] },
  { name: '害怕', type: 'emotion', patterns: ['害怕'] },
  { name: '紧张', type: 'emotion', patterns: ['紧张'] },
  { name: '喜欢', type: 'emotion', patterns: ['喜欢'] },
  { name: '爱', type: 'emotion', patterns: ['爱'] },

  // ── Event ──
  { name: '结婚', type: 'event', patterns: ['结婚'] },
  { name: '工作', type: 'event', patterns: ['工作', '上班'] },
  { name: '考试', type: 'event', patterns: ['考试', '面试'] },
  { name: '搬家', type: 'event', patterns: ['搬家'] },
  { name: '旅行', type: 'event', patterns: ['旅行', '旅游'] },
  { name: '聚会', type: 'event', patterns: ['聚会'] },
  { name: '吵架', type: 'event', patterns: ['吵架', '争吵'] },
  { name: '分手', type: 'event', patterns: ['分手'] },
  { name: '约会', type: 'event', patterns: ['约会'] },

  // ── Place ──
  { name: '家', type: 'place', patterns: ['家'] },
  { name: '公司', type: 'place', patterns: ['公司', '办公室'] },
  { name: "北京", type: "place", patterns: ["北京"] },
  { name: "上海", type: "place", patterns: ["上海"] },
  { name: "深圳", type: "place", patterns: ["深圳"] },

  // ── Object ──
  { name: '礼物', type: 'object', patterns: ['礼物'] },
  { name: '宠物', type: 'object', patterns: ['猫', '狗', '宠物'] },
  { name: '花', type: 'object', patterns: ['花'] },
  { name: '书', type: 'object', patterns: ['书'] },

  // ── Hobby / Creativity ──
  { name: '画画', type: 'object', patterns: ['画画', '画国画', '画山水', '画人物', '绘画', '作画'] },
  { name: '国画', type: 'object', patterns: ['国画', '水墨画', '工笔', '写意'] },
  { name: '摄影', type: 'object', patterns: ['摄影', '拍照', '相机'] },
  { name: '音乐', type: 'object', patterns: ['音乐', '弹琴', '吉他', '钢琴', '唱歌'] },
  { name: '运动', type: 'object', patterns: ['运动', '跑步', '健身', '游泳', '打球', '篮球', '足球'] },
  { name: '游戏', type: 'object', patterns: ['游戏', '打游戏', '玩'] },
  { name: '烹饪', type: 'object', patterns: ['烹饪', '做饭', '做菜', '厨艺', '烘焙'] },
];

/**
 * 情感极性词表，用于 phenotype 标注
 * 当实体与正面词共现时标注 enhance，与负面词共现时标注 conflict
 */
export const POSITIVE_WORDS = new Set([
  '开心', '快乐', '幸福', '感动', '兴奋', '满足', '温暖',
  '甜蜜', '美好', '爱', '喜欢', '棒', '成功', '顺利',
  '感恩', '感谢', '珍惜',
]);

export const NEGATIVE_WORDS = new Set([
  '难过', '伤心', '痛苦', '绝望', '焦虑', '抑郁', '孤独',
  '失落', '崩溃', '无助', '生气', '愤怒', '烦躁', '郁闷',
  '讨厌', '恶心', '害怕', '恐惧', '担心', '紧张', '不安',
  '烦', '累', '难', '差', '糟', '失败', '压力',
]);

/**
 * 简单的规则式命名实体识别器
 * 提取文本中匹配预定义模式的实体
 * Ref: ARCH.md §4.2 三源融合 — 写入时实体提取
 */
class SimpleEntityExtractor {
  extract(text: string): Array<{ name: string; type: EntityType; allele: string }> {
    const found: Array<{ name: string; type: EntityType; allele: string }> = [];
    const seen = new Set<string>(); // 去重（按规范化名称+类型）

    const lowerText = text.toLowerCase();

    for (const rule of ENTITY_EXTRACTION_RULES) {
      // 检查是否有任意模式匹配
      const matchedPattern = rule.patterns.find((pat) =>
        lowerText.includes(pat.toLowerCase())
      );

      if (matchedPattern) {
        const dedupKey = `${rule.type}:${rule.name}`;
        if (!seen.has(dedupKey)) {
          seen.add(dedupKey);
          found.push({
            name: rule.name,
            type: rule.type,
            allele: matchedPattern, // 实际匹配的文本片段
          });
        }
      }
    }

    return found;
  }
}

/**
 * L3 实体标注器
 *
 * 使用规则驱动的方式完成：
 * 1. NER 实体提取（关键词模式匹配）
 * 2. phenotype 标注（基于情感极性 + 自我模型比对）
 * 3. knowledge_type 分类（默认private，特定类型映射到family/world）
 *
 * Ref: ARCH.md §3.1 L3 实体基因槽
 * Ref: 架构决策备忘录 v1.1 — 禁止LLM介入
 */
export class L3EntityAnnotator {
  private extractor = new SimpleEntityExtractor();

  /**
   * 判断实体的 phenotype（对自我模型的影响方向）
   *
   * 策略：
   * 1. 如果实体在上下文中与正面情感词共现 → enhance
   * 2. 如果与负面情感词共现 → conflict
   * 3. 如果实体与self_model.narrative_identity一致 → enhance
   * 4. 其他情况 → neutral
   *
   * Ref: 设计意图宣言 §4 AI自我模型四大支柱 — 核心特质
   */
  private determinePhenotype(
    entityName: string,
    entityType: EntityType,
    context: string,
    selfModel: SelfModelV1
  ): PhenotypeLabel {
    // self 实体特殊处理：检查是否与自我叙事一致
    if (entityType === 'self') {
      // 如果上下文包含强烈的负面情绪，self表达可能处于冲突状态
      const hasStrongNegative = [...NEGATIVE_WORDS].some((w) => context.includes(w));
      const hasStrongPositive = [...POSITIVE_WORDS].some((w) => context.includes(w));

      if (hasStrongNegative && !hasStrongPositive) return 'conflict';
      if (hasStrongPositive && !hasStrongNegative) return 'enhance';
      return 'neutral';
    }

    // 检查上下文中的情感词
    const contextLower = context.toLowerCase();
    let positiveCount = 0;
    let negativeCount = 0;

    for (const word of POSITIVE_WORDS) {
      if (contextLower.includes(word)) positiveCount++;
    }
    for (const word of NEGATIVE_WORDS) {
      if (contextLower.includes(word)) negativeCount++;
    }

    if (positiveCount > negativeCount) return 'enhance';
    if (negativeCount > positiveCount) return 'conflict';

    // 检查边界：如果实体触发了 self_model 的边界
    for (const boundary of selfModel.boundaries) {
      if (contextLower.includes(boundary.toLowerCase())) {
        return 'conflict';
      }
    }

    return 'neutral';
  }

  /**
   * 确定 knowledge_type（知识源类型）
   *
   * 策略：
   * - family: 家庭成员、家庭事件
   * - world: 公共地名、公共人物
   * - private: 其他（默认）
   *
   * Ref: ARCH.md §4.1 三源定义
   */
  private determineKnowledgeType(entityType: EntityType, entityName: string): 'private' | 'family' | 'world' {
    // family 类型
    if (entityType === 'person') {
      const familyKeywords = [
        '妈妈', '母亲', '爸', '爸爸', '父亲',
        '爷爷', '奶奶', '外公', '外婆',
        '哥哥', '弟弟', '姐姐', '妹妹',
        '老公', '老婆', '丈夫', '妻子',
        '姑姑', '舅舅', '阿姨', '叔叔',
        '家庭', '家人', '亲戚',
      ];
      if (familyKeywords.some((kw) => entityName.includes(kw))) {
        return 'family';
      }
    }

    // world 类型
    if (entityType === 'place') {
      const worldPlaces = ['北京', '上海', '深圳', '广州', '杭州', '中国', '美国'];
      if (worldPlaces.includes(entityName)) {
        return 'world';
      }
    }

    return 'private';
  }

  /**
   * 对输入文本进行L3实体标注
   *
   * @param text 用户输入文本
   * @param context 当前对话上下文的文本（用于phenotype判断）
   * @param selfModel 当前自我模型
   * @returns L3标注结果
   */
  annotate(
    text: string,
    context: string,
    selfModel: SelfModelV1
  ): L3AnnotationResult {
    const entities = this.extractor.extract(text);
    const fullContext = `${text} ${context}`;

    const entityGenes: EntityGene[] = entities.map((entity) => ({
      name: entity.name,
      type: entity.type,
      allele: entity.allele,
      phenotype: this.determinePhenotype(entity.name, entity.type, fullContext, selfModel),
      knowledge_type: this.determineKnowledgeType(entity.type, entity.name),
    }));

    return { entity_genes: entityGenes };
  }
}
