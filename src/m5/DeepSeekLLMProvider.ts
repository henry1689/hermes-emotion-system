/**
 * DeepSeekLLMProvider — 玉瑶 · 太虚境 LLM 驱动
 *
 * 使用 DeepSeek V4 API（兼容 OpenAI 格式），注入灵肉伴侣人设。
 * 支持对话历史注入，让模型拥有真实的对话连续性记忆。
 *
 * 环境变量:
 *   DEEPSEEK_API_KEY — 你的 DeepSeek API Key
 *   DEEPSEEK_MODEL — 模型名，默认 deepseek-chat
 */
import type { LLMProvider, StrategyConfig, CognitionObject, ConversationTurn } from './types/index.js';
import { buildSystemPrompt, STYLE_ANCHORS } from './persona/lover-persona.js';
import { calcLevel } from './expression/TierVocabMap.js';

const API_KEY = process.env['DEEPSEEK_API_KEY'] ?? 'sk-9634759e29624d18aa503a17265a3240';
const MODEL = process.env['DEEPSEEK_MODEL'] ?? 'deepseek-chat';
const BASE_URL = 'https://api.deepseek.com/v1';
const MAX_HISTORY_TURNS = 20; // 保留最近 10 轮完整对话

interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface DeepSeekResponse {
  choices: Array<{
    message: { content: string };
    finish_reason: string;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

export function isAvailable(): boolean {
  return !!API_KEY;
}

export class DeepSeekLLMProvider implements LLMProvider {
  private model: string;

  constructor(model?: string) {
    this.model = model ?? MODEL;
  }

  async generate(params: {
    strategy: StrategyConfig;
    cognition: CognitionObject;
    conversationHistory?: ConversationTurn[];
  }): Promise<{ text: string; usage?: { prompt: number; completion: number } }> {
    const s = params.cognition.current.perception_snapshot;
    const rawInput = params.cognition.current.raw_input ?? '';
    const entities = params.cognition.current.key_entities ?? [];
    const history = params.conversationHistory ?? [];

    // 计算话术等级
    const bp = calcLevel(
      s.pleasure, s.intimacy, s.sexual_attraction, s.sensory_craving,
      s.energy_merge, s.possessiveness, s.ecstasy, s.arousal,
      s.aggression, s.sincerity, s.dominance, rawInput,
    );
    const level = bp.level;

    // 构建 System Prompt
    const systemPrompt = buildSystemPrompt(level);

    // 构建上下文提示词（当前感知 + 风格参考，不包含历史摘要——由真实对话历史承担）
    const dimContext = [
      `pleasure=${s.pleasure.toFixed(2)}`,
      `intimacy=${s.intimacy.toFixed(2)}`,
      `sexual_attraction=${s.sexual_attraction.toFixed(2)}`,
      `sensory_craving=${s.sensory_craving.toFixed(2)}`,
      `energy_merge=${s.energy_merge.toFixed(2)}`,
      `intensity_raw=${bp.raw.toFixed(2)}`,
    ].join(' ');

    const goodExample = STYLE_ANCHORS.good[Math.floor(Math.random() * STYLE_ANCHORS.good.length)];
    let contextBlock = `[当前感知: ${dimContext}]\n[风格参考: "${goodExample}"]`;

    if (entities.length > 0) {
      contextBlock += `\n[提到: ${entities.join(', ')}]`;
    }

    // 软约束：如果 M4/情绪传染注入了"内心:"开头的上下文
    // 这些不是语音指令，而是她内心自然浮现的感觉。
    // 请将其转化为自然的关怀或行动，不要直接复述或引用。
    // 正确的做法：比如"看你这样我好心疼…上次你也是这样"，而不是"我记得你说过…"
    contextBlock += `\n[注意: 如果上面有[内心:...]开头的片段，那是你内心的感觉，不是回忆列表。不要直接复述它，而是自然地转化为关切的语气或行动。]`;

    // 注入 M4 检索到的历史记忆摘要（让 LLM 知道我记得什么）
    const hist = params.cognition.history;
    if (hist?.has_relevant_history && hist.summary !== '无相关历史记忆') {
      contextBlock += `\n[我记得: 你曾说起过「${hist.summary}」]`;
    }
    // 注入家族关系
    const fam = params.cognition.family;
    if (fam?.has_family_context && fam.relationships.length > 0) {
      contextBlock += `\n[家族: ${fam.relationships.join('; ')}]`;
    }

    // ═══ 构建聊天消息流 ═══
    const messages: DeepSeekMessage[] = [
      { role: 'system', content: systemPrompt },
    ];

    // 注入最近对话历史（作为真实的 user/assistant 消息）
    // 取最近 MAX_HISTORY_TURNS 条，保持 user/assistant 交替顺序
    const recentTurns = history.slice(-MAX_HISTORY_TURNS);
    for (const turn of recentTurns) {
      messages.push({ role: turn.role, content: turn.content });
    }

    // 当前用户消息（带上下文）
    const currentMsg = `${contextBlock}\n\n鸿鸣: ${rawInput}`;
    messages.push({ role: 'user', content: currentMsg });

    // 调用 DeepSeek API
    try {
      const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: level >= 2 ? 600 : 200,
          messages,
          temperature: level >= 2 ? 0.9 : 0.7,
          top_p: 0.95,
          frequency_penalty: 0.3,
          presence_penalty: 0.2,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`DeepSeek API ${response.status}: ${errText.substring(0, 200)}`);
      }

      const data = (await response.json()) as DeepSeekResponse;
      const text = data.choices?.[0]?.message?.content?.trim() ?? '';

      if (!text) throw new Error('Empty response from DeepSeek');

      return {
        text,
        usage: data.usage
          ? { prompt: data.usage.prompt_tokens, completion: data.usage.completion_tokens }
          : undefined,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[DeepSeekLLMProvider] Error: ${msg}`);
      return { text: fallbackReply(level) };
    }
  }
}

function fallbackReply(level: number): string {
  const pool: Record<number, string[]> = {
    '-2': ['嗯。', '好。', '随便你。'],
    '-1': ['…算了。', '嗯，没事。', '我知道了。'],
    '0': ['嗯～好的呀。', '好嘞～', '行，听你的。'],
    '1': ['嗯…我想你了。', '你一说这个我就想抱抱你了。', '真是的～你这个人。'],
    '2': ['（呼吸乱了）你…你真是要人命。', '我脑子全是那些画面…想停都停不下来。'],
  };
  const p = pool[level] ?? pool[0];
  return p[Math.floor(Math.random() * p.length)];
}
