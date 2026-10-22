import { index, integer, pgTable, primaryKey, text } from "drizzle-orm/pg-core";

export const agentRuns = pgTable("agent_runs", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),
  status: text("status").notNull(),
  recordJson: text("record_json").notNull(),
}, (table) => [index("agent_runs_created_at_idx").on(table.createdAt)]);

export const adminConfig = pgTable("admin_config", {
  configKey: text("config_key").primaryKey(),
  valueJson: text("value_json").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const skillVersions = pgTable("skill_versions", {
  skillId: text("skill_id").notNull(),
  version: integer("version").notNull(),
  snapshotJson: text("snapshot_json").notNull(),
  changeNote: text("change_note").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.skillId, table.version] }),
  index("skill_versions_skill_id_idx").on(table.skillId, table.version),
]);

export const businessProducts = pgTable("business_products", {
  sku: text("sku").primaryKey(),
  createdAt: text("created_at").notNull(),
  recordJson: text("record_json").notNull(),
});

export const businessMeta = pgTable("business_meta", {
  metaKey: text("meta_key").primaryKey(),
  value: text("value").notNull(),
});

export const opsRatings = pgTable("ops_ratings", {
  id: text("id").primaryKey(), runId: text("run_id").notNull(), score: integer("score").notNull(),
  createdAt: text("created_at").notNull(), recordJson: text("record_json").notNull(),
}, (table) => [index("ops_ratings_run_idx").on(table.runId, table.createdAt)]);

export const opsAnnotations = pgTable("ops_annotations", {
  id: text("id").primaryKey(), runId: text("run_id").notNull(), status: text("status").notNull(),
  createdAt: text("created_at").notNull(), recordJson: text("record_json").notNull(),
}, (table) => [index("ops_annotations_run_idx").on(table.runId, table.createdAt)]);

export const opsImprovements = pgTable("ops_improvements", {
  id: text("id").primaryKey(), runId: text("run_id").notNull(), status: text("status").notNull(),
  createdAt: text("created_at").notNull(), recordJson: text("record_json").notNull(),
});

export const opsAbTests = pgTable("ops_ab_tests", {
  id: text("id").primaryKey(), status: text("status").notNull(), createdAt: text("created_at").notNull(),
  recordJson: text("record_json").notNull(),
});

export const evalCases = pgTable("eval_cases", {
  id: text("id").primaryKey(), enabled: integer("enabled").notNull(), category: text("category").notNull(),
  difficulty: text("difficulty").notNull(), riskLevel: text("risk_level").notNull(), createdAt: text("created_at").notNull(),
  recordJson: text("record_json").notNull(),
}, (table) => [index("eval_cases_filter_idx").on(table.enabled, table.category, table.difficulty, table.riskLevel)]);

export const evalBatches = pgTable("eval_batches", {
  id: text("id").primaryKey(), createdAt: text("created_at").notNull(), recordJson: text("record_json").notNull(),
});

export const evalMeta = pgTable("eval_meta", {
  metaKey: text("meta_key").primaryKey(), value: text("value").notNull(),
});
