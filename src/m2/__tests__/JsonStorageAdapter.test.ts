// M2 JsonStorageAdapter 单元测试
// Ref: SPEC.md §4 存储适配器
// Ref: M2-design-v1.md §10 测试策略

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { JsonStorageAdapter } from '../JsonStorageAdapter.js';
import type { DNA, LeafZone } from '../../m1/types/dna.js';

// ─── Test Helpers ───

const TEST_DIR = join(__dirname, '.test-tmp');

function makeDNA(leafZone: LeafZone, id: number): DNA {
  const seqStr = String(id).padStart(3, '0');
  return {
    locus_path: 'user.family.conflict',
    taxonomy_version: '1.0-test',
    branch_id: `evt_20260602_${seqStr}`,
    seq_pos: id,
    leaf_zone: leafZone,
    ref: `tmp_xxx_${String(id).padStart(5, '0')}`,
    entity_genes: [{
      name: '妈妈', type: 'person' as const, allele: '妈妈',
      phenotype: 'conflict' as const, knowledge_type: 'family' as const,
    }],
    raw_input: `测试输入第${id}条`,
    created_at: '2026-06-02T00:00:00.000Z',
  };
}

describe('JsonStorageAdapter — 基础写入与读取', () => {
  let adapter: JsonStorageAdapter;

  beforeEach(async () => {
    if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true });
    adapter = new JsonStorageAdapter(TEST_DIR);
    await adapter.initialize();
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it('写入一条 DNA 后能通过 branch_id 读出', async () => {
    const dna = makeDNA('language_semantic_zone', 1);
    const writeResult = await adapter.write(dna);
    expect(writeResult.success).toBe(true);

    const readResult = await adapter.read(dna.branch_id);
    expect(readResult.dna).not.toBeNull();
    expect(readResult.dna!.branch_id).toBe(dna.branch_id);
    expect(readResult.dna!.raw_input).toBe(dna.raw_input);
  });

  it('写入后 ref 被替换为真实地址（非 tmp_ 开头）', async () => {
    const dna = makeDNA('emotion_valence_zone', 2);
    const writeResult = await adapter.write(dna);
    expect(writeResult.success).toBe(true);
    expect(writeResult.real_ref).toMatch(/^[a-z]+_\d{5}$/);
    expect(writeResult.real_ref).not.toMatch(/^tmp_/);
  });

  it('写入后 seq_pos 为正整数', async () => {
    const dna = makeDNA('language_semantic_zone', 3);
    const writeResult = await adapter.write(dna);
    expect(writeResult.seq_pos).toBeGreaterThan(0);
  });
});

describe('JsonStorageAdapter — 5 区隔离', () => {
  let adapter: JsonStorageAdapter;

  beforeEach(async () => {
    if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true });
    adapter = new JsonStorageAdapter(TEST_DIR);
    await adapter.initialize();
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it('写入5条不同leaf_zone数据，各自存入对应文件', async () => {
    const zones: LeafZone[] = [
      'language_semantic_zone',
      'emotion_valence_zone',
      'embodied_perception_zone',
      'spatiotemporal_episode_zone',
      'social_schema_zone',
    ];

    for (let i = 0; i < zones.length; i++) {
      const dna = makeDNA(zones[i], i + 10);
      const result = await adapter.write(dna);
      expect(result.success).toBe(true);
    }

    // 验证每个 zone 文件恰好有 1 条记录
    const zoneFiles = [
      'language_semantic_zone.json',
      'emotion_valence_zone.json',
      'embodied_perception_zone.json',
      'spatiotemporal_episode_zone.json',
      'social_schema_zone.json',
    ];
    for (const fileName of zoneFiles) {
      const filePath = join(TEST_DIR, 'zones', fileName);
      const raw = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(raw);
      expect(data.length).toBe(1);
    }
  });
});

describe('JsonStorageAdapter — seq_pos 严格递增', () => {
  let adapter: JsonStorageAdapter;

  beforeEach(async () => {
    if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true });
    adapter = new JsonStorageAdapter(TEST_DIR);
    await adapter.initialize();
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it('连续写入50条，seq_pos 严格+1递增', async () => {
    let prevSeq = 0;
    for (let i = 1; i <= 50; i++) {
      const dna = makeDNA('language_semantic_zone', i);
      const result = await adapter.write(dna);
      expect(result.success).toBe(true);
      expect(result.seq_pos).toBe(prevSeq + 1);
      prevSeq = result.seq_pos;
    }
    expect(prevSeq).toBe(50);
  });

  it('跨会话后 seq_pos 继续递增（不会重置）', async () => {
    for (let i = 1; i <= 5; i++) {
      await adapter.write(makeDNA('language_semantic_zone', i));
    }

    // 模拟新会话：创建新实例
    const adapter2 = new JsonStorageAdapter(TEST_DIR);
    await adapter2.initialize();

    const result = await adapter2.write(makeDNA('language_semantic_zone', 99));
    expect(result.seq_pos).toBe(6);
  });
});

describe('JsonStorageAdapter — 查询能力', () => {
  let adapter: JsonStorageAdapter;

  beforeEach(async () => {
    if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true });
    adapter = new JsonStorageAdapter(TEST_DIR);
    await adapter.initialize();

    const d1 = makeDNA('language_semantic_zone', 1);
    d1.locus_path = 'user.family.conflict'; d1.raw_input = '家庭冲突';
    await adapter.write(d1);

    const d2 = makeDNA('emotion_valence_zone', 2);
    d2.locus_path = 'user.emotion.positive'; d2.raw_input = '积极情绪';
    await adapter.write(d2);

    const d3 = makeDNA('language_semantic_zone', 3);
    d3.locus_path = 'user.family.care'; d3.raw_input = '家庭关爱';
    await adapter.write(d3);

    const d4 = makeDNA('language_semantic_zone', 4);
    d4.locus_path = 'user.work.stress'; d4.raw_input = '工作压力';
    await adapter.write(d4);
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it('按 locus_path 前缀查询应返回匹配记录', async () => {
    const results = await adapter.findByLocus('user.family');
    expect(results.length).toBe(2);
    for (const r of results) {
      expect(r.locus_path.startsWith('user.family')).toBe(true);
    }
  });

  it('按精确路径查询应返回匹配记录', async () => {
    const results = await adapter.findByLocus('user.work.stress');
    expect(results.length).toBe(1);
    expect(results[0].raw_input).toBe('工作压力');
  });

  it('不存在的 branch_id 应返回 null', async () => {
    const result = await adapter.read('nonexistent_branch');
    expect(result.dna).toBeNull();
  });
});

describe('JsonStorageAdapter — 初始化与降级', () => {
  it('空目录 initialize 应自动创建所有必需文件', async () => {
    if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true });
    const adapter = new JsonStorageAdapter(TEST_DIR);
    await adapter.initialize();

    expect(existsSync(join(TEST_DIR, 'zones'))).toBe(true);
    expect(existsSync(join(TEST_DIR, 'index.json'))).toBe(true);
    expect(existsSync(join(TEST_DIR, 'counter.json'))).toBe(true);

    const zoneFiles = [
      'language_semantic_zone.json',
      'emotion_valence_zone.json',
      'embodied_perception_zone.json',
      'spatiotemporal_episode_zone.json',
      'social_schema_zone.json',
    ];
    for (const fn of zoneFiles) {
      expect(existsSync(join(TEST_DIR, 'zones', fn))).toBe(true);
    }

    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it('未 initialize 就调用 write 应报错', async () => {
    const adapter = new JsonStorageAdapter(TEST_DIR);
    const dna = makeDNA('language_semantic_zone', 1);
    await expect(adapter.write(dna)).rejects.toThrow('not initialized');
  });
});
