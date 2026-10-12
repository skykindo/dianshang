CREATE TABLE IF NOT EXISTS eval_cases (id TEXT PRIMARY KEY NOT NULL, enabled INTEGER NOT NULL, category TEXT NOT NULL, difficulty TEXT NOT NULL, risk_level TEXT NOT NULL, created_at TEXT NOT NULL, record_json TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS eval_cases_filter_idx ON eval_cases(enabled, category, difficulty, risk_level);
CREATE TABLE IF NOT EXISTS eval_batches (id TEXT PRIMARY KEY NOT NULL, created_at TEXT NOT NULL, record_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS eval_meta (meta_key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
