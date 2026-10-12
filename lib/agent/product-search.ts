export interface SearchableProduct {
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
}

function budgetFrom(question: string) {
  const match = question.match(/(?:预算\s*)?(\d+(?:\.\d+)?)\s*(?:元|块)(?:以内|以下|内|封顶|左右)?/);
  if (!match || !/(预算|以内|以下|不超过|最多|封顶|元内|块内)/.test(question)) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

// 商品字段通常是“坚果炒货”“坚果香”这类复合词，用户则更常只说“坚果”。
// 保留显式词表能避免用任意双字切片造成“推荐/商品”等泛词误命中整库。
const SEMANTIC_KEYWORDS = [
  "坚果", "海苔", "果干", "饼干", "糕点", "巧克力", "糖果", "辣条", "肉脯", "卤味", "膨化", "果蔬", "礼盒",
  "麻辣", "香辣", "微辣", "不辣", "低盐", "低糖", "低甜", "不甜", "无糖", "酸甜", "咸香", "清淡",
  "办公室", "下午茶", "追剧", "送礼", "儿童", "老人", "长辈", "健身", "旅行", "聚会", "夜宵", "早餐", "下酒",
  "便携", "独立小包",
] as const;

const ALLERGEN_KEYWORDS = ["坚果", "海产品", "芝麻", "芒果", "乳制品", "麸质", "马铃薯", "牛肉", "猪肉", "蛋类", "香蕉", "秋葵", "草莓", "黄桃", "可可"] as const;

function avoidedKeywords(question: string) {
  const candidates = [...new Set([...SEMANTIC_KEYWORDS, ...ALLERGEN_KEYWORDS])];
  return candidates.filter((keyword) =>
    question.includes(`${keyword}过敏`) ||
    question.includes(`对${keyword}过敏`) ||
    new RegExp(`(?:不能吃|不吃|忌口|避开|不要含|不含|不要|别要|不想吃|不想要|排除)[^，。！？]{0,6}${keyword}`).test(question),
  );
}

function avoidsSpicyFood(question: string) {
  return /(?:不吃|不能吃|不要|别要|避开|忌口|不想吃)[^，。！？]{0,4}辣|不辣的/.test(question);
}

function isSpicyField(value: string) {
  return value !== "不辣" && /辣/.test(value);
}

function requestedLimit(question: string, fallback: number) {
  const match = question.match(/([1-9]|一|二|两|三|四|五)\s*(?:款|种|个)/);
  if (!match) return fallback;
  const values: Record<string, number> = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5 };
  return Math.min(fallback, Number(match[1]) || values[match[1]] || fallback);
}

function keywordAlternatives(keyword: string) {
  if (keyword === "低糖" || keyword === "不甜") return ["低糖", "低甜", "无糖", "控糖", "蔗糖"];
  if (keyword === "老人") return ["老人", "长辈"];
  return [keyword];
}

export function searchProducts<T extends SearchableProduct>(question: string, catalog: readonly T[], limit = 3): T[] {
  const normalized = question.toLowerCase().replace(/\s+/g, "");
  const avoided = avoidedKeywords(normalized);
  const queryKeywords = SEMANTIC_KEYWORDS.filter((keyword) => normalized.includes(keyword) && !avoided.includes(keyword));
  const excludeSpicy = avoidsSpicyFood(normalized);
  const scored = catalog.map((product) => {
    const fields = [product.sku, product.name, product.category, product.spec, ...product.tasteTags, ...product.sceneTags, ...product.packageTags, ...product.peopleTags, ...product.sellingPoints]
      .map((value) => value.toLowerCase().replace(/\s+/g, ""))
      .filter((value) => value.length >= 2);
    const excludedByKeyword = avoided.some((keyword) =>
      fields.some((field) => field.includes(keyword)) || product.avoidTags.some((tag) => tag.includes(keyword)),
    );
    const excludedBySpice = excludeSpicy && (
      product.tasteTags.some((tag) => isSpicyField(tag.toLowerCase().replace(/\s+/g, ""))) ||
      product.avoidTags.some((tag) => tag.includes("不吃辣"))
    );
    const excluded = excludedByKeyword || excludedBySpice;
    const exactScore = fields.reduce((total, field) => total + (normalized.includes(field) ? (field === product.category ? 4 : 2) : 0), 0);
    const keywordMatches = queryKeywords.filter((keyword) => keywordAlternatives(keyword).some((candidate) => fields.some((field) => field.includes(candidate)))).length;
    const keywordScore = keywordMatches * 3;
    const score = exactScore + keywordScore;
    return { product, score, excluded, keywordMatches };
  });
  const hasSemanticMatch = scored.some((item) => item.score > 0);
  const bestKeywordMatch = Math.max(0, ...scored.map((item) => item.keywordMatches));
  const budget = budgetFrom(question);
  return scored
    .filter((item) => !item.excluded && (hasSemanticMatch ? item.score > 0 && (!queryKeywords.length || item.keywordMatches === bestKeywordMatch) : budget !== null) && (budget === null || item.product.price <= budget))
    .sort((a, b) => b.score - a.score || Number(a.product.stockStatus === "out_of_stock") - Number(b.product.stockStatus === "out_of_stock") || a.product.price - b.product.price)
    .slice(0, requestedLimit(normalized, limit))
    .map((item) => item.product);
}
