import AdminNav from "@/components/admin-nav";
import CatalogAdmin from "@/components/catalog-admin";
import { CLASSROOM_ORDER } from "@/lib/catalog";
import { listProducts } from "@/lib/catalog-store";

export default async function CatalogPage(){const products=await listProducts();return <main className="admin-shell"><AdminNav active="catalog"/><section className="admin-hero compact-admin-hero"><div><p className="eyebrow">BUSINESS DATA</p><h1>商品数据中心</h1><p>在这里新增、编辑和删除 Agent 实际检索的商品。课堂重置不会删除商品与订单基础数据。</p></div></section><CatalogAdmin initialProducts={products}/><section className="admin-panel catalog-order"><div><p className="eyebrow">MASKED ORDER FIXTURE</p><h2>{CLASSROOM_ORDER.orderId}</h2><p>{CLASSROOM_ORDER.status} · {CLASSROOM_ORDER.trackingNo} · {CLASSROOM_ORDER.latest}</p></div><span>隐私脱敏开启</span></section></main>}
