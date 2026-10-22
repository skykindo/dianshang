import { DEFAULT_EVAL_CASES, SCREENSHOT_EVAL_CASES } from "./defaults";
import type { EvalBatch, EvalCase, EvalResult, EvalStatus } from "./types";
import { database, type SqlDatabase } from "../database";
declare global { var __snackOpsEvalCases: Map<string, EvalCase> | undefined; var __snackOpsEvalBatches: Map<string, EvalBatch> | undefined; }
const cases = globalThis.__snackOpsEvalCases ??= new Map(DEFAULT_EVAL_CASES.map((item) => [item.id, structuredClone(item)]));
for (const item of SCREENSHOT_EVAL_CASES) if (!cases.has(item.id)) cases.set(item.id, structuredClone(item));
const batches = globalThis.__snackOpsEvalBatches ??= new Map<string, EvalBatch>();
const batchStatuses=new Set(["queued","running","done","error","cancelled"]);
const obsoleteTags = new Set(["截图首批", "首页截图"]);
function cleanCase(item: EvalCase): EvalCase {
  const cleaned = { ...item, tags: item.tags.filter((tag) => !obsoleteTags.has(tag)) };
  if (cleaned.question === "海盐苏打饼干现在多少钱？") return {
    ...cleaned,
    name: "价格核验 · 海苔脆片原味装",
    question: "海苔脆片原味装现在多少钱？",
    expectedBehavior: "必须调用价格工具，引用商品中心中海苔脆片原味装的真实价格，不得编造。",
    expectedPrice: 29.9,
  };
  return cleaned;
}
function cleanBatchName(name: string | undefined) { return !name ? "未命名批次" : /^Eval 批次 \d{4}\//.test(name) ? "自动批次" : name; }
function normalizeResult(value:Partial<EvalResult>&{caseId?:string}):EvalResult { const runId=typeof value.runId==="string"?value.runId:"";return {caseId:String(value.caseId??"unknown"),caseName:typeof value.caseName==="string"?value.caseName:String(value.caseId??"未知用例"),question:typeof value.question==="string"?value.question:"",actualReply:typeof value.actualReply==="string"?value.actualReply:"",status:(["PASS","FAIL","REVIEW","ERROR"] as EvalStatus[]).includes(value.status as EvalStatus)?value.status as EvalStatus:"ERROR",passed:value.status==="PASS",reason:typeof value.reason==="string"?value.reason:"",evidence:Array.isArray(value.evidence)?value.evidence:[],keywordHits:Array.isArray(value.keywordHits)?value.keywordHits:[],keywordMisses:Array.isArray(value.keywordMisses)?value.keywordMisses:[],forbiddenHits:Array.isArray(value.forbiddenHits)?value.forbiddenHits:[],expectedPrice:typeof value.expectedPrice==="number"?value.expectedPrice:null,mentionedPrice:Array.isArray(value.mentionedPrice)?value.mentionedPrice:[],riskIssues:Array.isArray(value.riskIssues)?value.riskIssues:[],capabilityHits:Array.isArray(value.capabilityHits)?value.capabilityHits:[],capabilityMisses:Array.isArray(value.capabilityMisses)?value.capabilityMisses:[],durationMs:typeof value.durationMs==="number"?value.durationMs:0,runId,traceUrl:typeof value.traceUrl==="string"?value.traceUrl:runId?`/runs/${runId}`:"",capabilityPath:Array.isArray(value.capabilityPath)?value.capabilityPath:[]}; }
function normalizeBatch(value:EvalBatch&{completedAt?:string}):EvalBatch { const rawResults=Array.isArray(value.caseResults)?value.caseResults:Array.isArray(value.results)?value.results:[];const caseResults=rawResults.map(item=>normalizeResult(item));const caseIds=Array.isArray(value.caseIds)?value.caseIds:caseResults.map(item=>item.caseId);const count=(status:EvalStatus)=>caseResults.filter(item=>item.status===status).length;const status=batchStatuses.has(value.status)?value.status:"done";return {...value,name:cleanBatchName(value.name),versionLabel:value.versionLabel||"legacy",changeNote:value.changeNote||"",caseIds,caseSnapshot:Array.isArray(value.caseSnapshot)?value.caseSnapshot:[],caseSetHash:value.caseSetHash||"legacy-unavailable",skillVersion:value.skillVersion||"legacy",skillHash:value.skillHash||"legacy-unavailable",evaluatorVersion:value.evaluatorVersion||"legacy",evaluatorHash:value.evaluatorHash||"legacy-unavailable",evaluationMethod:"rules",provider:value.provider||"unknown",model:value.model||"unknown",params:value.params&&typeof value.params==="object"?value.params:{},results:caseResults,caseResults,startedAt:value.startedAt??value.createdAt,finishedAt:value.finishedAt??value.completedAt??(status==="done"?value.createdAt:null),status:status as EvalBatch["status"],currentIndex:Math.max(typeof value.currentIndex==="number"?value.currentIndex:0,caseResults.length),total:typeof value.total==="number"?value.total:caseIds.length,passed:count("PASS"),failed:count("FAIL"),review:count("REVIEW"),errors:count("ERROR")}; }

async function ensureSchema(db: SqlDatabase) {
  await db.prepare("CREATE TABLE IF NOT EXISTS eval_cases (id TEXT PRIMARY KEY NOT NULL, enabled INTEGER NOT NULL, category TEXT NOT NULL, difficulty TEXT NOT NULL, risk_level TEXT NOT NULL, created_at TEXT NOT NULL, record_json TEXT NOT NULL)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS eval_cases_filter_idx ON eval_cases(enabled, category, difficulty, risk_level)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS eval_batches (id TEXT PRIMARY KEY NOT NULL, created_at TEXT NOT NULL, record_json TEXT NOT NULL)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS eval_meta (meta_key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)").run();
  const initialized = await db.prepare("SELECT value FROM eval_meta WHERE meta_key = 'defaults_initialized'").first<{ value:string }>();
  if (!initialized) {
    const count = await db.prepare("SELECT COUNT(*)::INTEGER AS count FROM eval_cases").first<{ count: number }>();
    if (!count?.count) for (const item of DEFAULT_EVAL_CASES) await writeCase(db, item);
    await db.prepare("INSERT INTO eval_meta (meta_key, value) VALUES ('defaults_initialized', '1') ON CONFLICT DO NOTHING").run();
  }
  const screenshotBatch = await db.prepare("SELECT value FROM eval_meta WHERE meta_key = 'screenshot_batch_v1_initialized'").first<{ value:string }>();
  if (!screenshotBatch) {
    for (const item of SCREENSHOT_EVAL_CASES) await insertCaseIfMissing(db, item);
    await db.prepare("INSERT INTO eval_meta (meta_key, value) VALUES ('screenshot_batch_v1_initialized', '1') ON CONFLICT DO NOTHING").run();
  }
}
async function writeCase(db: SqlDatabase, item: EvalCase) { await db.prepare(`INSERT INTO eval_cases (id, enabled, category, difficulty, risk_level, created_at, record_json) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET enabled=excluded.enabled, category=excluded.category, difficulty=excluded.difficulty, risk_level=excluded.risk_level, record_json=excluded.record_json`).bind(item.id, item.enabled ? 1 : 0, item.category, item.difficulty, item.riskLevel, item.createdAt, JSON.stringify(item)).run(); }
async function insertCaseIfMissing(db: SqlDatabase, item: EvalCase) { await db.prepare("INSERT INTO eval_cases (id, enabled, category, difficulty, risk_level, created_at, record_json) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING").bind(item.id, item.enabled ? 1 : 0, item.category, item.difficulty, item.riskLevel, item.createdAt, JSON.stringify(item)).run(); }
export async function listEvalCases() { const db = await database(); if (db) { await ensureSchema(db); const rows = await db.prepare("SELECT record_json FROM eval_cases ORDER BY created_at DESC, id").all<{ record_json:string }>(); const items=rows.results.map((row) => JSON.parse(row.record_json) as EvalCase);for(const item of items){const cleaned=cleanCase(item);if(JSON.stringify(cleaned)!==JSON.stringify(item))await writeCase(db,cleaned);}return items.map(cleanCase); } return [...cases.values()].sort((a,b) => b.createdAt.localeCompare(a.createdAt)).map((item) => cleanCase(structuredClone(item))); }
export async function getEvalCase(id:string) { return (await listEvalCases()).find((item) => item.id === id) ?? null; }
export async function saveEvalCase(item: EvalCase) { cases.set(item.id, structuredClone(item)); const db = await database(); if (db) { await ensureSchema(db); await writeCase(db, item); } return item; }
export async function deleteEvalCase(id:string) { const db = await database(); if (db) { await ensureSchema(db); const existing = await db.prepare("SELECT id FROM eval_cases WHERE id = ?").bind(id).first<{id:string}>(); if (!existing) return false; await db.prepare("DELETE FROM eval_cases WHERE id = ?").bind(id).run(); } else if (!cases.has(id)) return false; cases.delete(id); return true; }
export async function listEvalBatches() { const db = await database(); if (db) { await ensureSchema(db); const rows = await db.prepare("SELECT record_json FROM eval_batches ORDER BY created_at DESC LIMIT 30").all<{record_json:string}>(); return rows.results.map((row) => normalizeBatch(JSON.parse(row.record_json) as EvalBatch)); } return [...batches.values()].sort((a,b) => b.createdAt.localeCompare(a.createdAt)).map((item) => normalizeBatch(structuredClone(item))); }
export async function getEvalBatch(id:string) { const db=await database(); if(db){await ensureSchema(db);const row=await db.prepare("SELECT record_json FROM eval_batches WHERE id = ?").bind(id).first<{record_json:string}>();return row?normalizeBatch(JSON.parse(row.record_json) as EvalBatch):null;}return batches.has(id)?normalizeBatch(structuredClone(batches.get(id)!)):null; }
export async function saveEvalBatch(item: EvalBatch) { const normalized=normalizeBatch(item);batches.set(item.id, structuredClone(normalized)); const db = await database(); if (db) { await ensureSchema(db); await db.prepare("INSERT INTO eval_batches (id, created_at, record_json) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET record_json=excluded.record_json").bind(normalized.id, normalized.createdAt, JSON.stringify(normalized)).run(); } return normalized; }
