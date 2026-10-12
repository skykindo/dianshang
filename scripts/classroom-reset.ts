import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { DEFAULT_EVAL_CASES } from "../lib/eval/defaults.ts";
import { DEFAULT_LLM_CONFIG, DEFAULT_PLANNER, DEFAULT_SKILLS, DEFAULT_TOOLS } from "../lib/admin/defaults.ts";

function fail(message:string):never { console.error(`[classroom:reset] ${message}`);process.exit(1); }
function quote(value:unknown){const text=typeof value==="string"?value:JSON.stringify(value);return `'${text.replaceAll("'","''")}'`;}
function databasePath(){const flag=process.argv.indexOf("--db");if(flag>=0){const candidate=process.argv[flag+1];if(!candidate)fail("--db 需要一个 SQLite 文件路径。");return resolve(candidate);}const directory=resolve(".wrangler/state/v3/d1/miniflare-D1DatabaseObject");if(!existsSync(directory))fail("未找到本地 D1。请先运行 pnpm dev 一次，或使用 --db <path>。");const candidates=readdirSync(directory).filter(name=>name.endsWith(".sqlite")&&name!=="metadata.sqlite");if(candidates.length!==1)fail(`需要唯一的本地 D1 文件，当前找到 ${candidates.length} 个。请使用 --db <path> 明确指定。`);return resolve(directory,candidates[0]);}

if(process.env.NODE_ENV==="production"||process.env.CF_PAGES==="1")fail("拒绝在生产环境执行课堂重置。");
const dbPath=databasePath();
const now="2026-10-01T00:00:00.000Z";
const evalRows=DEFAULT_EVAL_CASES.map(item=>`(${quote(item.id)},${item.enabled?1:0},${quote(item.category)},${quote(item.difficulty)},${quote(item.riskLevel)},${quote(item.createdAt)},${quote(item)})`).join(",\n");
const configs=[["skills",DEFAULT_SKILLS],["tools",DEFAULT_TOOLS],["planner",DEFAULT_PLANNER],["llm",DEFAULT_LLM_CONFIG]] as const;
const configRows=configs.map(([key,value])=>`(${quote(key)},${quote(value)},${quote(now)})`).join(",\n");
const sql=`PRAGMA foreign_keys=ON;
BEGIN IMMEDIATE;
CREATE TABLE IF NOT EXISTS admin_config (config_key TEXT PRIMARY KEY NOT NULL, value_json TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS skill_versions (skill_id TEXT NOT NULL, version INTEGER NOT NULL, snapshot_json TEXT NOT NULL, change_note TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(skill_id, version));
CREATE TABLE IF NOT EXISTS eval_cases (id TEXT PRIMARY KEY NOT NULL, enabled INTEGER NOT NULL, category TEXT NOT NULL, difficulty TEXT NOT NULL, risk_level TEXT NOT NULL, created_at TEXT NOT NULL, record_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS eval_batches (id TEXT PRIMARY KEY NOT NULL, created_at TEXT NOT NULL, record_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS eval_meta (meta_key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ops_ratings (id TEXT PRIMARY KEY NOT NULL, run_id TEXT NOT NULL, score INTEGER NOT NULL, created_at TEXT NOT NULL, record_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ops_annotations (id TEXT PRIMARY KEY NOT NULL, run_id TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, record_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ops_improvements (id TEXT PRIMARY KEY NOT NULL, run_id TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, record_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ops_ab_tests (id TEXT PRIMARY KEY NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, record_json TEXT NOT NULL);
DELETE FROM eval_cases;
INSERT INTO eval_cases (id,enabled,category,difficulty,risk_level,created_at,record_json) VALUES ${evalRows};
DELETE FROM eval_batches;
DELETE FROM skill_versions;
DELETE FROM admin_config WHERE config_key IN ('skills','tools','planner','llm');
INSERT INTO admin_config (config_key,value_json,updated_at) VALUES ${configRows};
DELETE FROM ops_ratings;
DELETE FROM ops_annotations;
DELETE FROM ops_improvements;
DELETE FROM ops_ab_tests;
INSERT INTO eval_meta (meta_key,value) VALUES ('defaults_initialized','1') ON CONFLICT(meta_key) DO UPDATE SET value=excluded.value;
INSERT INTO eval_meta (meta_key,value) VALUES ('screenshot_batch_v1_initialized','1') ON CONFLICT(meta_key) DO UPDATE SET value=excluded.value;
COMMIT;`;
const result=spawnSync("sqlite3",[dbPath],{input:sql,encoding:"utf8"});
if(result.error)fail(`无法启动 sqlite3：${result.error.message}`);
if(result.status!==0)fail(`重置失败，事务已回滚：${result.stderr.trim()||`sqlite3 exit ${result.status}`}`);
console.log(`[classroom:reset] 已原子重置 ${dbPath}`);
console.log(`[classroom:reset] 评测用例 ${DEFAULT_EVAL_CASES.length} 条；Skill ${DEFAULT_SKILLS.length} 个；已清空批次、Skill 版本、评分、标注、改进和 A/B 数据。`);
console.log("[classroom:reset] 商品、订单和 agent_runs 未被删除。");
