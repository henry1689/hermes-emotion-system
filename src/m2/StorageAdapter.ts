// StorageAdapter 接口定义
// Ref: SPEC.md §4.3 预期接口
// Ref: M2-design-v1.md §3

import type { DNA } from '../m1/types/dna.js';
import type {
  WriteResult,
  ReadResult,
  QueryOptions,
  StorageStatus,
} from './types/index.js';

/**
 * 5 大语义区存储适配器接口
 *
 * 核心职责：接收 M1 产出的 DNA 对象，按语义属性持久化到 5 大物理存储区。
 * 当前 MVP 实现为 JsonStorageAdapter，未来可切换为 SQLite 或 LevelDB。
 *
 * 所有实现必须遵守：
 * - 5 区物理隔离，禁止跨区 JOIN
 * - seq_pos 全局单调递增
 * - 替换 M1 占位 ref 为真实物理地址
 *
 * Ref: SPEC.md §4.1 职责定义
 * Ref: ADR-004 M1-M2 边界分离
 */
export interface StorageAdapter {
  /**
   * 写入一条 DNA 到对应的语义区。
   * 自动分配全局 seq_pos 并替换占位 ref。
   *
   * @param dna - M1 编码产出的完整 DNA 对象
   * @returns 写入结果（含真实 ref 和全局 seq_pos）
   * @throws 如果 DNA 结构不合法（缺 leaf_zone / branch_id）
   */
  write(dna: DNA): Promise<WriteResult>;

  /**
   * 批量写入多条 DNA。
   * 每条独立处理，互不影响（不保证事务性）。
   */
  writeBatch(dnas: DNA[]): Promise<WriteResult[]>;

  /**
   * 按 branch_id 精确查询一条 DNA。
   * 期望 O(1) 查找。
   *
   * @param branchId - 如 "evt_20260602_001"
   * @returns 读取结果（含完整 DNA，ref 已替换为真实地址）
   */
  read(branchId: string): Promise<ReadResult>;

  /**
   * 按 locus_path 前缀查询 DNA 列表。
   * 支持三级粒度: "user" / "user.family" / "user.family.conflict"
   *
   * @param locusPath - 如 "user.family"
   * @param options - 分页与排序选项
   */
  findByLocus(locusPath: string, options?: QueryOptions): Promise<DNA[]>;

  /**
   * 按 seq_pos 范围查询 DNA 列表。
   * [start, end] 闭区间。
   */
  findBySeqPosRange(start: number, end: number, options?: QueryOptions): Promise<DNA[]>;

  /**
   * 获取下一个全局原子序列号。
   * 由 counter.json 驱动，严格单调递增。
   * 实现应保证单线程原子性。
   */
  nextSeqPos(): Promise<number>;

  /**
   * 初始化存储系统。
   * 创建数据目录、zone 文件、index.json、counter.json（如需）。
   * 在应用启动时调用一次。
   */
  initialize(): Promise<void>;

  /**
   * 获取当前存储状态（用于调试/监控）。
   */
  getStatus(): Promise<StorageStatus>;
}
