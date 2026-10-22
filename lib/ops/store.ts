import type { AbTest, Annotation, Improvement, Rating } from "./types";
import { database, type SqlDatabase } from "../database";
type Entity = Rating | Annotation | Improvement | AbTest;

declare global {
  var __snackOpsRatings: Map<string, Rating> | undefined;
  var __snackOpsAnnotations: Map<string, Annotation> | undefined;
  var __snackOpsImprovements: Map<string, Improvement> | undefined;
  var __snackOpsAbTests: Map<string, AbTest> | undefined;
}
const ratings = globalThis.__snackOpsRatings ??= new Map();
const annotations = globalThis.__snackOpsAnnotations ??= new Map();
const improvements = globalThis.__snackOpsImprovements ??= new Map();
const abTests = globalThis.__snackOpsAbTests ??= new Map();

async function ensureSchema(db: SqlDatabase) {
  await db.prepare("CREATE TABLE IF NOT EXISTS ops_ratings (id TEXT PRIMARY KEY NOT NULL, run_id TEXT NOT NULL, score INTEGER NOT NULL, created_at TEXT NOT NULL, record_json TEXT NOT NULL)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS ops_ratings_run_idx ON ops_ratings(run_id, created_at DESC)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS ops_annotations (id TEXT PRIMARY KEY NOT NULL, run_id TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, record_json TEXT NOT NULL)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS ops_annotations_run_idx ON ops_annotations(run_id, created_at DESC)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS ops_improvements (id TEXT PRIMARY KEY NOT NULL, run_id TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, record_json TEXT NOT NULL)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS ops_ab_tests (id TEXT PRIMARY KEY NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, record_json TEXT NOT NULL)").run();
}
async function save(table: string, entity: Entity, columns: [string, unknown][], memory: Map<string, Entity>) {
  memory.set(entity.id, structuredClone(entity));
  const db = await database(); if (!db) return;
  await ensureSchema(db);
  const names = ["id", ...columns.map(([name]) => name), "record_json"];
  const values = [entity.id, ...columns.map(([, value]) => value), JSON.stringify(entity)];
  await db.prepare(`INSERT INTO ${table} (${names.join(",")}) VALUES (${names.map(() => "?").join(",")}) ON CONFLICT(id) DO UPDATE SET record_json=excluded.record_json${columns.map(([name]) => `, ${name}=excluded.${name}`).join("")}`).bind(...values).run();
}
async function list<T extends Entity>(table: string, memory: Map<string, T>): Promise<T[]> {
  const db = await database();
  if (db) { await ensureSchema(db); const rows = await db.prepare(`SELECT record_json FROM ${table} ORDER BY created_at DESC`).all<{ record_json: string }>(); return rows.results.map((row) => JSON.parse(row.record_json) as T); }
  return [...memory.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((item) => structuredClone(item));
}
export async function saveRating(value: Rating) { await save("ops_ratings", value, [["run_id", value.runId], ["score", value.score], ["created_at", value.createdAt]], ratings as Map<string, Entity>); return value; }
export async function listRatings() { return list("ops_ratings", ratings); }
export async function saveAnnotation(value: Annotation) { await save("ops_annotations", value, [["run_id", value.runId], ["status", value.status], ["created_at", value.createdAt]], annotations as Map<string, Entity>); return value; }
export async function listAnnotations() { return list("ops_annotations", annotations); }
export async function getAnnotation(id: string) { return (await listAnnotations()).find((item) => item.id === id) ?? null; }
export async function saveImprovement(value: Improvement) { await save("ops_improvements", value, [["run_id", value.runId], ["status", value.status], ["created_at", value.createdAt]], improvements as Map<string, Entity>); return value; }
export async function listImprovements() { return list("ops_improvements", improvements); }
export async function getImprovement(id: string) { return (await listImprovements()).find((item) => item.id === id) ?? null; }
export async function saveAbTest(value: AbTest) { await save("ops_ab_tests", value, [["status", value.status], ["created_at", value.createdAt]], abTests as Map<string, Entity>); return value; }
export async function listAbTests() { return list("ops_ab_tests", abTests); }

export function improvementFor(source: "low-rating" | "low-annotation" | "bad-case", sourceId: string, runId: string, issueType: Rating["issueType"]): Improvement {
  const direction = issueType === "safety" ? "Planner" : issueType === "correctness" ? "Tool" : issueType === "tone" ? "Skill" : "Eval";
  const suggestions = { Planner: "收紧路由和风险升级条件，并补充人工接管分支。", Skill: "补充回复约束与正反例，明确语气和信息结构。", Tool: "核对工具输入、结果引用与失败降级路径。", Eval: "把该样本沉淀为回归评测，并补充对应评分规则。" } as const;
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), source, sourceId, runId, issueType, direction, title: `${issueType} 问题 · ${direction}`, suggestion: suggestions[direction], clusterLabel: `规则聚类 / ${issueType}`, status: "open", createdAt: now, updatedAt: now };
}
