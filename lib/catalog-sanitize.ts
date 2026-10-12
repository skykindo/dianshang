import type { CatalogProduct } from "./catalog";

const LIST_FIELDS = ["tasteTags", "sceneTags", "packageTags", "peopleTags", "avoidTags", "sellingPoints"] as const;

export function calculateGrossMargin(price: number, costPrice: number) {
  if (!Number.isFinite(price) || !Number.isFinite(costPrice) || price <= 0) return 0;
  return Math.round(((price - costPrice) / price) * 10_000) / 10_000;
}

export function sanitizeCatalogProduct(product: CatalogProduct): CatalogProduct {
  const cleaned = { ...product, grossMargin: calculateGrossMargin(product.price, product.costPrice) };
  for (const field of LIST_FIELDS) {
    cleaned[field] = [...new Set(product[field]
      .filter((value) => !/[.…]+$/.test(value.trim()))
      .map((value) => value.trim())
      .filter((value) => value.length >= 2))];
  }
  return cleaned;
}
