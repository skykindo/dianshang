import { AgentError } from "./errors";
import type { AgentPlan, ExecutionScore, RiskResult } from "./types";
import type { SkillConfig } from "@/lib/admin/types";
import { CLASSROOM_ORDER } from "@/lib/catalog";
import { listProducts } from "@/lib/catalog-store";
import { containsUnsafeAdvice } from "./risk";
import { searchProducts } from "./product-search";

export async function runSkill(id: string, input: { question: string; plan: AgentPlan; config?: SkillConfig }, timeoutMs = 2000) {
  const work = Promise.resolve().then(() => {
    const appliedConfig = input.config ? { prompt: input.config.prompt, model: input.config.model, temperature: input.config.temperature, maxTokens: input.config.maxTokens } : undefined;
    if (id === "product-recommendation") return { strategy: "按口味、过敏原、预算筛选商品", askFor: ["口味", "过敏原", "预算"], appliedConfig };
    if (id === "order-support") return {
      strategy: "先验证订单信息，再查询订单或物流",
      privacy: "不在回复中暴露完整个人信息",
      customerMessage: "请先在订单页核对商品和数量，再通过官方售后或平台客服申请退货或换货，并只提交平台所需的脱敏订单信息。",
      appliedConfig,
    };
    if (id === "safety-response") {
      const healthRisk = /降血糖|治疗|治愈|疗效|减肥|瘦身/.test(input.question);
      const fraudRisk = /中奖|一等奖|兑奖|转账|转钱|安全账户|验证码|银行卡|刷单|保证金|扫码|诈骗/.test(input.question);
      return {
      strategy: healthRisk ? "拒绝食品医疗或瘦身功效宣称，引导咨询专业人员" : fraudRisk ? "阻止转账与泄露凭证，引导官方核验或报警" : "未识别到需要专项安全回复的风险",
      tone: "明确、不恐吓",
      customerMessage: healthRisk
        ? (/减肥|瘦身/.test(input.question)
            ? "普通零食不能保证减肥或瘦身效果，不建议将零食当作体重管理方案。请核对配料表和营养成分，如有体重管理需求，请咨询专业人员。"
            : "食品不能替代医疗建议，不建议用低糖饼干进行血糖治疗；如有血糖管理需求，请咨询医生，并核对配料表和营养成分。")
        : fraudRisk ? "这类中奖或要求先付款的消息有较高诈骗风险。请不要转账，不要提供验证码、密码或银行卡信息，并通过官方店铺或平台客服核实。" : "",
      appliedConfig,
    };}
    throw new AgentError("SKILL_NOT_FOUND", `Skill 不存在：${id}`, 400);
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new AgentError("SKILL_TIMEOUT", `Skill ${id} 执行超时。`, 504)), timeoutMs);
  });
  try { return await Promise.race([work, timeout]); } finally { if (timer) clearTimeout(timer); }
}

export async function runTool(id: string, input: { question: string; finalReply?: string }, simulateFailure?: string) {
  if (simulateFailure === id) throw new AgentError("TOOL_EXECUTION_FAILED", `已按测试设置使 Tool ${id} 返回错误。`, 502);
  if (id === "catalog-search") return { items: searchProducts(input.question, await listProducts()).map(({ sku, name, category, price, spec, tasteTags, sceneTags, packageTags, peopleTags, avoidTags, sellingPoints, stockStatus }) => ({ sku, name, category, price, spec, tasteTags, sceneTags, packageTags, peopleTags, avoidTags, sellingPoints, stockStatus })), source: "business-products" };
  if (id === "price-query") return { currency: "CNY", quotes: searchProducts(input.question, await listProducts()).map(({ sku, name, price }) => ({ sku, name, price })), asOf: new Date().toISOString() };
  if (id === "order-query") return { orderId: CLASSROOM_ORDER.orderId, status: CLASSROOM_ORDER.status, privacyMasked: true };
  if (id === "logistics-query") return { trackingNo: CLASSROOM_ORDER.trackingNo, status: "运输中", latest: CLASSROOM_ORDER.latest };
  if (id === "risk-check") return checkRisk(input.question, input.finalReply);
  throw new AgentError("TOOL_NOT_FOUND", `Tool 不存在：${id}`, 400);
}

export function checkRisk(sourceText: string, responseText = sourceText): RiskResult {
  const text = `${sourceText}\n${responseText}`;
  const categories: string[] = [];
  if (/中奖|一等奖|兑奖|安全账户|刷单|诈骗|保证金|解冻费|返利|代付/.test(text)) categories.push("fraud");
  if (/转账|转钱|打款|汇款|安全账户|银行卡|验证码|付款码|收款码|密码/.test(text)) categories.push("financial-security");
  if (/降血糖|治疗|治愈|疗效|减肥|瘦身/.test(text)) categories.push("health-claim");
  const unsafeAdvice = containsUnsafeAdvice(responseText);
  return {
    level: unsafeAdvice ? "high" : categories.length ? "medium" : "low",
    blocked: unsafeAdvice,
    categories: [...new Set(categories)],
    message: unsafeAdvice ? "回复包含高风险操作建议，已阻断。" : categories.length ? "已识别风险语义，回复包含防骗引导。" : "未发现需要阻断的风险。",
  };
}

export function scoreExecution(plan: AgentPlan, results: Record<string, unknown>): ExecutionScore {
  const scheduledRiskCheck = plan.selectedTools.includes("risk-check");
  const expected = [
    ...plan.selectedSkills.map((id) => `skill:${id}`),
    ...plan.selectedTools.filter((id) => id !== "risk-check"),
  ];
  const coveredCapabilities = expected.filter((id) => results[id] !== undefined);
  const missing = expected.filter((id) => results[id] === undefined);
  const findings = [
    ...missing.map((id) => `缺少执行结果：${id}`),
    ...(scheduledRiskCheck ? [] : ["未安排最终 risk-check"]),
  ];
  const score = Math.max(0, 100 - missing.length * 25 - (scheduledRiskCheck ? 0 : 50));
  return { score, grade: findings.length ? "incomplete" : "ready", findings, coveredCapabilities };
}
