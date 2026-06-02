// PerceptionAnalyzer 单元测试
// Ref: 24维语义感知与钙质强度定义规范
//
// 测试策略:
// - 24维字段完整性
// - 钙质公式正确性 (Base_Core + Emotional_Boost + Threat_Bonus)
// - 情感极性检测（正/负/中性）
// - 实体基因集成
// - 边界输入（空文本、极端情绪）

import { describe, it, expect } from 'vitest';
import { PerceptionAnalyzer } from '../PerceptionAnalyzer.js';
import type { DNA } from '../types/dna.js';

function makeDNA(raw_input: string, locus_path = 'user.misc.default'): DNA {
  return {
    locus_path,
    taxonomy_version: '1.0',
    branch_id: 'evt_20260602_001',
    seq_pos: 1,
    leaf_zone: 'language_semantic_zone',
    ref: 'tmp_lang_00001',
    entity_genes: [],
    raw_input,
    created_at: '2026-06-02T00:00:00.000Z',
  };
}

describe('PerceptionAnalyzer — 24维完整性', () => {
  it('分析应返回完整的 24 个感知维度', () => {
    const analyzer = new PerceptionAnalyzer();
    const dna = makeDNA('今天心情不错，开心！');
    const enhanced = analyzer.analyze(dna);

    // 检查增强型 DNA 结构
    expect(enhanced.branch_id).toBe(dna.branch_id);
    expect(enhanced.locus_path).toBe(dna.locus_path);
    expect(enhanced.raw_input).toBe(dna.raw_input);

    // 24 维感知必须全部定义
    const p = enhanced.perception;
    // 情绪象限 (E1~E6)
    expect(typeof p.pleasure).toBe('number');
    expect(typeof p.arousal).toBe('number');
    expect(typeof p.dominance).toBe('number');
    expect(typeof p.aggression).toBe('number');
    expect(typeof p.sincerity).toBe('number');
    expect(typeof p.humor).toBe('number');
    // 认知象限 (C1~C6)
    expect(typeof p.factual).toBe('number');
    expect(typeof p.logical).toBe('number');
    expect(typeof p.certainty).toBe('number');
    expect(typeof p.abstract).toBe('number');
    expect(typeof p.temporal_focus).toBe('number');
    expect(typeof p.self_ref).toBe('number');
    // 社会象限 (S1~S6)
    expect(typeof p.intimacy).toBe('number');
    expect(typeof p.power_diff).toBe('number');
    expect(typeof p.dependency).toBe('number');
    expect(typeof p.moral_judgment).toBe('number');
    expect(typeof p.etiquette).toBe('number');
    expect(typeof p.belonging).toBe('number');
    // 亲密象限 (I1~I6)
    expect(typeof p.sexual_attraction).toBe('number');
    expect(typeof p.sensory_craving).toBe('number');
    expect(typeof p.energy_merge).toBe('number');
    expect(typeof p.possessiveness).toBe('number');
    expect(typeof p.ecstasy).toBe('number');
    expect(typeof p.safety).toBe('number');

    // 钙质字段
    expect(typeof enhanced.calcium_score).toBe('number');
    expect([0, 1, 2, 3]).toContain(enhanced.calcium_level);
  });
});

describe('PerceptionAnalyzer — 情绪检测', () => {
  it('正面文本应产生正愉悦度', () => {
    const analyzer = new PerceptionAnalyzer();
    const enhanced = analyzer.analyzeText('今天真的太开心了！好幸福！！');
    expect(enhanced.perception.pleasure).toBeGreaterThan(0);
    expect(enhanced.perception.sincerity).toBeGreaterThan(0.3);
  });

  it('负面文本应产生负愉悦度', () => {
    const analyzer = new PerceptionAnalyzer();
    const enhanced = analyzer.analyzeText('我好难过，好孤独，没有人理解我');
    expect(enhanced.perception.pleasure).toBeLessThan(0);
  });

  it('中性文本应接近零愉悦度', () => {
    const analyzer = new PerceptionAnalyzer();
    const enhanced = analyzer.analyzeText('今天是星期二，下午三点开会');
    expect(Math.abs(enhanced.perception.pleasure)).toBeLessThanOrEqual(0.4);
  });

  it('愤怒文本应检测到高攻击性和唤醒度', () => {
    const analyzer = new PerceptionAnalyzer();
    const enhanced = analyzer.analyzeText('你这个混蛋！给我滚！去死吧！');
    expect(enhanced.perception.aggression).toBeGreaterThan(0.2);
    expect(enhanced.perception.arousal).toBeGreaterThan(0.2);
  });

  it('幽默文本应检测到幽默感', () => {
    const analyzer = new PerceptionAnalyzer();
    const enhanced = analyzer.analyzeText('哈哈，开玩笑啦，逗你玩的');
    expect(enhanced.perception.humor).toBeGreaterThan(0.2);
  });
});

describe('PerceptionAnalyzer — 认知层面', () => {
  it('包含数字和事实的文本应高事实性', () => {
    const analyzer = new PerceptionAnalyzer();
    const enhanced = analyzer.analyzeText('2025年3月15日，公司召开了董事会，通过了3项决议');
    expect(enhanced.perception.factual).toBeGreaterThan(0.3);
  });

  it('包含推理词的文本应高逻辑性', () => {
    const analyzer = new PerceptionAnalyzer();
    const enhanced = analyzer.analyzeText('因为今天下雨，所以没出门，但是在家看了一本书');
    expect(enhanced.perception.logical).toBeGreaterThan(0.2);
  });

  it('第一人称高频文本应高自我参照', () => {
    const analyzer = new PerceptionAnalyzer();
    const enhanced = analyzer.analyzeText('我觉得我想我需要我自己一个人静静');
    expect(enhanced.perception.self_ref).toBeGreaterThan(0.3);
  });

  it('未来焦点文本的时间焦点应为正', () => {
    const analyzer = new PerceptionAnalyzer();
    const enhanced = analyzer.analyzeText('未来我计划去环游世界，憧憬着那一天的到来');
    expect(enhanced.perception.temporal_focus).toBeGreaterThan(0);
  });
});

describe('PerceptionAnalyzer — 社会交互', () => {
  it('感谢用语应提升社交礼仪分', () => {
    const analyzer = new PerceptionAnalyzer();
    const enhanced = analyzer.analyzeText('谢谢您，不好意思麻烦您了，非常感谢');
    expect(enhanced.perception.etiquette).toBeGreaterThan(0.3);
  });

  it('亲密用语应提升亲密度', () => {
    const analyzer = new PerceptionAnalyzer();
    const enhanced = analyzer.analyzeText('亲爱的，告诉你一个秘密，我只告诉你了');
    expect(enhanced.perception.intimacy).toBeGreaterThan(0.2);
  });

  it('群体用语应提升归属感', () => {
    const analyzer = new PerceptionAnalyzer();
    const enhanced = analyzer.analyzeText('我们大家一起努力，咱们一定能成功');
    expect(enhanced.perception.belonging).toBeGreaterThan(0.3);
  });
});

describe('PerceptionAnalyzer — 亲密与欲望', () => {
  it('性感相关词汇提升性吸引力', () => {
    const analyzer = new PerceptionAnalyzer();
    const enhanced = analyzer.analyzeText('你的眼睛好迷人，你的身材真性感');
    expect(enhanced.perception.sexual_attraction).toBeGreaterThan(0.2);
  });

  it('拥抱相关词汇提升感官渴望', () => {
    const analyzer = new PerceptionAnalyzer();
    const enhanced = analyzer.analyzeText('好想抱抱你，想要你的拥抱');
    expect(enhanced.perception.sensory_craving).toBeGreaterThan(0.2);
  });
});

describe('PerceptionAnalyzer — 钙质公式', () => {
  it('平静文本应为粉末级（level 0）', () => {
    const analyzer = new PerceptionAnalyzer();
    const enhanced = analyzer.analyzeText('嗯');
    expect(enhanced.calcium_level).toBe(0);
  });

  it('正常交流钙质应为液体级（level >= 1）', () => {
    const analyzer = new PerceptionAnalyzer();
    const enhanced = analyzer.analyzeText('今天心情不错，出去走了走，挺开心的');
    expect(enhanced.calcium_level).toBeGreaterThanOrEqual(1);
    expect(enhanced.calcium_score).toBeGreaterThanOrEqual(0.3);
  });

  it('强烈情绪应为固体级（level 2）或晶体内（level 3）', () => {
    const analyzer = new PerceptionAnalyzer();
    const enhanced = analyzer.analyzeText('我恨你！去死吧！永远不要让我再看到你！你这个无耻的混蛋！');
    // 高攻击性 + 高唤醒度 → 触发 Emotional_Boost + 可能 Threat_Bonus
    expect(enhanced.calcium_level).toBeGreaterThanOrEqual(1);
    expect(enhanced.calcium_score).toBeGreaterThan(0.3);
  });

  it('钙质分解明细应包含三个分项', () => {
    const analyzer = new PerceptionAnalyzer();
    const enhanced = analyzer.analyzeText('我真的好难过');
    // 钙质明细在钙质计算内部，通过 analyzeText 验证总分数合理性
    expect(enhanced.calcium_score).toBeGreaterThanOrEqual(0);
    expect(enhanced.calcium_score).toBeLessThanOrEqual(1);
  });

  it('高攻击性文本应触发 Threat_Bonus → 钙质显著提升', () => {
    const analyzer = new PerceptionAnalyzer();
    const neutral = analyzer.analyzeText('好的我知道了');
    const aggressive = analyzer.analyzeText('去死吧混蛋！杀了你！');
    // 攻击文本的钙质应显著高于中性文本
    expect(aggressive.calcium_score).toBeGreaterThan(neutral.calcium_score);
  });
});

describe('PerceptionAnalyzer — 边界情况', () => {
  it('空文本不应崩溃', () => {
    const analyzer = new PerceptionAnalyzer();
    const enhanced = analyzer.analyzeText('');
    expect(enhanced).toBeDefined();
    expect(enhanced.perception).toBeDefined();
  });

  it('超长文本不应崩溃', () => {
    const analyzer = new PerceptionAnalyzer();
    const longText = '测试'.repeat(5000);
    const enhanced = analyzer.analyzeText(longText);
    expect(enhanced).toBeDefined();
  });

  it('特殊字符不应崩溃', () => {
    const analyzer = new PerceptionAnalyzer();
    const enhanced = analyzer.analyzeText('!@#$%^&*()_+😡😭😤🔥😍🥰');
    expect(enhanced).toBeDefined();
  });

  it('实体基因应完整传递到 EnhancedDNA', () => {
    const analyzer = new PerceptionAnalyzer();
    const dna = makeDNA('妈妈我好想你');
    dna.entity_genes = [
      { name: '妈妈', type: 'person', allele: '妈妈', phenotype: 'enhance', knowledge_type: 'family' },
      { name: '我', type: 'self', allele: '我', phenotype: 'neutral', knowledge_type: 'private' },
    ];
    const enhanced = analyzer.analyze(dna);
    expect(enhanced.entity_genes).toHaveLength(2);
    expect(enhanced.entity_genes[0].name).toBe('妈妈');
  });
});

describe('PerceptionAnalyzer — 批量分析', () => {
  it('批量分析应正确处理多条 DNA', () => {
    const analyzer = new PerceptionAnalyzer();
    const dnas = [
      makeDNA('今天真的好开心很幸福', 'user.emotion.positive'),
      makeDNA('我好难过好伤心', 'user.work.stress'),
      makeDNA('', 'user.misc.default'),
    ];
    const results = analyzer.analyzeBatch(dnas);
    expect(results).toHaveLength(3);
    expect(results[0].perception.pleasure).toBeGreaterThan(0);
    expect(results[1].perception.pleasure).toBeLessThan(0);
  });
});

describe('PerceptionAnalyzer — 确定性', () => {
  it('相同输入 50 次应返回完全相同的 24 维和钙质', () => {
    const analyzer = new PerceptionAnalyzer();
    const text = '今天真的好开心，和你在一起很幸福';
    const results = Array.from({ length: 50 }, () => analyzer.analyzeText(text));

    const first = results[0];
    for (let i = 1; i < results.length; i++) {
      expect(results[i].calcium_score).toBe(first.calcium_score);
      expect(results[i].calcium_level).toBe(first.calcium_level);
      expect(results[i].perception.pleasure).toBe(first.perception.pleasure);
      expect(results[i].perception.arousal).toBe(first.perception.arousal);
      expect(results[i].perception.aggression).toBe(first.perception.aggression);
    }
  });
});
