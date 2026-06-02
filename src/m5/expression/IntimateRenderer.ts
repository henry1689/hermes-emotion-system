// IntimateRenderer — 私密场景回应渲染器
// 核心: 知识库仅存事实锚点，感受/语气/节奏全由LLM实时生成
// 句式: 短句堆叠 + 生理反应前置 + 语无伦次 + 第二人称侵入

import { getPhrases, getShortBurst, getAftercareLine } from './IntimateLexicon.js';
import { injectThinkingPause } from './ThinkingPauseInjector.js';

export interface IntimateScene {
  /** 场景强度 (0-1) */
  intensity: number;
  /** 最大化维度 */
  primaryDim: 'I1' | 'I2' | 'I3' | 'I5' | 'S1' | 'E2';
  /** 是否要事后温存 */
  isAftercare: boolean;
  /** 是否是高潮场景 */
  isClimax: boolean;
}

/**
 * 渲染私密场景回应
 * 激情模式强制: 短句堆叠 + 生理前置 + 第二人称 + 300-500字
 */
export function renderIntimate(scene: IntimateScene): string {
  const { intensity, isAftercare, isClimax } = scene;

  // 事后温存模式
  if (isAftercare) {
    return renderAftercare();
  }

  // 高潮场景
  if (isClimax) {
    return renderClimax(intensity);
  }

  // 普通激情场景
  return renderGeneralIntimate(intensity);
}

function renderAftercare(): string {
  const parts: string[] = [];

  // 开场：身体反应
  parts.push('（喘着气，慢慢地平复下来）');

  // 主体：事后感受
  parts.push(getAftercareLine());
  parts.push(getAftercareLine());

  // 插入停顿
  const text = parts.join('。');
  return injectThinkingPause(text, 0.5);
}

function renderClimax(intensity: number): string {
  const parts: string[] = [];

  // 开场：生理反应
  parts.push('（整个人都在抖）');
  parts.push('操…你真的太会了…');

  // 短句堆叠（模拟喘息节奏）
  if (intensity > 0.7) {
    parts.push(getShortBurst());
    parts.push(getShortBurst());
  }

  // 高潮细节
  const climaxPhrases = getPhrases(2, '失控', 2);
  parts.push(...climaxPhrases);

  // 事后温存过渡
  parts.push(getAftercareLine());

  let text = parts.join('。');

  // 高强度停顿注入
  if (intensity > 0.7) {
    text = injectThinkingPause(text, 0.7);
  }

  return text;
}

function renderGeneralIntimate(intensity: number): string {
  const parts: string[] = [];

  // 开场：身体反应
  const openings = [
    '（喘着气，缓了好一会儿）',
    '（声音有点抖）',
    '（深呼吸了一下）',
    '（吸了口气，像是在压着什么）',
  ];
  parts.push(openings[Math.floor(Math.random() * openings.length)]);

  // 选择合适层级的短语
  const level = intensity > 0.7 ? 2 : 1;
  const actionPhrases = getPhrases(level, '动作', 2);
  const feelPhrases = getPhrases(level, '感受', 2);

  // 短句堆叠（高强度时）
  if (intensity > 0.6) {
    parts.push(getShortBurst());
  }

  parts.push(...actionPhrases);
  parts.push(...feelPhrases);

  let text = parts.join('。');

  if (intensity > 0.5) {
    text = injectThinkingPause(text, intensity);
  }

  return text;
}

/**
 * 构建完整的长回应（300-500字）
 * 规则: 短句 + 生理前置 + 无比喻 + 第二人称
 */
export function renderLongIntimate(
  intensity: number,
  scene: 'foreplay' | 'thrust' | 'climax' | 'aftercare',
): string {
  if (scene === 'aftercare') return renderAftercare();
  if (scene === 'climax') return renderClimax(intensity);

  const sections: string[] = [];

  // 第1段: 生理反应开场
  const firstOpenings = [
    '（喘着粗气）光听你说这个我都有反应了。',
    '（咽了口口水）你描述得太具体了…操。',
    '（呼吸变得又急又重）你别说了…我…',
  ];
  sections.push(firstOpenings[Math.floor(Math.random() * firstOpenings.length)]);

  // 第2段: 动作描写
  const acts = getPhrases(2, '动作', 3);
  if (acts.length > 0) sections.push(acts.slice(0, 2).join('。'));

  // 第3段: 失控感
  const loss = getPhrases(2, '失控', 2);
  if (loss.length > 0) sections.push(loss.slice(0, 1).join(''));

  // 第4段: 声音/感官
  const sounds = getPhrases(2, '声音', 2);
  if (sounds.length > 0) sections.push(sounds.slice(0, 1).join(''));

  // 第5段: 短句燃烧
  sections.push(getShortBurst());
  sections.push(getShortBurst());

  // 结尾: 温存过渡
  sections.push('（慢慢平复呼吸）…');

  // 事后感
  const holds = getPhrases(1, '感受', 1);

  if (holds.length > 0) sections.push(holds[0]);

  let text = sections.join('。');
  text = injectThinkingPause(text, 0.7);

  return text;
}
