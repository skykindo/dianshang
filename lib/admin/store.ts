import { DEFAULT_LLM_CONFIG, DEFAULT_PLANNER, DEFAULT_SKILLS, DEFAULT_TOOLS } from "./defaults";
import type { LlmConfig, PlannerConfig, SkillConfig, SkillVersion, ToolConfig } from "./types";

type Statement = {
  bind(...values: unknown[]): Statement;
  run(): Promise<{ meta?: { changes?: number }; changes?: number }>;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
};
type Database = { prepare(sql: string): Statement };

declare global {
  var __snackOpsAdminConfig: Map<string, unknown> | undefined;
  var __snackOpsSkillVersions: SkillVersion[] | undefined;
  var __snackOpsSkillSaveQueue: Promise<void> | undefined;
}
const memoryConfig = globalThis.__snackOpsAdminConfig ??= new Map<string, unknown>();
const memoryVersions = globalThis.__snackOpsSkillVersions ??= [];
globalThis.__snackOpsSkillSaveQueue ??= Promise.resolve();

async function database(): Promise<Database | null> {
  try {
    const runtime = await import("cloudflare:workers");
    return ((runtime.env as unknown as { DB?: Database }).DB) ?? null;
  } catch { return null; }
}

async function ensureSchema(db: Database) {
  await db.prepare("CREATE TABLE IF NOT EXISTS admin_config (config_key TEXT PRIMARY KEY NOT NULL, value_json TEXT NOT NULL, updated_at TEXT NOT NULL)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS skill_versions (skill_id TEXT NOT NULL, version INTEGER NOT NULL, snapshot_json TEXT NOT NULL, change_note TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(skill_id, version))").run();
}

async function getValue<T>(key: string, fallback: T): Promise<T> {
  const db = await database();
  if (db) {
    await ensureSchema(db);
    const row = await db.prepare("SELECT value_json FROM admin_config WHERE config_key = ?").bind(key).first<{ value_json: string }>();
    if (row) return JSON.parse(row.value_json) as T;
  }
  const value = memoryConfig.get(key);
  return structuredClone((value ?? fallback) as T);
}

async function setValue<T>(key: string, value: T) {
  const snapshot = structuredClone(value);
  const db = await database();
  if (db) {
    await ensureSchema(db);
    await db.prepare(`INSERT INTO admin_config (config_key, value_json, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(config_key) DO UPDATE SET value_json=excluded.value_json, updated_at=excluded.updated_at`)
      .bind(key, JSON.stringify(snapshot), new Date().toISOString()).run();
  }
  memoryConfig.set(key, snapshot);
}

export async function getSkills() { return getValue<SkillConfig[]>("skills", DEFAULT_SKILLS); }
export async function getTools() { return getValue<ToolConfig[]>("tools", DEFAULT_TOOLS); }
export async function getPlannerConfig() {
  const stored = await getValue<PlannerConfig>("planner", DEFAULT_PLANNER);
  const enabledTools = Array.isArray(stored.enabledTools) ? stored.enabledTools : DEFAULT_PLANNER.enabledTools;
  return {
    ...DEFAULT_PLANNER,
    ...stored,
    enabledSkills: Array.isArray(stored.enabledSkills) ? stored.enabledSkills : DEFAULT_PLANNER.enabledSkills,
    enabledTools,
    mandatoryCapabilities: [...new Set(["risk-check", ...(Array.isArray(stored.mandatoryCapabilities) ? stored.mandatoryCapabilities : [])])],
    toolGroups: {
      base: Array.isArray(stored.toolGroups?.base) ? stored.toolGroups.base : DEFAULT_PLANNER.toolGroups.base.filter((id) => enabledTools.includes(id)),
      pricing: Array.isArray(stored.toolGroups?.pricing) ? stored.toolGroups.pricing : DEFAULT_PLANNER.toolGroups.pricing.filter((id) => enabledTools.includes(id)),
    },
    model: typeof stored.model === "string" ? stored.model : "inherit",
    temperature: typeof stored.temperature === "number" ? stored.temperature : DEFAULT_PLANNER.temperature,
    maxTokens: typeof stored.maxTokens === "number" ? stored.maxTokens : DEFAULT_PLANNER.maxTokens,
  } satisfies PlannerConfig;
}

function applyLlmEnvironment(config: LlmConfig) {
  const effective = structuredClone(config);
  const envProvider = process.env.LLM_PROVIDER;
  if (["coze", "deepseek", "classroom-fixture"].includes(envProvider ?? "")) effective.provider = envProvider as LlmConfig["provider"];
  const envModel = effective.provider === "deepseek" ? process.env.DEEPSEEK_MODEL ?? process.env.LLM_MODEL : process.env.LLM_MODEL;
  if (envModel) {
    effective.defaultModel = envModel;
    effective.models[effective.provider] = [envModel];
  }
  return effective;
}

export async function getLlmConfig() {
  const stored = await getValue<LlmConfig>("llm", DEFAULT_LLM_CONFIG);
  const provider = ["coze", "deepseek", "classroom-fixture"].includes(String(stored.provider)) ? stored.provider : DEFAULT_LLM_CONFIG.provider;
  const normalized: LlmConfig = {
    ...DEFAULT_LLM_CONFIG,
    ...stored,
    provider,
    models: {
      coze: Array.isArray(stored.models?.coze) ? stored.models.coze : [],
      deepseek: Array.isArray((stored.models as Record<string, string[]> | undefined)?.deepseek) ? (stored.models as Record<string, string[]>).deepseek : DEFAULT_LLM_CONFIG.models.deepseek,
      "classroom-fixture": Array.isArray(stored.models?.["classroom-fixture"]) ? stored.models["classroom-fixture"] : DEFAULT_LLM_CONFIG.models["classroom-fixture"],
    },
  };
  return applyLlmEnvironment(normalized);
}

export class SkillVersionConflictError extends Error {
  constructor(public currentVersion: number, public expectedVersion: number) {
    super(`Skill 已被其他操作更新（当前 v${currentVersion}，提交基于 v${expectedVersion}）。请刷新后重试。`);
    this.name = "SkillVersionConflictError";
  }
}

function prepareSkillSave(
  skills: SkillConfig[],
  skillId: string,
  update: Omit<SkillConfig, "id" | "version" | "updatedAt">,
  changeNote: string,
  expectedVersion?: number,
) {
  const index = skills.findIndex((item) => item.id === skillId);
  if (index < 0) throw new Error(`Skill 不存在：${skillId}`);
  const current = skills[index];
  if (expectedVersion !== undefined && current.version !== expectedVersion) {
    throw new SkillVersionConflictError(current.version, expectedVersion);
  }
  const createdAt = new Date().toISOString();
  const snapshot: SkillVersion = { skillId, version: current.version, snapshot: structuredClone(current), changeNote, createdAt };
  const next: SkillConfig = { ...update, id: skillId, version: current.version + 1, updatedAt: createdAt };
  const nextSkills = skills.map((item, itemIndex) => itemIndex === index ? next : item);
  return { current, snapshot, next, nextSkills, createdAt };
}

function changedRows(result: { meta?: { changes?: number }; changes?: number }) {
  return result.meta?.changes ?? result.changes ?? 0;
}

export async function saveSkill(
  skillId: string,
  update: Omit<SkillConfig, "id" | "version" | "updatedAt">,
  changeNote: string,
  expectedVersion?: number,
) {
  const db = await database();
  if (db) {
    await ensureSchema(db);
    await db.prepare("INSERT OR IGNORE INTO admin_config (config_key, value_json, updated_at) VALUES (?, ?, ?)")
      .bind("skills", JSON.stringify(DEFAULT_SKILLS), new Date().toISOString()).run();
    for (let attempt = 0; attempt < 5; attempt++) {
      const row = await db.prepare("SELECT value_json FROM admin_config WHERE config_key = ?").bind("skills").first<{ value_json: string }>();
      if (!row) throw new Error("无法读取 Skill 配置。");
      const skills = JSON.parse(row.value_json) as SkillConfig[];
      const prepared = prepareSkillSave(skills, skillId, update, changeNote, expectedVersion);
      await db.prepare("INSERT OR IGNORE INTO skill_versions (skill_id, version, snapshot_json, change_note, created_at) VALUES (?, ?, ?, ?, ?)")
        .bind(skillId, prepared.current.version, JSON.stringify(prepared.current), changeNote, prepared.createdAt).run();
      const result = await db.prepare("UPDATE admin_config SET value_json = ?, updated_at = ? WHERE config_key = ? AND value_json = ?")
        .bind(JSON.stringify(prepared.nextSkills), prepared.createdAt, "skills", row.value_json).run();
      if (changedRows(result) > 0) {
        memoryConfig.set("skills", structuredClone(prepared.nextSkills));
        if (!memoryVersions.some((item) => item.skillId === skillId && item.version === prepared.current.version)) memoryVersions.push(prepared.snapshot);
        return prepared.next;
      }
    }
    throw new Error("Skill 配置并发更新次数过多，请刷新后重试。");
  }

  const previous = globalThis.__snackOpsSkillSaveQueue!;
  let release!: () => void;
  globalThis.__snackOpsSkillSaveQueue = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try {
    const skills = structuredClone((memoryConfig.get("skills") ?? DEFAULT_SKILLS) as SkillConfig[]);
    const prepared = prepareSkillSave(skills, skillId, update, changeNote, expectedVersion);
    if (!memoryVersions.some((item) => item.skillId === skillId && item.version === prepared.current.version)) memoryVersions.push(prepared.snapshot);
    memoryConfig.set("skills", structuredClone(prepared.nextSkills));
    return prepared.next;
  } finally {
    release();
  }
}

export async function getSkillVersions(skillId: string) {
  const db = await database();
  let versions: SkillVersion[] = [];
  if (db) {
    await ensureSchema(db);
    const rows = await db.prepare("SELECT version, snapshot_json, change_note, created_at FROM skill_versions WHERE skill_id = ? ORDER BY version DESC")
      .bind(skillId).all<{ version: number; snapshot_json: string; change_note: string; created_at: string }>();
    versions = rows.results.map((row) => ({ skillId, version: row.version, snapshot: JSON.parse(row.snapshot_json) as SkillConfig, changeNote: row.change_note, createdAt: row.created_at }));
  } else {
    versions = memoryVersions.filter((item) => item.skillId === skillId).sort((a, b) => b.version - a.version).map((item) => structuredClone(item));
  }
  const current = (await getSkills()).find((item) => item.id === skillId);
  return current ? [{ skillId, version: current.version, snapshot: current, changeNote: "当前版本", createdAt: current.updatedAt, current: true }, ...versions] : versions;
}

export async function saveTools(tools: ToolConfig[]) { await setValue("tools", tools); return tools; }
export async function savePlannerConfig(config: Omit<PlannerConfig, "version" | "updatedAt">) {
  const current = await getPlannerConfig();
  const next: PlannerConfig = { ...config, version: current.version + 1, updatedAt: new Date().toISOString() };
  await setValue("planner", next);
  return next;
}
export async function saveLlmConfig(config: Omit<LlmConfig, "updatedAt">) {
  const next: LlmConfig = { ...config, updatedAt: new Date().toISOString() };
  await setValue("llm", next);
  return applyLlmEnvironment(next);
}
