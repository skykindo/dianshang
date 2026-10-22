import type { Pool, QueryResultRow } from "pg";

export type SqlRunResult = {
  changes: number;
  meta: { changes: number };
};

export type SqlStatement = {
  bind(...values: unknown[]): SqlStatement;
  run(): Promise<SqlRunResult>;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
};

export type SqlDatabase = {
  prepare(sql: string): SqlStatement;
};

declare global {
  var __snackOpsPostgresPool: Pool | undefined;
}

function postgresSql(sql: string) {
  let parameter = 0;
  return sql
    .replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/gi, "INSERT INTO")
    .replace(/\?/g, () => `$${++parameter}`);
}

function appendDoNothing(sql: string) {
  if (!/\bINSERT\s+INTO\b/i.test(sql) || !/\bOR\s+IGNORE\b/i.test(sql)) return sql;
  const normalized = sql.replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/i, "INSERT INTO");
  return /\bON\s+CONFLICT\b/i.test(normalized) ? normalized : `${normalized.replace(/;\s*$/, "")} ON CONFLICT DO NOTHING`;
}

async function pool(): Promise<Pool | null> {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) return null;
  if (globalThis.__snackOpsPostgresPool) return globalThis.__snackOpsPostgresPool;

  const { Pool: PostgresPool } = await import("pg");
  globalThis.__snackOpsPostgresPool = new PostgresPool({
    connectionString,
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  return globalThis.__snackOpsPostgresPool;
}

class PostgresStatement implements SqlStatement {
  private values: unknown[] = [];

  constructor(private readonly client: Pool, private readonly sourceSql: string) {}

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  private querySql() {
    return postgresSql(appendDoNothing(this.sourceSql));
  }

  async run(): Promise<SqlRunResult> {
    const result = await this.client.query(this.querySql(), this.values);
    const changes = result.rowCount ?? 0;
    return { changes, meta: { changes } };
  }

  async first<T>(): Promise<T | null> {
    const result = await this.client.query<QueryResultRow>(this.querySql(), this.values);
    return (result.rows[0] as T | undefined) ?? null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    const result = await this.client.query<QueryResultRow>(this.querySql(), this.values);
    return { results: result.rows as T[] };
  }
}

export async function database(): Promise<SqlDatabase | null> {
  const client = await pool();
  if (!client) return null;
  return { prepare: (sql) => new PostgresStatement(client, sql) };
}

export async function getPostgresPool(): Promise<Pool> {
  const client = await pool();
  if (!client) throw new Error("DATABASE_URL 未配置，无法连接 PostgreSQL。");
  return client;
}
