// M2 存储适配器常量定义
// Ref: SPEC.md §4.2 物理存储方案
// Ref: M2-design-v1.md §5

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** 项目根目录（相对于 src/m2/constants.ts 的路径） */
export const PROJECT_ROOT = join(__dirname, '..', '..');

/** 数据存储根目录 */
export const DATA_DIR = join(PROJECT_ROOT, 'data');

/** 5大语义区存储目录 */
export const ZONES_DIR = join(DATA_DIR, 'zones');

/** counter.json 路径 */
export const COUNTER_FILE = join(DATA_DIR, 'counter.json');

/** index.json 路径 */
export const INDEX_FILE = join(DATA_DIR, 'index.json');

/** 5 大语义区的文件名映射 */
export const ZONE_FILE_MAP: Record<string, string> = {
  language_semantic_zone: 'language_semantic_zone.json',
  emotion_valence_zone: 'emotion_valence_zone.json',
  embodied_perception_zone: 'embodied_perception_zone.json',
  spatiotemporal_episode_zone: 'spatiotemporal_episode_zone.json',
  social_schema_zone: 'social_schema_zone.json',
};

/** Zone 缩写映射（用于生成真实 ref） */
export const ZONE_ABBR_MAP: Record<string, string> = {
  language_semantic_zone: 'lang',
  emotion_valence_zone: 'emo',
  embodied_perception_zone: 'body',
  spatiotemporal_episode_zone: 'space',
  social_schema_zone: 'soc',
};

/** 反转：缩写 → zone 标识（用于解析 ref） */
export const ABBR_ZONE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(ZONE_ABBR_MAP).map(([k, v]) => [v, k])
);
