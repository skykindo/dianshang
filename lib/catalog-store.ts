import { CLASSROOM_CATALOG, type CatalogProduct } from "./catalog";
import { calculateGrossMargin } from "./catalog-sanitize";
import { database, type SqlDatabase } from "./database";

declare global { var __snackOpsProducts: Map<string, CatalogProduct> | undefined; }
const memory = globalThis.__snackOpsProducts ??= new Map(CLASSROOM_CATALOG.map((item) => [item.sku, structuredClone(item)]));

async function ensureSchema(db: SqlDatabase) {
  await db.prepare("CREATE TABLE IF NOT EXISTS business_products (sku TEXT PRIMARY KEY NOT NULL, created_at TEXT NOT NULL, record_json TEXT NOT NULL)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS business_meta (meta_key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)").run();
  const initialized = await db.prepare("SELECT value FROM business_meta WHERE meta_key = 'products_initialized'").first<{ value: string }>();
  if (!initialized) {
    for (const item of CLASSROOM_CATALOG) await writeProduct(db, item);
    await db.prepare("INSERT INTO business_meta (meta_key, value) VALUES ('products_initialized', '1') ON CONFLICT DO NOTHING").run();
  }
}

async function writeProduct(db: SqlDatabase, item: CatalogProduct) {
  await db.prepare("INSERT INTO business_products (sku, created_at, record_json) VALUES (?, ?, ?) ON CONFLICT(sku) DO UPDATE SET record_json=excluded.record_json")
    .bind(item.sku, new Date().toISOString(), JSON.stringify(item)).run();
}

export async function listProducts() {
  const db = await database();
  if (!db) return [...memory.values()].map((item) => structuredClone(item)).sort((a, b) => a.sku.localeCompare(b.sku));
  await ensureSchema(db);
  const rows = await db.prepare("SELECT record_json FROM business_products ORDER BY sku").all<{ record_json: string }>();
  return rows.results.map((row) => JSON.parse(row.record_json) as CatalogProduct);
}

export async function getProduct(sku: string) {
  return (await listProducts()).find((item) => item.sku === sku) ?? null;
}

export async function saveProduct(item: CatalogProduct) {
  memory.set(item.sku, structuredClone(item));
  const db = await database();
  if (db) { await ensureSchema(db); await writeProduct(db, item); }
  return structuredClone(item);
}

export async function deleteProduct(sku: string) {
  const db = await database();
  if (db) {
    await ensureSchema(db);
    const found = await db.prepare("SELECT sku FROM business_products WHERE sku = ?").bind(sku).first<{ sku: string }>();
    if (!found) return false;
    await db.prepare("DELETE FROM business_products WHERE sku = ?").bind(sku).run();
  } else if (!memory.has(sku)) return false;
  memory.delete(sku);
  return true;
}

export function validateProduct(value: unknown): { ok: true; product: CatalogProduct } | { ok: false; message: string } {
  if (!value || typeof value !== "object") return { ok: false, message: "商品数据必须是对象。" };
  const source = value as Record<string, unknown>;
  const sku = typeof source.sku === "string" ? source.sku.trim() : "";
  const name = typeof source.name === "string" ? source.name.trim() : "";
  const category = typeof source.category === "string" ? source.category.trim() : "";
  const price = typeof source.price === "number" ? source.price : Number(source.price);
  const spec = typeof source.spec === "string" ? source.spec.trim() : "";
  const stringList = (key: string) => Array.isArray(source[key]) ? (source[key] as unknown[]).map((item) => String(item).trim()).filter(Boolean) : [];
  const tasteTags = stringList("tasteTags"); const sceneTags = stringList("sceneTags"); const packageTags = stringList("packageTags");
  const peopleTags = stringList("peopleTags"); const avoidTags = stringList("avoidTags"); const sellingPoints = stringList("sellingPoints");
  const stockStatus = source.stockStatus;
  const costPrice = typeof source.costPrice === "number" ? source.costPrice : Number(source.costPrice);
  const notes = typeof source.notes === "string" ? source.notes.trim() : "";
  if (!sku || sku.length > 64 || !/^[A-Za-z0-9_-]+$/.test(sku)) return { ok: false, message: "SKU 必须是 1–64 位字母、数字、下划线或连字符。" };
  if (!name || name.length > 100) return { ok: false, message: "商品名称必须是 1–100 个字符。" };
  if (!category || category.length > 50) return { ok: false, message: "品类必须是 1–50 个字符。" };
  if (!Number.isFinite(price) || price < 0 || price > 1_000_000) return { ok: false, message: "价格必须是 0–1000000 之间的数字。" };
  if (!spec || spec.length > 100) return { ok: false, message: "规格必须是 1–100 个字符。" };
  const lists = [tasteTags, sceneTags, packageTags, peopleTags, avoidTags, sellingPoints];
  if (lists.some((items) => items.length > 20 || items.some((item) => item.length > 60))) return { ok: false, message: "每组标签最多 20 个，每个最多 60 个字符。" };
  if (!['in_stock','low_stock','out_of_stock'].includes(String(stockStatus))) return { ok: false, message: "库存状态不合法。" };
  if (!Number.isFinite(costPrice) || costPrice < 0 || costPrice > 1_000_000) return { ok: false, message: "成本价不合法。" };
  if (costPrice > price) return { ok: false, message: "成本价不能高于售价。" };
  if (notes.length > 500) return { ok: false, message: "备注最多 500 个字符。" };
  const unique = (items: string[]) => [...new Set(items)];
  const roundedPrice = Math.round(price * 100) / 100;
  const roundedCostPrice = Math.round(costPrice * 100) / 100;
  return { ok: true, product: { sku, name, category, price: roundedPrice, spec, tasteTags: unique(tasteTags), sceneTags: unique(sceneTags), packageTags: unique(packageTags), peopleTags: unique(peopleTags), avoidTags: unique(avoidTags), sellingPoints: unique(sellingPoints), stockStatus: stockStatus as CatalogProduct["stockStatus"], costPrice: roundedCostPrice, grossMargin: calculateGrossMargin(roundedPrice, roundedCostPrice), notes } };
}
