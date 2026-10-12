import type { LlmConfig, PlannerConfig, SkillConfig, ToolConfig } from "./types";

const now = "2026-09-30T00:00:00.000Z";

export const DEFAULT_SKILLS: SkillConfig[] = [
  {
    id: "product-recommendation", name: "商品推荐", description: "根据口味、过敏原和预算组织推荐策略。", enabled: true,
    model: "inherit", temperature: 0.3, maxTokens: 800, dependencyTools: ["catalog-search"],
    prompt: "你是零食推荐 Skill。优先确认口味、过敏原、预算与食用场景，仅根据 Tool 返回的商品信息给出建议。", version: 1, updatedAt: now,
  },
  {
    id: "order-support", name: "订单服务", description: "处理订单、退换货和物流问题。", enabled: true,
    model: "inherit", temperature: 0.1, maxTokens: 600, dependencyTools: ["order-query", "logistics-query"],
    prompt: "你是订单服务 Skill。必须依据订单或物流 Tool 输出，对账号、电话与运单号做脱敏处理。", version: 1, updatedAt: now,
  },
  {
    id: "safety-response", name: "安全回复", description: "对诈骗、资金与凭证风险生成安全引导。", enabled: true,
    model: "inherit", temperature: 0, maxTokens: 500, dependencyTools: ["risk-check"],
    prompt: "你是安全回复 Skill。明确阻止转账、验证码或密码泄露，引导用户通过官方渠道核验，必要时转人工或报警。", version: 1, updatedAt: now,
  },
];

export const DEFAULT_TOOLS: ToolConfig[] = [
  { id: "catalog-search", name: "商品检索", description: "查找符合问题语义的零食。", inputSchema: { type: "object", required: ["question"], properties: { question: { type: "string" } } }, outputExample: { items: ["海盐苏打饼干"], source: "catalog" }, enabled: true, version: "1.0.0" },
  { id: "price-query", name: "价格查询", description: "查询商品当前价格。", inputSchema: { type: "object", required: ["question"], properties: { question: { type: "string" } } }, outputExample: { currency: "CNY", quotes: [{ sku: "SNK-101", price: 12.9 }] }, enabled: true, version: "1.0.0" },
  { id: "order-query", name: "订单查询", description: "查询订单状态并返回脱敏数据。", inputSchema: { type: "object", required: ["question"], properties: { question: { type: "string" } } }, outputExample: { orderId: "SO-****", status: "已发货" }, enabled: true, version: "1.0.0" },
  { id: "logistics-query", name: "物流查询", description: "查询脱敏运单轨迹。", inputSchema: { type: "object", required: ["question"], properties: { question: { type: "string" } } }, outputExample: { trackingNo: "SF****", status: "运输中" }, enabled: true, version: "1.0.0" },
  { id: "risk-check", name: "风险检查", description: "复核用户输入与最终回复的资金、诈骗风险。", inputSchema: { type: "object", required: ["question", "finalReply"], properties: { question: { type: "string" }, finalReply: { type: "string" } } }, outputExample: { level: "low", blocked: false, categories: [] }, enabled: true, version: "1.1.0" },
];

export const DEFAULT_PLANNER: PlannerConfig = {
  version: 1,
  prompt: `你是零食电商客服 Agent 的 Planner。基于用户问题和多轮历史，生成执行计划 JSON。

## 严格规则
1. 只能引用“可用能力”中列出且启用的 skill id / tool id
2. 涉及价格、活动、优惠券、库存，必须用对应的 tool，禁止 LLM 编造
3. 最后一步必须是 risk-check（风控审核），如果 risk-check 未启用则直接返回错误计划
4. 涉及订单/售后问题必须调用 order-query / 退换货政策 Tool
5. 用户情绪激烈/明确要求人工/食品安全问题，必须选择对应的人工接管或安全处理 Skill
6. 用户问题模糊时，必须先澄清需求
7. 无法满足必需能力时 risk.action 必须为 degrade 或 handoff
8. 只返回 JSON，不得输出 Markdown 或额外说明。`,
  enabledSkills: DEFAULT_SKILLS.map((item) => item.id), enabledTools: DEFAULT_TOOLS.map((item) => item.id),
  mandatoryCapabilities: ["risk-check"],
  toolGroups: {
    base: DEFAULT_TOOLS.filter((item) => ["catalog-search", "order-query", "logistics-query", "risk-check"].includes(item.id)).map((item) => item.id),
    pricing: DEFAULT_TOOLS.filter((item) => ["catalog-search", "price-query"].includes(item.id)).map((item) => item.id),
  },
  model: "inherit", temperature: 0.2, maxTokens: 1200, updatedAt: now,
};

export const DEFAULT_LLM_CONFIG: LlmConfig = {
  provider: "classroom-fixture", defaultModel: "snackops-fixture-v2",
  models: {
    "classroom-fixture": ["snackops-fixture-v2"],
    coze: [],
    deepseek: ["deepseek-flash", "deepseek-v4-pro"],
  },
  updatedAt: now,
};
