// M2 存储适配器专属类型定义
// Ref: SPEC.md §4.3 预期接口
// Ref: M2-design-v1.md §3-§6

import type { DNA } from '../../m1/types/dna.js';

// ─── 写入结果 ───

export interface WriteResult {
  success: boolean;
  real_ref: string;       // 替换后的真实物理地址
  seq_pos: number;        // 全局原子序列号
  error?: string;         // 失败时的错误信息
}

// ─── 读取结果 ───

export interface ReadResult {
  dna: DNA | null;
  error?: string;
}

// ─── 查询选项 ───

export interface QueryOptions {
  limit?: number;         // 最多返回条数（默认 50）
  offset?: number;        // 偏移量（默认 0）
  ascending?: boolean;    // 是否升序排列（默认 false=降序）
}

// ─── Zone 存储记录 ───

export interface ZoneRecord {
  /** 写入序号（在 zone 文件中的位置，从 0 开始） */
  position: number;
  /** 全局原子序列号（来自 counter.json） */
  seq_pos: number;
  /** 原始 DNA 对象（不含 leaf_zone — 由所在文件隐式标识） */
  dna: Omit<DNA, 'leaf_zone'>;
  /** 写入时间戳 ISO8601 */
  written_at: string;
}

// ─── 索引文件条目 ───

export interface IndexEntry {
  branch_id: string;
  zone: string;          // 目标 zone 文件标识
  position: number;      // zone 文件中的记录位置
  seq_pos: number;       // 全局序列号
  locus_path: string;    // 用于前缀查询
  created_at: string;    // 创建时间
}

// ─── 索引文件 ───

export interface IndexFile {
  version: string;
  last_updated: string;
  entries: IndexEntry[];
}

// ─── 计数器文件 ───

export interface CounterFile {
  version: string;
  lastId: number;
  updated_at: string;
}

// ─── 存储状态 ───

export interface StorageStatus {
  totalRecords: number;
  zoneCounts: Record<string, number>;
  currentSeqPos: number;
  storagePath: string;
}
