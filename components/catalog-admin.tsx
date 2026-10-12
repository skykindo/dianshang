"use client";

import { FormEvent, useMemo, useState } from "react";
import type { CatalogProduct } from "@/lib/catalog";
import { calculateGrossMargin } from "@/lib/catalog-sanitize";

const blank = (): CatalogProduct => ({ sku: "", name: "", category: "", price: 0, spec: "", tasteTags: [], sceneTags: [], packageTags: [], peopleTags: [], avoidTags: [], sellingPoints: [], stockStatus: "in_stock", costPrice: 0, grossMargin: 0, notes: "" });
const split = (value: string) => value.split(/[,，、]/).map((item) => item.trim()).filter(Boolean);
const join = (items: string[]) => items.join("、");
const stockLabel: Record<CatalogProduct["stockStatus"], string> = { in_stock: "现货", low_stock: "低库存", out_of_stock: "缺货" };
type ListField = "tasteTags" | "sceneTags" | "packageTags" | "peopleTags" | "avoidTags" | "sellingPoints";

export default function CatalogAdmin({ initialProducts }: { initialProducts: CatalogProduct[] }) {
  const [products, setProducts] = useState(initialProducts);
  const [draft, setDraft] = useState<CatalogProduct>(blank());
  const [editingSku, setEditingSku] = useState("");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const visible = useMemo(() => { const q=query.trim().toLowerCase();return q ? products.filter((item) => [item.sku,item.name,item.category,item.spec,...item.tasteTags,...item.sceneTags,...item.sellingPoints].join(" ").toLowerCase().includes(q)) : products; }, [products,query]);

  function startCreate() { setDraft(blank()); setEditingSku(""); setMessage(null); }
  function startEdit(product: CatalogProduct) { setDraft(structuredClone(product)); setEditingSku(product.sku); setMessage(null); window.scrollTo({ top: 120, behavior: "smooth" }); }
  function setList(field: ListField, value: string) { setDraft((current) => ({ ...current, [field]: split(value) })); }
  function setPrice(value: number) { setDraft((current) => ({ ...current, price: value, grossMargin: calculateGrossMargin(value, current.costPrice) })); }
  function setCostPrice(value: number) { setDraft((current) => ({ ...current, costPrice: value, grossMargin: calculateGrossMargin(current.price, value) })); }
  async function refresh() { const response = await fetch("/api/catalog"); const data = await response.json() as { products: CatalogProduct[] }; setProducts(data.products); }

  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setMessage(null);
    try {
      const response = await fetch(editingSku ? `/api/catalog/${encodeURIComponent(editingSku)}` : "/api/catalog", { method: editingSku ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const data = await response.json() as { product?: CatalogProduct; error?: { message?: string } };
      if (!response.ok || !data.product) throw new Error(data.error?.message ?? `保存失败（${response.status}）`);
      const edited = Boolean(editingSku); await refresh(); startCreate(); setMessage({ type: "success", text: edited ? "商品已更新，Agent 检索已同步生效。" : "商品已添加，Agent 检索已同步生效。" });
    } catch (error) { setMessage({ type: "error", text: error instanceof Error ? error.message : String(error) }); }
    finally { setSaving(false); }
  }

  async function remove(product: CatalogProduct) {
    if (!window.confirm(`确认删除“${product.name}”？删除后 Agent 将不再检索到它。`)) return;
    const response = await fetch(`/api/catalog/${encodeURIComponent(product.sku)}`, { method: "DELETE" });
    const data = await response.json() as { error?: { message?: string } };
    if (!response.ok) { setMessage({ type: "error", text: data.error?.message ?? "删除失败。" }); return; }
    if (editingSku === product.sku) startCreate();
    await refresh(); setMessage({ type: "success", text: "商品已删除。" });
  }

  const listField = (label: string, field: ListField, placeholder: string) => <label>{label}<input value={join(draft[field])} onChange={(event) => setList(field,event.target.value)} placeholder={placeholder}/></label>;

  return <>
    {message && <div className={`inline-message ${message.type}`}>{message.text}</div>}
    <section className="catalog-layout">
      <div className="catalog-list">
        <div className="catalog-section-head"><div><p className="eyebrow">PRODUCT TABLE</p><h2>商品数据（{products.length}）</h2></div><div className="catalog-head-actions"><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="搜索 SKU、名称、品类或标签"/><button className="primary-action" onClick={startCreate}>+添加商品</button></div></div>
        <div className="catalog-grid">{visible.map((item) => <article className="admin-panel catalog-card" key={item.sku}><div className="admin-panel-head"><div><small>{item.sku} · {item.category} · {item.spec}</small><h2>{item.name}</h2></div><b>¥{item.price.toFixed(2)}</b></div><div className="catalog-groups"><p><strong>口味</strong>{join(item.tasteTags)}</p><p><strong>场景</strong>{join(item.sceneTags)}</p><p><strong>卖点</strong>{join(item.sellingPoints)}</p><p><strong>人群</strong>{join(item.peopleTags)}</p><p className="catalog-avoid"><strong>慎选</strong>{join(item.avoidTags)}</p></div><div className="catalog-card-foot"><span className={`stock-pill ${item.stockStatus}`}>{stockLabel[item.stockStatus]}</span><small>成本 ¥{item.costPrice.toFixed(2)} · 毛利率 {(item.grossMargin*100).toFixed(1)}%</small></div><div className="catalog-card-actions"><button onClick={() => startEdit(item)}>编辑</button><button className="danger-action" onClick={() => void remove(item)}>删除</button></div></article>)}</div>
        {!visible.length && <div className="admin-panel empty-mini">没有匹配的商品。</div>}
      </div>
      <form className="admin-panel catalog-editor" onSubmit={save}><div className="admin-panel-head"><div><p className="eyebrow">{editingSku ? "EDIT PRODUCT" : "NEW PRODUCT"}</p><h2>{editingSku ? `编辑 ${editingSku}` : "添加商品"}</h2></div>{editingSku && <button type="button" onClick={startCreate}>取消</button>}</div><label>SKU<input value={draft.sku} disabled={!!editingSku} onChange={(event) => setDraft({ ...draft, sku: event.target.value })} placeholder="例如 SKU051" required /></label><label>商品名称<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required /></label><div className="form-grid"><label>品类<input value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} required /></label><label>规格<input value={draft.spec} onChange={(event) => setDraft({ ...draft, spec: event.target.value })} required /></label><label>售价（元）<input type="number" min="0" step="0.01" value={draft.price} onChange={(event) => setPrice(Number(event.target.value))} required /></label><label>成本价（元）<input type="number" min="0" max={draft.price} step="0.01" value={draft.costPrice} onChange={(event) => setCostPrice(Number(event.target.value))} required /></label><label>毛利率（自动计算）<input type="text" value={`${(draft.grossMargin*100).toFixed(1)}%`} readOnly /></label><label>库存状态<select value={draft.stockStatus} onChange={(event) => setDraft({ ...draft, stockStatus: event.target.value as CatalogProduct["stockStatus"] })}><option value="in_stock">现货</option><option value="low_stock">低库存</option><option value="out_of_stock">缺货</option></select></label></div>{listField("口味标签","tasteTags","咸香、清淡、不辣")}{listField("场景标签","sceneTags","办公室、下午茶")}{listField("包装标签","packageTags","独立小包、便携")}{listField("人群标签","peopleTags","大众、儿童可适量")}{listField("慎选/避免标签","avoidTags","坚果过敏慎选")}{listField("卖点","sellingPoints","用顿号分隔")}<label>备注<textarea rows={3} value={draft.notes} onChange={(event)=>setDraft({...draft,notes:event.target.value})} placeholder="内部备注，不会发送给模型"/></label><button className="primary-action" disabled={saving}>{saving ? "保存中…" : editingSku ? "保存修改" : "添加商品"}</button><p className="muted">数据持久化到 business_products 表。毛利率由售价和成本价自动计算；成本价、毛利率和备注不会发送给聊天模型。</p></form>
    </section>
  </>;
}
