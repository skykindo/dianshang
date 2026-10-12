import type { AgentPlan, Capability, PlanValidation } from "./types";

export function validatePlan(args: {
  plan: AgentPlan;
  question: string;
  skills: Capability[];
  tools: Capability[];
  mandatoryCapabilities: string[];
  parseError?: string | null;
}): PlanValidation {
  const enabledSkills = new Set(args.skills.filter((item) => item.enabled).map((item) => item.id));
  const enabledTools = new Set(args.tools.filter((item) => item.enabled).map((item) => item.id));
  const selected = new Set([...args.plan.selectedSkills, ...args.plan.selectedTools]);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (args.parseError) errors.push(`Planner JSON 解析失败：${args.parseError}`);
  for (const id of args.plan.selectedSkills) if (!enabledSkills.has(id)) errors.push(`Skill 不存在或未启用：${id}`);
  for (const id of args.plan.selectedTools) if (!enabledTools.has(id)) errors.push(`Tool 不存在或未启用：${id}`);
  for (const id of args.mandatoryCapabilities) if (!selected.has(id)) errors.push(`遗漏必需能力：${id}`);
  for (const id of args.mandatoryCapabilities) if (!args.plan.mandatoryCapabilities.includes(id)) errors.push(`Plan.mandatoryCapabilities 遗漏：${id}`);
  for (const id of args.plan.mandatoryCapabilities) if (!args.mandatoryCapabilities.includes(id)) warnings.push(`Planner 增加了必需能力：${id}`);

  const priceScene = /价格|多少钱|便宜|优惠|比价|预算|售价|块钱|元内/.test(args.question);
  const riskScene = /中奖|一等奖|兑奖|转账|转钱|安全账户|验证码|银行卡|刷单|保证金|扫码|诈骗|降血糖|治疗|治愈|疗效|减肥|瘦身/.test(args.question);
  if (priceScene && !args.plan.selectedTools.includes("calculate_price")) errors.push("价格场景缺少 calculate_price Tool。");
  if (riskScene && !args.plan.selectedTools.includes("risk-check")) errors.push("风险场景缺少 risk-check Tool，已阻断。");
  if (riskScene && !args.plan.selectedSkills.includes("safety-response")) errors.push("风险场景缺少 safety-response Skill，已阻断。");
  if (args.mandatoryCapabilities.some((id) => !enabledSkills.has(id) && !enabledTools.has(id))) {
    errors.push("必需能力已被禁用或不存在，不能继续执行。");
  }
  return { valid: errors.length === 0, blocked: errors.length > 0, errors, warnings };
}
