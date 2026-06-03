// JsonStorageAdapter — JSON 文件存储实现
// Ref: SPEC.md §4.2 物理存储方案（内存 + JSON 文件持久化）
// Ref: M2-design-v1.md §5-§9
// Ref: ADR-004 M1-M2 边界分离

import { promises as fs, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { DNA, LeafZone } from '../m1/types/dna.js';
import type { StorageAdapter } from './StorageAdapter.js';
import type {
  WriteResult,
  ReadResult,
  QueryOptions,
  StorageStatus,
  ZoneRecord,
  IndexEntry,
  IndexFile,
  CounterFile,
} from './types/index.js';
import {
  DATA_DIR as DEFAULT_DATA_DIR,
  ZONES_DIR as DEFAULT_ZONES_DIR,
  COUNTER_FILE as DEFAULT_COUNTER_FILE,
  INDEX_FILE as DEFAULT_INDEX_FILE,
  ZONE_FILE_MAP,
  ZONE_ABBR_MAP,
} from './constants.js';

/**
 * 校验 DNA 对象的关键字段是否完整
 * Ref: SPEC.md §9.3 运行时校验（待决事项 3-3 决议：校验下沉到 M2）
 */
function validateDNA(dna: unknown): dna is DNA {
  if (!dna || typeof dna !== 'object') return false;
  const d = dna as Record<string, unknown>;
  return (
    typeof d.branch_id === 'string' &&
    typeof d.locus_path === 'string' &&
    typeof d.leaf_zone === 'string' &&
    Array.isArray(d.entity_genes) &&
    typeof d.raw_input === 'string'
  );
}

/**
 * 安全读取 JSON 文件，失败时返回默认值
 */
async function readJSON<T>(filePath: string, defaultVal: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    if (raw.trim().length === 0) return defaultVal;
    return JSON.parse(raw) as T;
  } catch {
    return defaultVal;
  }
}

/**
 * 原子性写入 JSON 文件：先写临时文件，再重命名
 */
async function writeJSONAtomic(filePath: string, data: unknown): Promise<void> {
  const tmpPath = filePath + '.tmp';
  const content = JSON.stringify(data, null, 2);
  await fs.writeFile(tmpPath, content, 'utf-8');
  await fs.rename(tmpPath, filePath);
}

/**
 * JSON 文件存储适配器
 *
 * @deprecated 已由 FusionStorageAdapter (src/fusion/) 替代。
 * 仍被 cli/sandbox.ts 使用，生产路径已全部切换到 SQLite 融合存储。
 * 24D 情感向量作为主索引的能力仅在 FusionStorageAdapter 中提供。
 *
 * 使用 5 个独立的 JSON 文件 + 1 个全局索引文件 + 1 个计数器文件。
 * 适用于 MVP 阶段（~10,000 条记录规模）。
 *
 * 写入策略：全量读取 → 内存修改 → 全量写回
 * 原子性保证：先写临时文件 .tmp，再重命名
 */
export class JsonStorageAdapter implements StorageAdapter {
  private initialized = false;
  private dataDir: string;
  private zonesDir: string;
  private counterFile: string;
  private indexFile: string;

  constructor(dataDir?: string) {
    this.dataDir = dataDir ?? DEFAULT_DATA_DIR;
    this.zonesDir = join(this.dataDir, 'zones');
    this.counterFile = join(this.dataDir, 'counter.json');
    this.indexFile = join(this.dataDir, 'index.json');
  }

  async initialize(): Promise<void> {
    // Ref: M2-design-v1.md §5.4 — 使用 recursive true 确保多级目录安全创建
    if (!existsSync(this.zonesDir)) {
      mkdirSync(this.zonesDir, { recursive: true });
    }

    // 创建 5 个 zone 文件（如不存在）
    for (const fileName of Object.values(ZONE_FILE_MAP)) {
      const filePath = join(this.zonesDir, fileName);
      if (!existsSync(filePath)) {
        await writeJSONAtomic(filePath, []);
      }
    }

    // 创建 index.json（如不存在）
    if (!existsSync(this.indexFile)) {
      const initialIndex: IndexFile = {
        version: '1.0',
        last_updated: new Date().toISOString(),
        entries: [],
      };
      await writeJSONAtomic(this.indexFile, initialIndex);
    }

    // 创建 counter.json（如不存在）
    if (!existsSync(this.counterFile)) {
      const initialCounter: CounterFile = {
        version: '1.0',
        lastId: 0,
        updated_at: new Date().toISOString(),
      };
      await writeJSONAtomic(this.counterFile, initialCounter);
    }

    this.initialized = true;
  }

  async nextSeqPos(): Promise<number> {
    // Ref: M2-design-v1.md §6 — counter.json 原子自增
    // TODO: 多线程场景下需要文件锁或数据库事务（M2-1 待决事项）
    const counter = await readJSON<CounterFile>(this.counterFile, {
      version: '1.0-fallback',
      lastId: 0,
      updated_at: new Date().toISOString(),
    });

    const newId = counter.lastId + 1;
    const updated: CounterFile = {
      version: '1.0',
      lastId: newId,
      updated_at: new Date().toISOString(),
    };
    await writeJSONAtomic(this.counterFile, updated);
    return newId;
  }

  async write(dna: DNA): Promise<WriteResult> {
    this.ensureInitialized();

    // 输入校验
    if (!validateDNA(dna)) {
      return {
        success: false,
        real_ref: '',
        seq_pos: -1,
        error: 'Invalid DNA: missing required fields (branch_id, locus_path, leaf_zone, etc.)',
      };
    }

    const { leaf_zone, ...dnaWithoutZone } = dna;

    // 确定目标 zone 文件
    const zoneFileName = ZONE_FILE_MAP[leaf_zone];
    if (!zoneFileName) {
      return {
        success: false,
        real_ref: '',
        seq_pos: -1,
        error: `Unknown leaf_zone: ${leaf_zone}`,
      };
    }
    const zoneFilePath = join(this.zonesDir, zoneFileName);

    // 获取全局 seq_pos
    const realSeqPos = await this.nextSeqPos();

    try {
      // 读取 zone 文件
      const zoneData = await readJSON<Record<string, unknown>[]>(zoneFilePath, []);
      const position = zoneData.length;

      // 构建 ZoneRecord
      const zoneRecord: ZoneRecord = {
        position,
        seq_pos: realSeqPos,
        dna: dnaWithoutZone as Omit<DNA, 'leaf_zone'>,
        written_at: new Date().toISOString(),
      };
      zoneData.push(zoneRecord as unknown as Record<string, unknown>);

      // 写入 zone 文件（原子操作）
      await writeJSONAtomic(zoneFilePath, zoneData);

      // 构建真实 ref
      const zoneAbbr = ZONE_ABBR_MAP[leaf_zone] ?? 'unk';
      const realRef = `${zoneAbbr}_${String(position).padStart(5, '0')}`;

      // 更新 index.json
      const indexFile = await readJSON<IndexFile>(this.indexFile, {
        version: '1.0',
        last_updated: new Date().toISOString(),
        entries: [],
      });
      indexFile.entries.push({
        branch_id: dna.branch_id,
        zone: leaf_zone,
        position,
        seq_pos: realSeqPos,
        locus_path: dna.locus_path,
        created_at: new Date().toISOString(),
      });
      indexFile.last_updated = new Date().toISOString();
      await writeJSONAtomic(this.indexFile, indexFile);

      return {
        success: true,
        real_ref: realRef,
        seq_pos: realSeqPos,
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[M2] write failed for ${dna.branch_id}: ${errMsg}`);
      return {
        success: false,
        real_ref: '',
        seq_pos: -1,
        error: `Write failed: ${errMsg}`,
      };
    }
  }

  async writeBatch(dnas: DNA[]): Promise<WriteResult[]> {
    return Promise.all(dnas.map((dna) => this.write(dna)));
  }

  async read(branchId: string): Promise<ReadResult> {
    this.ensureInitialized();

    const indexFile = await readJSON<IndexFile>(this.indexFile, {
      version: '1.0',
      last_updated: '',
      entries: [],
    });

    const entry = indexFile.entries.find((e) => e.branch_id === branchId);
    if (!entry) {
      return { dna: null };
    }

    return this.readFromEntry(entry);
  }

  async findByLocus(locusPath: string, options?: QueryOptions): Promise<DNA[]> {
    this.ensureInitialized();
    // FIXME: 百万级数据需建立内存索引 Map<branch_id, IndexEntry> 或 LSM-Tree
    const indexFile = await readJSON<IndexFile>(this.indexFile, {
      version: '1.0',
      last_updated: '',
      entries: [],
    });

    const normalizedPath = locusPath.endsWith('*')
      ? locusPath.slice(0, -1)
      : locusPath;

    const matched = indexFile.entries
      .filter((e) => e.locus_path.startsWith(normalizedPath))
      .sort((a, b) => {
        // 默认降序（最新的在前）
        return (options?.ascending ? 1 : -1) * (a.seq_pos - b.seq_pos);
      });

    return this.readBatch(matched, options);
  }

  async findBySeqPosRange(start: number, end: number, options?: QueryOptions): Promise<DNA[]> {
    this.ensureInitialized();
    const indexFile = await readJSON<IndexFile>(this.indexFile, {
      version: '1.0',
      last_updated: '',
      entries: [],
    });

    const matched = indexFile.entries
      .filter((e) => e.seq_pos >= start && e.seq_pos <= end)
      .sort((a, b) => {
        return (options?.ascending ? 1 : -1) * (a.seq_pos - b.seq_pos);
      });

    return this.readBatch(matched, options);
  }

  async getStatus(): Promise<StorageStatus> {
    const indexFile = await readJSON<IndexFile>(this.indexFile, {
      version: '1.0',
      last_updated: '',
      entries: [],
    });
    const counter = await readJSON<CounterFile>(this.counterFile, {
      version: '1.0-fallback',
      lastId: 0,
      updated_at: '',
    });

    const zoneCounts: Record<string, number> = {};

    for (const [zone, fileName] of Object.entries(ZONE_FILE_MAP)) {
      const filePath = join(this.zonesDir, fileName);
      const data = await readJSON<unknown[]>(filePath, []);
      zoneCounts[zone] = data.length;
    }

    return {
      totalRecords: indexFile.entries.length,
      zoneCounts,
      currentSeqPos: counter.lastId,
      storagePath: this.dataDir,
    };
  }

  // ─── 私有辅助方法 ───

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('StorageAdapter not initialized. Call initialize() first.');
    }
  }

  /**
   * 从 IndexEntry 读取完整的 DNA 记录
   */
  private async readFromEntry(entry: IndexEntry): Promise<ReadResult> {
    const zoneFileName = ZONE_FILE_MAP[entry.zone];
    if (!zoneFileName) {
      return { dna: null, error: `Unknown zone: ${entry.zone}` };
    }

    try {
      const zoneData = await readJSON<ZoneRecord[]>(
        join(this.zonesDir, zoneFileName),
        []
      );

      const record = zoneData[entry.position];
      if (!record) {
        return { dna: null, error: `No record at position ${entry.position} in ${entry.zone}` };
      }

      // 重建完整 DNA（补回 leaf_zone）
      const dna: DNA = {
        ...(record.dna as Omit<DNA, 'leaf_zone'>),
        leaf_zone: entry.zone as LeafZone,
      };

      return { dna };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return { dna: null, error: `Read failed: ${errMsg}` };
    }
  }

  /**
   * 批量从 IndexEntry 列表读取完整 DNA 记录
   */
  private async readBatch(
    entries: IndexEntry[],
    options?: QueryOptions
  ): Promise<DNA[]> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const slice = entries.slice(offset, offset + limit);
    const results = await Promise.all(
      slice.map((entry) => this.readFromEntry(entry))
    );

    return results
      .filter((r) => r.dna !== null)
      .map((r) => r.dna as DNA);
  }
}
