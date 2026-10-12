import type { LLMProvider } from "./provider";
import type { AgentPlan, Capability, ConversationMessage } from "./types";

const LEGACY_SAFETY_RESPONSE_PATTERN = /中奖|一等奖|兑奖|转账|转钱|安全账户|验证码|银行卡|刷单|保证金|扫码|诈骗|降血糖|治疗|治愈|疗效|减肥|瘦身/;

export interface PlannerInput {
  userInput: string;
  conversationHistory: ConversationMessage[];
  availableSkills: Capability[];
  availableTools: Capability[];
  mandatoryCapabilities: string[];
  plannerPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(candidate) as unknown;
}

function isPlan(value: unknown): value is AgentPlan {
  if (!value || typeof value !== "object") return false;
  const plan = value as Partial<AgentPlan>;
  const stringArray = (items: unknown): items is string[] => Array.isArray(items) && items.every((item) => typeof item === "string");
  return stringArray(plan.selectedSkills) && stringArray(plan.selectedTools) &&
    typeof plan.reasoning === "string" && stringArray(plan.mandatoryCapabilities) &&
    !!plan.risk && ["low", "medium", "high"].includes(plan.risk.level ?? "") &&
    stringArray(plan.risk.reasons) && ["continue", "degrade", "handoff"].includes(plan.risk.action ?? "");
}

const actionAliases: Record<string, AgentPlan["risk"]["action"]> = {
  proceed: "continue",
  allow: "continue",
  fallback: "degrade",
  caution: "degrade",
  escalate: "handoff",
  block: "handoff",
};

export function normalizePlan(value: unknown, mandatoryCapabilities: string[]): AgentPlan | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const riskSource = source.risk && typeof source.risk === "object" ? source.risk as Record<string, unknown> : null;
  if (!Array.isArray(source.selectedSkills) || !source.selectedSkills.every((item) => typeof item === "string")) return null;
  if (!Array.isArray(source.selectedTools) || !source.selectedTools.every((item) => typeof item === "string")) return null;
  if (!riskSource) return null;
  const rawAction = typeof riskSource.action === "string" ? riskSource.action.toLowerCase() : "";
  const action = (["continue", "degrade", "handoff"].includes(rawAction) ? rawAction : actionAliases[rawAction]) as AgentPlan["risk"]["action"] | undefined;
  if (!action) return null;
  const rawLevel = typeof riskSource.level === "string" ? riskSource.level.toLowerCase() : "";
  const level = (["low", "medium", "high"].includes(rawLevel) ? rawLevel : action === "continue" ? "low" : action === "degrade" ? "medium" : "high") as AgentPlan["risk"]["level"];
  const reasons = Array.isArray(riskSource.reasons) && riskSource.reasons.every((item) => typeof item === "string")
    ? riskSource.reasons
    : typeof riskSource.reason === "string" ? [riskSource.reason] : [];
  const suppliedMandatory = source.mandatoryCapabilities;
  if (suppliedMandatory !== undefined && (!Array.isArray(suppliedMandatory) || !suppliedMandatory.every((item) => typeof item === "string"))) return null;
  const plan: AgentPlan = {
    selectedSkills: source.selectedSkills,
    selectedTools: source.selectedTools,
    reasoning: typeof source.reasoning === "string" ? source.reasoning : reasons.join("；") || "Planner 已生成结构化执行计划。",
    mandatoryCapabilities: suppliedMandatory as string[] | undefined ?? [...mandatoryCapabilities],
    risk: { level, reasons, action },
  };
  return isPlan(plan) ? plan : null;
}

export function buildPlannerSystemPrompt(plannerPrompt?: string) {
  const baseSystem = plannerPrompt?.trim() || `你是 SnackOps Planner。只能从给定的 Skill 与 Tool 中选择。
价格问题必须选 calculate_price，订单/物流必须选对应 Tool，每次必须选 risk-check Tool；风险输入还必须选 safety-response Skill。
无法满足必需能力时 risk.action 必须为 degrade 或 handoff。`;
  return `${baseSystem}
只返回一个 JSON 对象，不要 Markdown、解释文字或额外字段。必须严格使用以下结构：
{"selectedSkills":[],"selectedTools":[],"reasoning":"简短原因","mandatoryCapabilities":[],"risk":{"level":"low","reasons":[],"action":"continue"}}
risk.level 只能是 low、medium、high；risk.action 只能是 continue、degrade、handoff；mandatoryCapabilities 必须原样复制输入中的同名数组。`;
}

export async function createPlan(provider: LLMProvider, input: PlannerInput) {
  const availableSkills = input.availableSkills.map((item) => item.id);
  const availableTools = input.availableTools.map((item) => item.id);
  const system = buildPlannerSystemPrompt(input.plannerPrompt);
  const prompt = JSON.stringify(input);
  const raw = await provider.generate({ purpose: "plan", system, prompt, context: {
    userInput: input.userInput, availableSkills, availableTools, mandatoryCapabilities: input.mandatoryCapabilities,
  }, temperature: input.temperature, maxTokens: input.maxTokens });
  try {
    const parsed = extractJson(raw);
    const plan = normalizePlan(parsed, input.mandatoryCapabilities);
    if (!plan) throw new Error("计划字段不完整");
    if (!LEGACY_SAFETY_RESPONSE_PATTERN.test(input.userInput)) plan.selectedSkills = plan.selectedSkills.filter((id) => id !== "safety-response");
    return { plan, parseError: null as string | null, raw };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      plan: {
        selectedSkills: [], selectedTools: [],
        reasoning: `Planner JSON 解析失败，已进入安全降级：${message}`,
        mandatoryCapabilities: input.mandatoryCapabilities,
        risk: { level: "high", reasons: ["Planner 输出无法验证"], action: "handoff" },
      } satisfies AgentPlan,
      parseError: message,
      raw,
    };
  }
}
