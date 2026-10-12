import catalogSeed from "./catalog-seed.json";
import { sanitizeCatalogProduct } from "./catalog-sanitize";

export interface CatalogProduct {
  sku: string;
  name: string;
  category: string;
  price: number;
  spec: string;
  tasteTags: string[];
  sceneTags: string[];
  packageTags: string[];
  peopleTags: string[];
  avoidTags: string[];
  sellingPoints: string[];
  stockStatus: "in_stock" | "low_stock" | "out_of_stock";
  costPrice: number;
  grossMargin: number;
  notes: string;
}

export const CLASSROOM_CATALOG = (catalogSeed as CatalogProduct[]).map(sanitizeCatalogProduct);

export const CLASSROOM_ORDER = { orderId: "SO-DEMO-2026", status: "已发货", trackingNo: "SF****2026", latest: "已到达目的地分拨中心" } as const;
