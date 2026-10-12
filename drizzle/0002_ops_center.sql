CREATE TABLE IF NOT EXISTS ops_ratings (id TEXT PRIMARY KEY NOT NULL, run_id TEXT NOT NULL, score INTEGER NOT NULL, created_at TEXT NOT NULL, record_json TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS ops_ratings_run_idx ON ops_ratings(run_id, created_at DESC);
CREATE TABLE IF NOT EXISTS ops_annotations (id TEXT PRIMARY KEY NOT NULL, run_id TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, record_json TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS ops_annotations_run_idx ON ops_annotations(run_id, created_at DESC);
CREATE TABLE IF NOT EXISTS ops_improvements (id TEXT PRIMARY KEY NOT NULL, run_id TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, record_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ops_ab_tests (id TEXT PRIMARY KEY NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, record_json TEXT NOT NULL);
