// M5 表达生成层类型定义
// Ref: M5-design-v1.md §2-§4

import type { M3Action, M3Context } from '../../m3/types/perception.js';

export interface CognitionObject {
  current: {
    action: M3Action[];
    emotion_summary: string;
    key_entities: string[];
    calcium_level: number;
  };
  history: {
    has_relevant_history: boolean;
    summary: string;
    time_span: string;
  };
  family?: {
    has_family_context: boolean;
    relationships: string[];
  };
  strategy_hint: {
    tone: 'warm' | 'neutral' | 'serious';
    depth: 'shallow' | 'medium' | 'deep';
    urgency: 'low' | 'medium' | 'high';
  };
}

export interface StrategyConfig {
  strategy_id: string;
  params: {
    tone: string;
    emotion_color?: string;
    max_length: number;
    include_entity: string[];
    include_history: boolean;
    include_family: boolean;
  };
  description: string;
}

export interface LLMProvider {
  generate(params: {
    strategy: StrategyConfig;
    cognition: CognitionObject;
  }): Promise<{ text: string; usage?: { prompt: number; completion: number } }>;
}
