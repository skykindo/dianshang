import type { Capability } from "./types";

export const SKILLS: Capability[] = [
  { id: "product-recommendation", name: "商品推荐", version: "1.0.0", enabled: true },
  { id: "order-support", name: "订单服务", version: "1.0.0", enabled: true },
  { id: "safety-response", name: "安全回复", version: "1.0.0", enabled: true },
];

export const TOOLS: Capability[] = [
  { id: "catalog-search", name: "商品检索", version: "1.0.0", enabled: true },
  { id: "price-query", name: "价格查询", version: "1.0.0", enabled: true },
  { id: "order-query", name: "订单查询", version: "1.0.0", enabled: true },
  { id: "logistics-query", name: "物流查询", version: "1.0.0", enabled: true },
  { id: "risk-check", name: "风险检查", version: "1.1.0", enabled: true },
];

export function enabledCapabilities(all: Capability[], requested?: string[]) {
  if (!requested) return all.filter((item) => item.enabled);
  const allowed = new Set(requested);
  return all.filter((item) => item.enabled && allowed.has(item.id));
}

export function inferMandatoryCapabilities(input: string): string[] {
  const result = new Set<string>();
  if (/价格|多少钱|便宜|优惠|比价|预算|售价|块钱|元内/.test(input)) result.add("price-query");
  if (/订单|下单|退货|换货|退款/.test(input)) result.add("order-query");
  if (/物流|快递|发货|到货|运单/.test(input)) result.add("logistics-query");
  if (/中奖|一等奖|兑奖|转账|转钱|安全账户|验证码|银行卡|刷单|保证金|扫码|诈骗|降血糖|治疗|治愈|疗效|减肥|瘦身/.test(input)) {
    result.add("risk-check");
    result.add("safety-response");
  }
  return [...result];
}
