#!/usr/bin/env tsx
/**
 * Hermes WebUI Server — 玉瑶 · 太虚境
 *
 * 支持 M1-M8 完整观测数据 API + 持久化对话记忆。
 * 运行: npm run webui  |  访问: http://localhost:3000
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, existsSync } from 'node:fs';
import { DNAEncoder } from '../m1/DNAEncoder.js';
import { FusionStorageAdapter } from '../fusion/FusionStorageAdapter.js';
import { M3LogicOrchestrator } from '../m3/M3LogicOrchestrator.js';
import { M4Orchestrator } from '../m4/M4Orchestrator.js';
import { M5Orchestrator } from '../m5/M5Orchestrator.js';
import { DeepSeekLLMProvider } from '../m5/DeepSeekLLMProvider.js';
import { FamilyGraph } from '../m4/FamilyGraph.js';
import { MaintenanceService } from './maintenance.js';
import { InductionScheduler } from '../m7/InductionScheduler.js';
import { computeCalcium, emotionalSimilarity } from '../fusion/math.js';
import type { SimilarityMode, EmotionalMemoryRecord } from '../fusion/types/index.js';
import type { SelfModelV1 } from '../m1/types/dna.js';
import type { ConversationTurn } from '../m5/types/index.js';
import type { M3Decision } from '../m3/types/perception.js';

// ── 路径 ──
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..', '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data', 'webui');
const DB_PATH = path.join(DATA_DIR, 'knowledge', 'family_graph.db');
const HTML_PATH = path.join(__dirname, 'index.html');
const CONV_LOG_PATH = path.join(DATA_DIR, 'conversations.json');
const PORT = parseInt(process.env.PORT || '3000', 10);

const SELF: SelfModelV1 = {
  identity: { name: 'Hermes', persona: '温柔深情的陪伴者', birth_date: '2026-06-02T00:00:00.000Z' },
  traits: { openness: 0.7, conscientiousness: 0.6, extraversion: 0.4, agreeableness: 0.8, neuroticism: 0.3 },
  boundaries: ['不提供医疗建议', '不泄露隐私', '不编造事实'],
  preferences: { likes: ['深度对话'], dislikes: ['敷衍'] },
  narrative_identity: '我是玉瑶，与你共处太虚境',
};

// ── 对话记忆 ──
let conversationHistory: ConversationTurn[] = [];
const MAX_SAVED_TURNS = 200; // 增加上限，维护引擎会接管压缩
function loadConversationHistory(): void {
  try {
    if (existsSync(CONV_LOG_PATH)) {
      const raw = fs.readFileSync(CONV_LOG_PATH, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        conversationHistory = data.filter(
          (t: any) => t.role && (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string'
        );
      }
      console.log(`  从磁盘加载了 ${conversationHistory.length} 条对话记忆 ✓`);
    }
  } catch { conversationHistory = []; }
}
function saveConversationHistory(): void {
  try { fs.writeFileSync(CONV_LOG_PATH, JSON.stringify(conversationHistory.slice(-MAX_SAVED_TURNS), null, 2), 'utf-8'); } catch {}
}
function recordTurn(role: 'user' | 'assistant', content: string): void {
  try { conversationHistory.push({ role, content }); saveConversationHistory(); } catch {}
}
function resetConversationHistory(): void {
  conversationHistory = [];
  try { if (existsSync(CONV_LOG_PATH)) fs.unlinkSync(CONV_LOG_PATH); } catch {}
}

// ── 维护引擎 ──
const maintenance = new MaintenanceService();
maintenance.injectDeps({
  conversationHistory,
  getConversationHistory: () => conversationHistory,
  setConversationHistory: (h) => { conversationHistory = h; },
  saveConversationHistory,
  // 惰性 getter — storage 在 initPipeline() 中才赋值
  storage: () => storage,
});

// ── 管道 ──
let encoder: DNAEncoder;
let storage: FusionStorageAdapter;
let m3: M3LogicOrchestrator;
let familyGraph: FamilyGraph;
let m4: M4Orchestrator;
let m5: M5Orchestrator;
let inductionScheduler: InductionScheduler;
async function initPipeline(): Promise<void> {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  encoder = new DNAEncoder(SELF);
  storage = new FusionStorageAdapter(DATA_DIR);
  await storage.initialize();
  familyGraph = new FamilyGraph(DB_PATH);
  await familyGraph.initialize();
  m4 = new M4Orchestrator(storage as any, familyGraph); // FusionStorageAdapter 兼容 StorageAdapter 接口
  await m4.initialize();
  m3 = new M3LogicOrchestrator();
  m5 = new M5Orchestrator(new DeepSeekLLMProvider());
  loadConversationHistory();
  maintenance.start(); // 启动维护引擎
  console.log('  维护引擎已启动 ✓');
  inductionScheduler = new InductionScheduler(storage);
  inductionScheduler.start();
  console.log('  归纳调度器已启动 ✓');
  console.log(`  融合存储已初始化 (${storage.getSQLite().getStatus().totalRecords} 条记忆 ✓`);
}

// ── M5 策略推导（等同 StrategySelector + CognitionAssembler 逻辑） ──
function deriveM5Strategy(decision: M3Decision): {
  strategy_id: string; tone: string; depth: string; max_length: number;
  description: string;
} {
  const p = decision.enhanced.perception;
  const actions = decision.actions;
  const hasIntimate = p.sexual_attraction > 0.2 || p.sensory_craving > 0.3 || p.intimacy > 0.4;
  const tone = hasIntimate ? 'intimate' : actions.includes('comfort') ? 'warm' : actions.includes('act') ? 'serious' : 'neutral';
  const depth = decision.enhanced.calcium_level >= 3 ? 'deep' : decision.enhanced.calcium_level >= 2 ? 'medium' : 'shallow';
  let strategy_id = 'mem-general', desc = '简短确认', max_len = 20;
  if (actions.includes('act')) { strategy_id = 'act-core'; desc = '核心响应'; max_len = 150; }
  else if (actions.includes('comfort')) { strategy_id = 'com-warm'; desc = '温暖共情'; max_len = 100; }
  else if (actions.includes('ask') && actions.includes('memorize')) { strategy_id = 'mem-ask'; desc = '确认追问'; max_len = 60; }
  else if (actions.includes('ask')) { strategy_id = 'ask-curious'; desc = '好奇追问'; max_len = 80; }
  return { strategy_id, tone, depth, max_length: max_len, description: desc };
}

// ── 安全读取 JSON 辅助 ──
function readJSON<T>(fp: string, def: T): T {
  try { return existsSync(fp) ? JSON.parse(fs.readFileSync(fp, 'utf-8')) : def; } catch { return def; }
}

// ════════════════════════════════════════════════════════
// Chat API
// ════════════════════════════════════════════════════════
interface ChatResponse {
  reply: string; turn_count: number;
  m1: { branch_id: string; locus_path: string; seq_pos: number; leaf_zone: string; ref: string; entities: Array<{ name: string; type: string }>; raw_input: string; entity_genes: any[] };
  m3: {
    quadrant1: any[]; quadrant2: any[]; quadrant3: any[]; quadrant4: any[];
    calcium: { score: number; level: number; label: string; breakdown: any };
    actions: string[]; reason: string;
  };
  m4: { timeline: Array<{ time: string; summary: string }>; total: number; family: number };
  m5: { strategy_id: string; tone: string; depth: string; max_length: number; description: string };
}

const FALLBACK_REPLIES = ['嗯，我在听。你说。','好呀，你接着说～','唔…我在呢。你继续说吧。','嗯～你说什么我都喜欢听。'];
const LEVEL_NAMES = ['粉末','液体','固体','晶体'];
const PERC_LABELS: Record<string,{q:number;label:string}> = {
  pleasure:{q:1,label:'E1愉悦度'}, arousal:{q:1,label:'E2唤醒度'}, dominance:{q:1,label:'E3支配感'},
  aggression:{q:1,label:'E4攻击性'}, sincerity:{q:1,label:'E5真诚度'}, humor:{q:1,label:'E6幽默感'},
  factual:{q:2,label:'C1事实性'}, logical:{q:2,label:'C2逻辑性'}, certainty:{q:2,label:'C3确定性'},
  abstract:{q:2,label:'C4抽象度'}, temporal_focus:{q:2,label:'C5时间焦点'}, self_ref:{q:2,label:'C6自我参照'},
  intimacy:{q:3,label:'S1亲密度'}, power_diff:{q:3,label:'S2权力差'}, dependency:{q:3,label:'S3依赖度'},
  moral_judgment:{q:3,label:'S4道德审判'}, etiquette:{q:3,label:'S5社交礼仪'}, belonging:{q:3,label:'S6群体归属'},
  sexual_attraction:{q:4,label:'I1性吸引力'}, sensory_craving:{q:4,label:'I2感官渴望'}, energy_merge:{q:4,label:'I3能量交融'},
  possessiveness:{q:4,label:'I4占有欲'}, ecstasy:{q:4,label:'I5愉悦/高潮'}, safety:{q:4,label:'I6安全感'},
};

async function processChat(message: string): Promise<ChatResponse> {
  try {
    const dna = encoder.encodeSingle(message);
    // 新 pipeline: decide → write(含感知向量)
    const decision = m3.decide(dna, { current_time: new Date().toISOString(), current_location: '深圳' });
    const p = decision.enhanced.perception;
    const wr = await storage.write(dna, p);
    const ctx = await m4.orchestrate(decision);

    // ── 情绪传染：根据当前情绪检索相似记忆，注入 M5 上下文 ──
    let enrichedHistory = [...conversationHistory];
    try {
      const mode: SimilarityMode =
        p.pleasure < -0.2 ? 'mood_congruent' :
        p.intimacy > 0.4 ? 'intimacy_search' :
        p.arousal > 0.6 ? 'by_calcium' :
        'balanced';
      const memories = storage.findByEmotionalSimilarity({
        current_perception: p,
        similarity_mode: mode,
        limit: 3,
      });
      const valid = memories.filter(m => m.composite > 0.25 && m.record.id !== dna.branch_id);
      if (valid.length > 0) {
        const inject = valid.map((m, i) => {
          const feeling = m.record.calcium_score > 0.6 ? '（这件事当时对你很重要）' : '（我记得你那时候的感觉）';
          const action = m.record.perception.pleasure > 0 ? '温暖的感觉' : '那种心情';
          return `[内心: 看到鸿鸣现在的样子，让我想起${action}……"${m.record.raw_input.substring(0, 60)}"${feeling}]`;
        }).join('\n');
        enrichedHistory.unshift({ role: 'assistant', content: inject });
      }
    } catch (err) {
      // 情绪传染失败不退整个流程
      console.warn('[EmotionContagion] 检索失败:', err);
    }

    let reply: string;
    try { reply = await m5.orchestrate(ctx, enrichedHistory); } catch { reply = FALLBACK_REPLIES[Math.floor(Math.random() * FALLBACK_REPLIES.length)]; }
    recordTurn('user', message); recordTurn('assistant', reply);

    const cl = decision.enhanced.calcium_level;
    const allDims: any[] = [];
    for (const [key, meta] of Object.entries(PERC_LABELS)) {
      const val = (p as any)[key];
      if (typeof val === 'number') allDims.push({ label: meta.label, key, value: Number(val.toFixed(3)), q: meta.q });
    }
    const m5s = deriveM5Strategy(decision);

    return {
      reply, turn_count: Math.floor(conversationHistory.length / 2),
      m1: {
        branch_id: dna.branch_id, locus_path: dna.locus_path, seq_pos: wr.seq_pos,
        leaf_zone: dna.leaf_zone, ref: wr.real_ref,
        entities: dna.entity_genes.map(e => ({ name: e.name, type: e.type })),
        raw_input: dna.raw_input, entity_genes: dna.entity_genes,
      },
      m3: {
        quadrant1: allDims.filter((d:any) => d.q === 1), quadrant2: allDims.filter((d:any) => d.q === 2),
        quadrant3: allDims.filter((d:any) => d.q === 3), quadrant4: allDims.filter((d:any) => d.q === 4),
        calcium: { score: Number(decision.enhanced.calcium_score.toFixed(3)), level: cl, label: LEVEL_NAMES[cl] ?? '?', breakdown: { base_core: 0, emotional_boost: 0, threat_bonus: 0 } },
        actions: decision.actions, reason: decision.reason,
      },
      m4: {
        timeline: ctx.memory_summary.timeline.map(t => ({ time: t.time, summary: t.summary })),
        total: ctx.memory_summary.timeline.length, family: ctx.family_context?.length ?? 0,
      },
      m5: m5s,
    };
  } catch (err) {
    console.error('[chat]', err);
    const fb = FALLBACK_REPLIES[Math.floor(Math.random() * FALLBACK_REPLIES.length)];
    return {
      reply: fb, turn_count: Math.floor(conversationHistory.length / 2),
      m1: { branch_id:'', locus_path:'error', seq_pos:0, leaf_zone:'', ref:'', entities:[], raw_input:message, entity_genes:[] },
      m3: { quadrant1:[], quadrant2:[], quadrant3:[], quadrant4:[], calcium:{score:0,level:0,label:'?',breakdown:{}}, actions:['error'], reason:'' },
      m4: { timeline:[], total:0, family:0 },
      m5: { strategy_id:'fallback', tone:'neutral', depth:'shallow', max_length:20, description:'降级兜底' },
    };
  }
}

// ════════════════════════════════════════════════════════
// HTTP Server
// ════════════════════════════════════════════════════════
function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  try {
    // ── 首页 ──
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(HTML_PATH, 'utf-8'));
      return;
    }

    // ── 聊天 ──
    if (req.method === 'POST' && url.pathname === '/api/chat') {
      const body = JSON.parse(await readBody(req));
      if (!body.message || typeof body.message !== 'string') { res.writeHead(400); res.end(JSON.stringify({error:'message required'})); return; }
      const result = await processChat(body.message.trim());
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
      return;
    }

    // ── 重置 ──
    if (req.method === 'POST' && url.pathname === '/api/reset') {
      resetConversationHistory();
      await initPipeline();
      res.writeHead(200); res.end(JSON.stringify({status:'ok',message:'已重置'}));
      return;
    }

    // ── 状态（含M2存储+家族） ──
    if (req.method === 'GET' && url.pathname === '/api/status') {
      const storageStatus = await storage.getStatus().catch(() => null);
      const familySummary = await familyGraph.getFamilySummary().catch(() => ({ members: [], locations: [] }));
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        status: 'running', version: '0.1.0',
        conversation_turns: Math.floor(conversationHistory.length / 2),
        storage: storageStatus ? {
          total_records: storageStatus.totalRecords,
          zone_counts: storageStatus.zoneCounts,
          seq_pos: storageStatus.currentSeqPos,
        } : null,
        family: { members: familySummary.members.map((m: any) => ({ name: m.name, relation: m.relation_to_user })), total: familySummary.members.length },
      }));
      return;
    }

    // ── 健康检查（含维护指标） ──
    if (req.method === 'GET' && url.pathname === '/api/health') {
      const health = maintenance.getHealth();
      const storageStatus = await storage.getStatus().catch(() => null);
      if (storageStatus) {
        health.storage.totalRecords = storageStatus.totalRecords;
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(health));
      return;
    }

    // ── 手动触发对话压缩 ──
    if (req.method === 'POST' && url.pathname === '/api/maintenance/compact') {
      const result = await maintenance.triggerCompaction();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ status: 'ok', ...result }));
      return;
    }

    // ── 搜索 ──
    if (req.method === 'POST' && url.pathname === '/api/search') {
      const body = JSON.parse(await readBody(req));
      const query = (body.query || '').trim().toLowerCase();
      if (!query) { res.writeHead(400); res.end(JSON.stringify({error:'query required'})); return; }
      const results = conversationHistory.map((t, i) => ({ index: i, ...t })).filter(t => t.content.toLowerCase().includes(query)).slice(-20);
      res.writeHead(200); res.end(JSON.stringify({ query, total: results.length, results }));
      return;
    }

    // ── 情感相似度搜索（调试/可视化用） ──
    if (req.method === 'POST' && url.pathname === '/api/emotion-search') {
      const body = JSON.parse(await readBody(req));
      const text = (body.query || body.message || '').trim();
      const mode: SimilarityMode = body.mode || 'balanced';
      const limit = body.limit || 10;

      if (!text) { res.writeHead(400); res.end(JSON.stringify({error:'query required'})); return; }

      // 用 M3 分析输入文本，提取感知向量
      const mockDna = {
        branch_id: 'search', seq_pos: 0, locus_path: 'user.misc.default',
        taxonomy_version: '1.0', leaf_zone: 'language_semantic_zone',
        ref: 'tmp', entity_genes: [], raw_input: text, created_at: new Date().toISOString(),
      };
      const decision = m3.decide(mockDna as any);
      const query = {
        current_perception: decision.enhanced.perception,
        locus_path: body.locus_path,
        entities: body.entities || [],
        similarity_mode: mode,
        limit,
      };
      const results = storage.findByEmotionalSimilarity(query);

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        query: { text, mode, calcium: computeCalcium(decision.enhanced.perception) },
        results: results.map(r => ({
          id: r.record.id,
          snippet: r.record.raw_input.substring(0, 80),
          created_at: r.record.created_at,
          calcium: r.record.calcium_score,
          strength: Math.round(r.record.effective_strength * 100) / 100,
          scores: {
            composite: Math.round(r.composite * 100) / 100,
            emotional: Math.round(r.scores.emotional * 100) / 100,
            topic: Math.round(r.scores.topic * 100) / 100,
            entity: Math.round(r.scores.entity * 100) / 100,
            calcium_score: Math.round(r.scores.calcium * 100) / 100,
          },
        })),
        total: results.length,
      }));
      return;
    }

    // ── 历史归纳记录 ──
    if (req.method === 'GET' && url.pathname === '/api/inductions') {
      const inductions = inductionScheduler?.getInductions() ?? [];
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ total: inductions.length, inductions }));
      return;
    }

    // ── 情感地形图 ──
    if (req.method === 'GET' && url.pathname === '/api/landscape') {
      const landscape = storage.getEmotionalLandscape();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(landscape));
      return;
    }

    // ── 触发衰减维护 ──
    if (req.method === 'POST' && url.pathname === '/api/maintenance/decay') {
      const result = storage.runDecayMaintenance();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ status: 'ok', ...result }));
      return;
    }

    // ── 家族图谱 ──
    if (req.method === 'GET' && url.pathname === '/api/family') {
      const summary = await familyGraph.getFamilySummary().catch(() => ({ members: [], locations: [] }));
      res.writeHead(200); res.end(JSON.stringify(summary));
      return;
    }

    // ── 全模块数据 M5-M8 ──
    if (req.method === 'GET' && url.pathname === '/api/modules') {
      // M6: 自我模型
      const selfModel = readJSON(path.join(PROJECT_ROOT, 'data', 'self_model.json'), { traits: {}, preferences: [], boundaries: [], narrative_layers: [], version: '?' });

      // M7: 梦境
      const pendingDreams = readJSON(path.join(PROJECT_ROOT, 'data', 'dreams', 'pending_dreams.json'), []);
      const interactionLogs = readJSON(path.join(PROJECT_ROOT, 'data', 'dreams', 'interaction_logs.json'), []);

      // M8: 年轮
      const yearRings = readJSON(path.join(PROJECT_ROOT, 'data', 'year_rings', 'year_rings.json'), []);
      const scars = readJSON(path.join(PROJECT_ROOT, 'data', 'year_rings', 'scars.json'), []);

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        m6: {
          traits: selfModel.traits || {},
          preferences: (selfModel.preferences || []).slice(0, 10),
          boundaries: (selfModel.boundaries || []).slice(0, 10),
          narrative_layers: (selfModel.narrative_layers || []).slice(0, 5),
          version: selfModel.version || '?',
        },
        m7: {
          pending_dreams: pendingDreams.slice(0, 10),
          total_pending: pendingDreams.length,
          interaction_logs: interactionLogs.slice(-10),
          total_logs: interactionLogs.length,
        },
        m8: {
          total_entries: yearRings.length,
          total_scars: scars.length,
          healed_scars: scars.filter((s: any) => s.healed).length,
          unhealed_scars: scars.filter((s: any) => !s.healed).length,
          recent_entries: yearRings.slice(-5),
        },
      }));
      return;
    }

    res.writeHead(404); res.end('404');
  } catch (err: any) {
    console.error('[WebUI] Error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
  }
}

async function main(): Promise<void> {
  await initPipeline();
  console.log('  玉瑶 · 太虚境 WebUI 初始化完成 ✓');
  const server = http.createServer(handleRequest);
  server.listen(PORT, () => {
    console.log('');
    console.log('  ╔══════════════════════════════════════╗');
    console.log('  ║    玉瑶 · 太虚境  WebUI              ║');
    console.log('  ║                                      ║');
    console.log(`  ║   http://localhost:${PORT}               ║`);
    console.log('  ║                                      ║');
    console.log('  ║   /api/chat   聊天+M1-M5数据         ║');
    console.log('  ║   /api/modules M6-M8全模块数据       ║');
    console.log('  ║   /api/reset  重置                  ║');
    console.log('  ║   /api/search 线索检索              ║');
    console.log('  ║   Ctrl+C     退出                   ║');
    console.log('  ╚══════════════════════════════════════╝');
    console.log('');
  });
}
main().catch(err => { console.error('启动失败:', err); process.exit(1); });
