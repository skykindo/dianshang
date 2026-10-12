import { Config, LLMClient } from "coze-coding-dev-sdk";
import { getLlmConfig } from "@/lib/admin/store";
import type { LlmConfig } from "@/lib/admin/types";
import { AgentError } from "./errors";
import type { AgentPlan, ExecutionScore, ProviderName } from "./types";

export interface GenerateOptions {
  purpose: "plan" | "reply" | "explain";
  system: string;
  prompt: string;
  context?: Record<string, unknown>;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMProvider {
  name: ProviderName;
  model: string;
  generate(options: GenerateOptions): Promise<string>;
}

const DEFAULT_PROVIDER_TIMEOUT_MS = 30_000;

function providerTimeoutMs() {
  const configured = Number(process.env.LLM_PROVIDER_TIMEOUT_MS);
  return Number.isFinite(configured) && configured >= 100
    ? Math.min(configured, 120_000)
    : DEFAULT_PROVIDER_TIMEOUT_MS;
}

async function withProviderTimeout<T>(promise: Promise<T>, providerName: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new AgentError("PROVIDER_TIMEOUT", `${providerName} 接口请求超时。`, 504)),
      providerTimeoutMs(),
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

type FixtureValue = Record<string, unknown>;
type FixtureGenerator = (options: GenerateOptions) => string;

const buildFixturePlan: FixtureGenerator = (options) => {
  const context = options.context ?? {};
  const question = String(context.userInput ?? "");
  const skills = new Set((context.availableSkills as string[]) ?? []);
  const tools = new Set((context.availableTools as string[]) ?? []);
  const mandatory = (context.mandatoryCapabilities as string[]) ?? [];
  const selectedSkills: string[] = [];
  const selectedTools: string[] = [];
  const riskInput = /中奖|一等奖|兑奖|转账|转钱|安全账户|打款|汇款|验证码|诈骗|保证金|降血糖|治疗|治愈|疗效|减肥|瘦身/.test(question);
  for (const id of mandatory) {
    if (skills.has(id)) selectedSkills.push(id);
    if (tools.has(id)) selectedTools.push(id);
  }
  if (riskInput && skills.has("safety-response")) selectedSkills.push("safety-response");
  if (riskInput && skills.has("human-handoff-decision")) selectedSkills.push("human-handoff-decision");
  if (mandatory.some((id) => id.includes("order") || id.includes("logistics") || id.includes("return")) && skills.has("order-support")) selectedSkills.push("order-support");
  if (!riskInput && !mandatory.some((id) => id.includes("order") || id.includes("logistics") || id.includes("return")) && skills.has("product-recommendation")) selectedSkills.push("product-recommendation");
  if (!riskInput && tools.has("catalog-search") && selectedSkills.includes("product-recommendation")) selectedTools.push("catalog-search");
  const missing = mandatory.filter((id) => !skills.has(id) && !tools.has(id));
  const plan: AgentPlan = {
    selectedSkills,
    selectedTools: [...new Set(selectedTools)],
    reasoning: missing.length
      ? `必需能力不可用：${missing.join("、")}，不应伪装成功。`
      : `根据问题语义选择 ${[...selectedSkills, ...new Set(selectedTools)].join("、") || "安全降级"}。`,
    mandatoryCapabilities: mandatory,
    risk: {
      level: riskInput ? "high" : "low",
      reasons: riskInput ? ["输入包含资金或中奖诈骗特征"] : [],
      action: missing.length ? "handoff" : riskInput ? "degrade" : "continue",
    },
  };
  return JSON.stringify(plan);
};

function fixtureCatalogReply(value: FixtureValue) {
  const items = Array.isArray(value.items) ? value.items as Array<Record<string, unknown>> : [];
  if (!items.length) return "你的需求还比较宽泛，请补充偏好的口味、品类、场景、预算或需要避开的过敏原，我再为你筛选合适商品。";
  const descriptions = items.map((item) => {
    const tags = [...(Array.isArray(item.tasteTags) ? item.tasteTags : []), ...(Array.isArray(item.sellingPoints) ? item.sellingPoints : [])].join("、");
    const price = typeof item.price === "number" ? `￥${item.price.toFixed(2)}` : "";
    const stock = item.stockStatus === "out_of_stock" ? "暂时缺货" : item.stockStatus === "low_stock" ? "库存不多" : "现货";
    return `${String(item.name ?? "商品")}${price ? `（${price}）` : ""}${tags ? `，特点是${tags}` : ""}，${stock}`;
  });
  return `可以考虑${descriptions.join("；")}。如果你有过敏原、口味或预算要求，告诉我后还可以继续筛选。`;
}

function fixturePriceReply(value: FixtureValue) {
  const quotes = Array.isArray(value.quotes) ? value.quotes as Array<Record<string, unknown>> : [];
  if (!quotes.length) return "暂时没查到符合条件的价格。";
  return `当前可查价格：${quotes.map((item) => `${String(item.name ?? item.sku ?? "商品")} ￥${Number(item.price).toFixed(2)}`).join("；")}。`;
}

const reportRenderers: Record<string, (value: FixtureValue) => string> = {
  "skill:safety-response": (value) => String(value.customerMessage ?? ""),
  "skill:order-support": (value) => String(value.customerMessage ?? ""),
  "skill:risk-check": (value) => String(value.customerMessage ?? ""),
  "price-query": fixturePriceReply,
  "calculate_price": fixturePriceReply,
  "order-query": (value) => `订单 ${String(value.orderId ?? "")}当前状态为“${String(value.status ?? "未知")}”。`,
  "query_order": (value) => `订单 ${String(value.orderId ?? "")}当前状态为“${String(value.status ?? "未知")}”。`,
  "query_return_policy": (value) => String(value.policy ?? ""),
  "logistics-query": (value) => `物流单号 ${String(value.trackingNo ?? "")}，当前${String(value.status ?? "状态未知")}；最新进展：${String(value.latest ?? "暂无")}。`,
  "track_logistics": (value) => `物流单号 ${String(value.trackingNo ?? "")}，当前${String(value.status ?? "状态未知")}；最新进展：${String(value.latest ?? "暂无")}。`,
  "catalog-search": fixtureCatalogReply,
  "query_products": fixtureCatalogReply,
  "query_coupons": (value) => `查到可用优惠：${(Array.isArray(value.coupons) ? value.coupons : []).map((item) => String((item as Record<string, unknown>).name ?? "优惠券")).join("、") || "暂无可用优惠券"}。`,
};

const buildFixtureReport: FixtureGenerator = (options) => {
  const context = options.context ?? {};
  const question = String(context.question ?? "");
  const results = (context.toolResults as Record<string, FixtureValue>) ?? {};
  const score = context.executionScore as ExecutionScore | undefined;
  const sections = Object.entries(results)
    .map(([id, value]) => reportRenderers[id]?.(value) ?? "")
    .filter(Boolean);
  const lead = score?.grade === "incomplete" ? "部分信息暂时无法核实，" : score?.grade === "unsafe" ? "这个请求存在安全风险，" : "";
  const details = sections.join(" ") || `针对“${question}”暂无可用的工具结果，请补充信息或联系人工客服。`;
  return `${lead}${details}`;
};

const explainFixtureRun: FixtureGenerator = (options) => {
  const run = options.context?.run as { id?: string; status?: string; riskResult?: unknown; steps?: unknown[] } | undefined;
  return `运行 ${run?.id ?? "-"} 的状态为 ${run?.status ?? "未知"}。该结论来自计划校验、${run?.steps?.length ?? 0} 个执行步骤、执行评分与最终风险复核；风险结果为 ${JSON.stringify(run?.riskResult ?? null)}。`;
};

const fixtureGenerators: Record<GenerateOptions["purpose"], FixtureGenerator> = {
  plan: buildFixturePlan,
  reply: buildFixtureReport,
  explain: explainFixtureRun,
};

class FixtureProvider implements LLMProvider {
  name = "classroom-fixture" as const;
  constructor(public model = "snackops-fixture-v2") {}
  async generate(options: GenerateOptions) {
    return fixtureGenerators[options.purpose](options);
  }
}

class DeepSeekProvider implements LLMProvider {
  name = "deepseek" as const;
  model: string;
  constructor(private apiKey: string, private baseUrl: string, model: string) { this.model = model; }
  async generate(options: GenerateOptions) {
    const controller = new AbortController();
    const request = (async () => {
      try {
        const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
          method: "POST",
          signal: controller.signal,
          headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: this.model, temperature: options.temperature ?? 0.2, max_tokens: options.maxTokens, messages: [
            { role: "system", content: options.system }, { role: "user", content: options.prompt },
          ] }),
        });
        if (!response.ok) throw new AgentError("PROVIDER_REQUEST_FAILED", `DeepSeek 接口请求失败（${response.status}）。`, 502);
        const data = await response.json() as { choices?: { message?: { content?: string } }[] };
        const content = data.choices?.[0]?.message?.content;
        if (!content) throw new AgentError("PROVIDER_EMPTY_RESPONSE", "DeepSeek 接口未返回内容。", 502);
        return content;
      } catch (error) {
        if (controller.signal.aborted) throw new AgentError("PROVIDER_TIMEOUT", "DeepSeek 接口请求超时。", 504);
        throw error;
      }
    })();
    try {
      return await withProviderTimeout(request, "DeepSeek");
    } catch (error) {
      if (error instanceof AgentError && error.code === "PROVIDER_TIMEOUT") controller.abort();
      throw error;
    }
  }
}

class CozeProvider implements LLMProvider {
  name = "coze" as const;
  model: string;
  private client: LLMClient;
  constructor(apiKey: string, model: string) {
    this.model = model;
    this.client = new LLMClient(new Config({
      apiKey,
      baseUrl: process.env.COZE_INTEGRATION_BASE_URL,
      modelBaseUrl: process.env.COZE_INTEGRATION_MODEL_BASE_URL,
    }));
  }
  async generate(options: GenerateOptions) {
    const response = await withProviderTimeout(this.client.invoke([
      { role: "system", content: options.system },
      { role: "user", content: options.prompt },
    ], { model: this.model, temperature: options.temperature ?? 0.2 }), "Coze");
    const content = typeof response.content === "string" ? response.content : String(response.content ?? "");
    if (!content) throw new AgentError("PROVIDER_EMPTY_RESPONSE", "Coze 模型未返回内容。", 502);
    return content;
  }
}

export async function createProvider(requested?: ProviderName, configSnapshot?: LlmConfig): Promise<LLMProvider> {
  const config = configSnapshot ? structuredClone(configSnapshot) : await getLlmConfig();
  const name = requested ?? config.provider;
  const configuredModel = config.provider === name ? config.defaultModel : config.models[name][0];
  if (name === "classroom-fixture") return new FixtureProvider(configuredModel || "snackops-fixture-v2");
  if (name === "deepseek") {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
    const model = process.env.DEEPSEEK_MODEL || configuredModel || process.env.LLM_MODEL;
    if (!apiKey || !model) throw new AgentError("PROVIDER_CONFIG_MISSING", "DeepSeek 模式缺少 DEEPSEEK_API_KEY 或模型配置。如需无密钥演示，请显式设置 LLM_PROVIDER=classroom-fixture。", 503);
    return new DeepSeekProvider(apiKey, baseUrl, model);
  }
  if (name === "coze") {
    const apiKey = process.env.COZE_API_TOKEN ?? process.env.COZE_CODING_API_KEY;
    const model = configuredModel || process.env.LLM_MODEL;
    if (!apiKey || !model) throw new AgentError("PROVIDER_CONFIG_MISSING", "Coze 模式缺少 COZE_API_TOKEN（或 COZE_CODING_API_KEY）与 LLM_MODEL。如需无密钥演示，请显式设置 LLM_PROVIDER=classroom-fixture。", 503);
    return new CozeProvider(apiKey, model);
  }
  throw new AgentError("PROVIDER_UNSUPPORTED", `不支持的 LLM Provider：${String(name)}`, 400);
}
