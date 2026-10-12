import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import type { CatalogProduct } from "../lib/catalog.ts";
import { sanitizeCatalogProduct } from "../lib/catalog-sanitize.ts";

function fail(message: string): never { console.error(`[catalog:import] ${message}`); process.exit(1); }
function quote(value: unknown) { const text=typeof value==="string"?value:JSON.stringify(value);return `'${text.replaceAll("'","''")}'`; }
function databasePath() { const flag=process.argv.indexOf("--db");if(flag>=0){const candidate=process.argv[flag+1];if(!candidate)fail("--db 需要一个 SQLite 文件路径。");return resolve(candidate);}const directory=resolve(".wrangler/state/v3/d1/miniflare-D1DatabaseObject");if(!existsSync(directory))fail("未找到本地 D1，请先启动服务。");const candidates=readdirSync(directory).filter((name)=>name.endsWith(".sqlite")&&name!=="metadata.sqlite");if(candidates.length!==1)fail(`需要唯一的本地 D1 文件，当前找到 ${candidates.length} 个。`);return resolve(directory,candidates[0]); }

const products=(JSON.parse(readFileSync(resolve("lib/catalog-seed.json"),"utf8")) as CatalogProduct[]).map(sanitizeCatalogProduct);
if(products.length!==50||new Set(products.map((item)=>item.sku)).size!==products.length)fail("种子数据必须包含 50 个唯一 SKU。");
const rows=products.map((item)=>`(${quote(item.sku)},${quote(new Date().toISOString())},${quote(item)})`).join(",\n");
const sql=`BEGIN IMMEDIATE;
CREATE TABLE IF NOT EXISTS business_products (sku TEXT PRIMARY KEY NOT NULL, created_at TEXT NOT NULL, record_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS business_meta (meta_key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
DELETE FROM business_products;
INSERT INTO business_products (sku,created_at,record_json) VALUES ${rows};
INSERT INTO business_meta (meta_key,value) VALUES ('products_initialized','xlsx-50-v1') ON CONFLICT(meta_key) DO UPDATE SET value=excluded.value;
COMMIT;`;
const result=spawnSync("sqlite3",[databasePath()],{input:sql,encoding:"utf8"});
if(result.error)fail(`无法启动 sqlite3：${result.error.message}`);
if(result.status!==0)fail(`导入失败，事务已回滚：${result.stderr.trim()||`sqlite3 exit ${result.status}`}`);
console.log(`[catalog:import] 已原子导入 ${products.length} 个商品。`);
