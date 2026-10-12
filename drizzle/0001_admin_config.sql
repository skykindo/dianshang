CREATE TABLE IF NOT EXISTS admin_config (
  config_key TEXT PRIMARY KEY NOT NULL,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS skill_versions (
  skill_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  change_note TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (skill_id, version)
);

CREATE INDEX IF NOT EXISTS skill_versions_skill_id_idx
  ON skill_versions(skill_id, version DESC);
