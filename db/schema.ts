import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const agentRuns = sqliteTable("agent_runs", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),
  status: text("status").notNull(),
  recordJson: text("record_json").notNull(),
});

export const opsRatings = sqliteTable("ops_ratings", {
  id: text("id").primaryKey(), runId: text("run_id").notNull(), score: integer("score").notNull(),
  createdAt: text("created_at").notNull(), recordJson: text("record_json").notNull(),
}, (table) => [index("ops_ratings_run_idx").on(table.runId, table.createdAt)]);

export const opsAnnotations = sqliteTable("ops_annotations", {
  id: text("id").primaryKey(), runId: text("run_id").notNull(), status: text("status").notNull(),
  createdAt: text("created_at").notNull(), recordJson: text("record_json").notNull(),
}, (table) => [index("ops_annotations_run_idx").on(table.runId, table.createdAt)]);

export const opsImprovements = sqliteTable("ops_improvements", {
  id: text("id").primaryKey(), runId: text("run_id").notNull(), status: text("status").notNull(),
  createdAt: text("created_at").notNull(), recordJson: text("record_json").notNull(),
});

export const opsAbTests = sqliteTable("ops_ab_tests", {
  id: text("id").primaryKey(), status: text("status").notNull(), createdAt: text("created_at").notNull(),
  recordJson: text("record_json").notNull(),
});

export const evalCases = sqliteTable("eval_cases", {
  id: text("id").primaryKey(), enabled: integer("enabled").notNull(), category: text("category").notNull(),
  difficulty: text("difficulty").notNull(), riskLevel: text("risk_level").notNull(), createdAt: text("created_at").notNull(),
  recordJson: text("record_json").notNull(),
}, (table) => [index("eval_cases_filter_idx").on(table.enabled, table.category, table.difficulty, table.riskLevel)]);

export const evalBatches = sqliteTable("eval_batches", {
  id: text("id").primaryKey(), createdAt: text("created_at").notNull(), recordJson: text("record_json").notNull(),
});

export const evalMeta = sqliteTable("eval_meta", {
  metaKey: text("meta_key").primaryKey(), value: text("value").notNull(),
});
