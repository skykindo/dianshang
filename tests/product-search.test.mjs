import assert from "node:assert/strict";
import test from "node:test";
import { searchProducts } from "../lib/agent/product-search.ts";

const catalog = [
  { sku: "1", name: "海盐苏打饼干", category: "饼干", price: 12.9, spec:"100g", tasteTags: ["咸香", "低糖"], sceneTags:["下午茶", "办公室"], packageTags:[], peopleTags:[], avoidTags:[], sellingPoints:[], stockStatus: "in_stock" },
  { sku: "2", name: "冻干草莓", category: "果干", price: 19.9, spec:"50g", tasteTags: ["酸甜", "果香"], sceneTags:["下午茶"], packageTags:[], peopleTags:[], avoidTags:[], sellingPoints:[], stockStatus: "in_stock" },
  { sku: "3", name: "每日坚果", category: "坚果", price: 25.8, spec:"25g", tasteTags: ["混合坚果"], sceneTags:["办公室"], packageTags:["便携"], peopleTags:[], avoidTags:["坚果过敏慎选"], sellingPoints:[], stockStatus: "low_stock" },
];

test("商品检索会按品类和标签过滤，不向坚果问题返回全库", () => {
  assert.deepEqual(searchProducts("给我推荐点坚果", catalog).map((item) => item.sku), ["3"]);
  assert.deepEqual(searchProducts("推荐办公室吃的坚果", catalog).map((item) => item.sku), ["3"]);
  assert.deepEqual(searchProducts("推荐一款低糖的下午茶零食", catalog).map((item) => item.sku), ["1"]);
});

test("带明确上限的预算会过滤超价商品", () => {
  assert.deepEqual(searchProducts("20 元内有哪些零食", catalog).map((item) => item.sku), ["1", "2"]);
});

test("过敏原是排除条件而不是正向命中条件", () => {
  assert.deepEqual(searchProducts("我坚果过敏，推荐办公室零食", catalog).map((item) => item.sku), ["1"]);
});

test("普通否定和忌辣都会作为硬性排除条件", () => {
  const spicyNut = { sku: "4", name: "椒盐腰果", category: "坚果", price: 22.8, spec:"80g", tasteTags: ["微辣", "坚果香"], sceneTags:["办公室"], packageTags:[], peopleTags:[], avoidTags:["坚果过敏慎选", "不吃辣人群慎选"], sellingPoints:[], stockStatus: "in_stock" };
  const extendedCatalog = [...catalog, spicyNut];
  assert.deepEqual(searchProducts("不要坚果，推荐两款办公室零食", extendedCatalog).map((item) => item.sku), ["1"]);
  assert.deepEqual(searchProducts("推荐两款坚果，我不吃辣", extendedCatalog).map((item) => item.sku), ["3"]);
});

test("尊重明确数量，模糊需求先澄清而不是返回最便宜商品", () => {
  assert.deepEqual(searchProducts("推荐两款下午茶零食", catalog).map((item) => item.sku), ["1", "2"]);
  assert.deepEqual(searchProducts("给我推荐点好吃的", catalog), []);
});
