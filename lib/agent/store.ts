import type { RunRecord } from "./types";

type D1Statement = {
  bind(...values: unknown[]): D1Statement;
  run(): Promise<unknown>;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
};
type D1Like = { prepare(query: string): D1Statement };

declare global { var __snackOpsRuns: Map<string, RunRecord> | undefined; }
const memory = globalThis.__snackOpsRuns ??= new Map<string, RunRecord>();

async function db(): Promise<D1Like | null> {
  try {
    const runtime = await import("cloudflare:workers");
    return ((runtime.env as unknown as { DB?: D1Like }).DB) ?? null;
  } catch { return null; }
}

function serialize(run: RunRecord) { return JSON.stringify(run); }

async function ensureSchema(database: D1Like) {
  await database.prepare("CREATE TABLE IF NOT EXISTS agent_runs (id TEXT PRIMARY KEY NOT NULL, created_at TEXT NOT NULL, status TEXT NOT NULL, record_json TEXT NOT NULL)").run();
  await database.prepare("CREATE INDEX IF NOT EXISTS agent_runs_created_at_idx ON agent_runs(created_at DESC)").run();
}

export async function saveRun(run: RunRecord) {
  memory.set(run.id, structuredClone(run));
  const database = await db();
  if (!database) return;
  await ensureSchema(database);
  await database.prepare(`INSERT INTO agent_runs (id, created_at, status, record_json) VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET status=excluded.status, record_json=excluded.record_json`).bind(run.id, run.createdAt, run.status, serialize(run)).run();
}

export async function getRun(id: string) {
  const database = await db();
  if (database) {
    await ensureSchema(database);
    const row = await database.prepare("SELECT record_json FROM agent_runs WHERE id = ?").bind(id).first<{ record_json: string }>();
    if (row) return JSON.parse(row.record_json) as RunRecord;
  }
  return memory.get(id) ? structuredClone(memory.get(id)!) : null;
}

export async function listRuns(limit = 20, offset = 0) {
  const database = await db();
  if (database) {
    await ensureSchema(database);
    const rows = await database.prepare("SELECT record_json FROM agent_runs ORDER BY created_at DESC LIMIT ? OFFSET ?").bind(limit, offset).all<{ record_json: string }>();
    return rows.results.map((row) => JSON.parse(row.record_json) as RunRecord);
  }
  return [...memory.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(offset, offset + limit).map((run) => structuredClone(run));
}
