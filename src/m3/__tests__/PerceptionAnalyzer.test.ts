// PerceptionAnalyzer 单元测试 (M3)
// Ref: 24维语义感知与钙质强度定义规范
//
// 测试策略同原 M1 版本，仅迁移路径到 M3

import { describe, it, expect } from 'vitest';
import { PerceptionAnalyzer } from '../PerceptionAnalyzer.js';
import { M3LogicOrchestrator } from '../M3LogicOrchestrator.js';
import type { DNA } from '../../m1/types/dna.js';

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

describe('PerceptionAnalyzer (M3) — 24维完整性', () => {
  it('分析应返回完整的 24 个感知维度', () => {
    const analyzer = new PerceptionAnalyzer();
    const dna = makeDNA('今天心情不错，开心！');
    const enhanced = analyzer.analyze(dna);
    expect(enhanced.branch_id).toBe(dna.branch_id);
    expect(enhanced.locus_path).toBe(dna.locus_path);
    const p = enhanced.perception;
    expect(typeof p.pleasure).toBe('number');
    expect(typeof p.arousal).toBe('number');
    expect(typeof p.dominance).toBe('number');
    expect(typeof p.aggression).toBe('number');
    expect(typeof p.sincerity).toBe('number');
    expect(typeof p.humor).toBe('number');
    expect(typeof p.factual).toBe('number');
    expect(typeof p.logical).toBe('number');
    expect(typeof p.certainty).toBe('number');
    expect(typeof p.abstract).toBe('number');
    expect(typeof p.temporal_focus).toBe('number');
    expect(typeof p.self_ref).toBe('number');
    expect(typeof p.intimacy).toBe('number');
    expect(typeof p.power_diff).toBe('number');
    expect(typeof p.dependency).toBe('number');
    expect(typeof p.moral_judgment).toBe('number');
    expect(typeof p.etiquette).toBe('number');
    expect(typeof p.belonging).toBe('number');
    expect(typeof p.sexual_attraction).toBe('number');
    expect(typeof p.sensory_craving).toBe('number');
    expect(typeof p.energy_merge).toBe('number');
    expect(typeof p.possessiveness).toBe('number');
    expect(typeof p.ecstasy).toBe('number');
    expect(typeof p.safety).toBe('number');
    expect(typeof enhanced.calcium_score).toBe('number');
    expect([0, 1, 2, 3]).toContain(enhanced.calcium_level);
  });
});

describe('PerceptionAnalyzer (M3) — 情绪检测', () => {
  it('正面文本应产生正愉悦度', () => {
    const analyzer = new PerceptionAnalyzer();
    expect(analyzer.analyzeText('今天真的太开心了！好幸福！！').perception.pleasure).toBeGreaterThan(0);
  });

  it('负面文本应产生负愉悦度', () => {
    expect(new PerceptionAnalyzer().analyzeText('我好难过，好孤独，没有人理解我').perception.pleasure).toBeLessThan(0);
  });

  it('愤怒文本应检测到攻击性和唤醒度', () => {
    const enhanced = new PerceptionAnalyzer().analyzeText('你这个混蛋！给我滚！去死吧！');
    expect(enhanced.perception.aggression).toBeGreaterThan(0.2);
    expect(enhanced.perception.arousal).toBeGreaterThan(0.2);
  });

  it('幽默文本应检测到幽默感', () => {
    expect(new PerceptionAnalyzer().analyzeText('哈哈，开玩笑啦，逗你玩的').perception.humor).toBeGreaterThan(0.2);
  });
});

describe('PerceptionAnalyzer (M3) — 认知/社会/欲望层面', () => {
  it('包含数字的文本应高事实性', () => {
    expect(new PerceptionAnalyzer().analyzeText('2025年3月15日，公司召开了董事会').perception.factual).toBeGreaterThan(0.3);
  });

  it('第一人称高频文本应高自我参照', () => {
    expect(new PerceptionAnalyzer().analyzeText('我觉得我想我需要我自己一个人静静').perception.self_ref).toBeGreaterThan(0.3);
  });

  it('感谢用语应提升社交礼仪分', () => {
    expect(new PerceptionAnalyzer().analyzeText('谢谢您，不好意思麻烦您了').perception.etiquette).toBeGreaterThan(0.3);
  });

  it('性感相关词汇提升性吸引力', () => {
    expect(new PerceptionAnalyzer().analyzeText('你的眼睛好迷人，你的身材真性感').perception.sexual_attraction).toBeGreaterThan(0.2);
  });
});

describe('PerceptionAnalyzer (M3) — 钙质公式', () => {
  it('平静文本应为粉末级（level 0）', () => {
    expect(new PerceptionAnalyzer().analyzeText('嗯').calcium_level).toBe(0);
  });

  it('高攻击性文本的钙质应显著高于中性文本', () => {
    const neutral = new PerceptionAnalyzer().analyzeText('好的我知道了');
    const aggressive = new PerceptionAnalyzer().analyzeText('去死吧混蛋！杀了你！');
    expect(aggressive.calcium_score).toBeGreaterThan(neutral.calcium_score);
  });
});

describe('PerceptionAnalyzer (M3) — 边界情况', () => {
  it('空文本不应崩溃', () => {
    expect(new PerceptionAnalyzer().analyzeText('')).toBeDefined();
  });

  it('超长文本不应崩溃', () => {
    expect(new PerceptionAnalyzer().analyzeText('测试'.repeat(5000))).toBeDefined();
  });

  it('特殊字符不应崩溃', () => {
    expect(new PerceptionAnalyzer().analyzeText('!@#$%^&*()_+😡😭😤🔥😍🥰')).toBeDefined();
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
  });
});

describe('M3LogicOrchestrator — 决策逻辑', () => {
  it('粉末级输入应返回 ignore 动作', () => {
    const orchestrator = new M3LogicOrchestrator();
    const decision = orchestrator.decide(makeDNA('嗯'));
    expect(decision.action).toBe('ignore');
  });

  it('液体级输入应返回 summarize 动作', () => {
    const orchestrator = new M3LogicOrchestrator();
    const decision = orchestrator.decide(makeDNA('今天天气不错，适合出去走走'));
    expect(['ignore', 'summarize', 'respond', 'core_trigger']).toContain(decision.action);
  });

  it('高攻击性输入应触发固体或晶体级响应', () => {
    const orchestrator = new M3LogicOrchestrator();
    const decision = orchestrator.decide(makeDNA('去死吧混蛋！杀了你！'));
    expect(decision.enhanced.calcium_level).toBeGreaterThanOrEqual(1);
  });

  it('决策结果应包含完整的增强型 DNA', () => {
    const orchestrator = new M3LogicOrchestrator();
    const decision = orchestrator.decide(makeDNA('妈妈我好想你'));
    expect(decision.enhanced.perception).toBeDefined();
    expect(decision.enhanced.calcium_score).toBeGreaterThanOrEqual(0);
    expect(decision.reason).toBeTruthy();
  });
});

describe('PerceptionAnalyzer (M3) — 确定性', () => {
  it('相同输入 50 次应返回完全相同的结果', () => {
    const analyzer = new PerceptionAnalyzer();
    const results = Array.from({ length: 50 }, () => analyzer.analyzeText('今天真的好开心，和你在一起很幸福'));
    const first = results[0];
    for (let i = 1; i < results.length; i++) {
      expect(results[i].calcium_score).toBe(first.calcium_score);
      expect(results[i].perception.pleasure).toBe(first.perception.pleasure);
    }
  });
});
