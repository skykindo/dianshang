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
  skill("after-sales-classification", "售后问题分类", "识别退货、换货、退款、物流与质量类型。", ["query_order", "query_return_policy"]),
  skill("allergy-risk-reminder", "过敏风险提醒", "识别过敏原和人群风险，提醒核对配料。", ["query_products"], 0),
  skill("clarification-question", "澄清问题生成", "在需求不完整时生成最少且必要的追问。"),
  skill("complaint-triage", "投诉分流", "判断投诉紧急度与处置路径。", ["create_after_sales_ticket"]),
  skill("conversation-summary", "会话总结", "生成可用于人工接管的结构化会话摘要。"),
  skill("gift-scenario-advisor", "送礼场景推荐", "结合对象、场合、预算和包装给出送礼建议。", ["query_products", "query_activities"]),
  skill("human-handoff-decision", "人工接管判断", "根据风险、情绪和处理边界判断是否转人工。"),
  skill("need-extraction", "用户需求结构化", "提取品类、口味、预算、场景、数量和忌口。"),
  skill("product-substitution", "缺货替代推荐", "当用户要的商品缺货时，推荐口味/价位/定位相近的替代品。", ["query_products"]),
  skill("recommendation-reason", "推荐理由生成", "将筛选依据转换为简洁、可验证的推荐理由。", ["query_products"]),
  skill("response-generator", "客服话术生成", "基于已验证证据生成自然、克制的客服回复。"),
  { ...skill("对话问候-skill", "对话问候 Skill", "对用户进行开场问候并引导描述需求。"), enabled: false },
];

function skill(id: string, name: string, description: string, dependencyTools: string[] = [], temperature = 0.2): SkillConfig {
  return { id, name, description, enabled: true, model: "inherit", temperature, maxTokens: 800, dependencyTools,
    prompt: `# ${name} (${id})\n\n${description}\n\n## 规则\n- 只使用已验证的 Tool 结果。\n- 信息不足时明确追问，不编造事实。\n- 输出简洁、可执行的中文结果。`, version: 1, updatedAt: now };
}

export const DEFAULT_TOOLS: ToolConfig[] = [
  { id: "catalog-search", name: "商品检索", description: "查找符合问题语义的零食。", category: "数据查询", sourceType: "本地代码", sourceFile: "lib/agent/capabilities.ts", dataSource: "business-products", inputSchema: { type: "object", required: ["question"], properties: { question: { type: "string", description: "用户商品需求" } } }, outputExample: { items: ["海盐苏打饼干"], source: "catalog" }, enabled: true, version: "1.0.0" },
  { id: "price-query", name: "价格查询", description: "查询商品当前价格。", category: "数据查询", sourceType: "本地代码", sourceFile: "lib/agent/capabilities.ts", dataSource: "business-products", inputSchema: { type: "object", required: ["question"], properties: { question: { type: "string", description: "价格查询问题" } } }, outputExample: { currency: "CNY", quotes: [{ sku: "SNK-101", price: 12.9 }] }, enabled: true, version: "1.0.0" },
  { id: "order-query", name: "订单查询", description: "查询订单状态并返回脱敏数据。", category: "数据查询", sourceType: "本地代码", sourceFile: "lib/agent/capabilities.ts", dataSource: "classroom-order", inputSchema: { type: "object", required: ["question"], properties: { question: { type: "string", description: "订单查询问题" } } }, outputExample: { orderId: "SO-****", status: "已发货" }, enabled: true, version: "1.0.0" },
  { id: "logistics-query", name: "物流查询", description: "查询脱敏运单轨迹。", category: "外部服务", sourceType: "本地代码", sourceFile: "lib/agent/capabilities.ts", dataSource: "classroom-logistics", inputSchema: { type: "object", required: ["question"], properties: { question: { type: "string", description: "物流查询问题" } } }, outputExample: { trackingNo: "SF****", status: "运输中" }, enabled: true, version: "1.0.0" },
  { id: "risk-check", name: "风险检查", description: "复核用户输入与最终回复的资金、诈骗风险。", category: "计算解析", sourceType: "本地代码", sourceFile: "lib/agent/capabilities.ts", dataSource: "system", inputSchema: { type: "object", required: ["question", "finalReply"], properties: { question: { type: "string", description: "用户输入" }, finalReply: { type: "string", description: "待复核回复" } } }, outputExample: { level: "low", blocked: false, categories: [] }, enabled: true, version: "1.1.0" },
  tool("query_products", "查询商品", "按关键词/品类/口味/预算/场景过滤商品库", "数据查询", "data/products.json", { keyword: s("关键词（商品名/描述/标签）"), category: s("品类，如坚果、巧克力"), flavorTags: a("口味标签，如 [‘麻辣’,‘奶香’]"), scenario: s("使用场景，如办公室、送礼"), maxBudget: n("单品最大预算"), limit: n("返回数量上限，默认 5") }, { items: [] }),
  tool("query_activities", "查询活动", "查询当前可用促销活动", "数据查询", "data/activities.json", { keyword: s("活动或商品关键词"), productIds: a("商品 ID 列表") }, { activities: [] }),
  tool("query_coupons", "查询优惠券", "查询用户可用优惠券及门槛", "数据查询", "data/coupons.json", { userId: s("用户 ID"), productIds: a("商品 ID 列表"), orderAmount: n("订单金额") }, { coupons: [] }),
  tool("calculate_price", "计算价格", "结合商品、活动与优惠券计算实付金额", "计算解析", "src/lib/tools.ts", { question: s("包含商品和价格的自然语言问题"), amount: n("原价"), couponAmount: n("优惠金额") }, { currency: "CNY", payable: 52 }),
  tool("query_order", "查询订单", "查询订单状态并返回脱敏信息", "数据查询", "data/orders.json", { orderId: s("订单号"), userId: s("用户 ID") }, { orderId: "SO-****", status: "已发货" }),
  tool("query_return_policy", "退换货政策", "检索适用的退换货规则", "知识库", "data/return-policy.json", { category: s("商品品类"), issueType: s("售后问题类型") }, { policy: "支持 7 天内申请" }),
  { ...tool("track_logistics", "查询物流轨迹", "调用物流服务查询脱敏运单轨迹", "外部服务", "物流服务 API", { trackingNo: s("运单号"), orderId: s("订单号") }, { status: "运输中" }), sourceType: "外部服务" },
  tool("search_faq", "知识库搜索", "搜索客服 FAQ 与标准处理方案", "知识库", "data/faq.json", { query: s("搜索问题"), limit: n("返回数量上限") }, { answers: [] }),
  tool("query_user_profile", "查询用户画像", "查询脱敏的用户偏好与会员信息", "数据查询", "data/user-profiles.json", { userId: s("用户 ID") }, { preferences: [] }),
  tool("estimate_delivery", "预估配送时效", "根据地址与库存位置预估配送时间", "计算解析", "src/lib/tools.ts", { address: s("收货地址"), productIds: a("商品 ID 列表") }, { estimatedDays: 2 }),
  tool("create_after_sales_ticket", "创建售后工单", "根据已确认信息创建售后工单", "写入操作", "data/after-sales-tickets.json", { orderId: s("订单号"), issueType: s("问题类型"), description: s("问题描述") }, { ticketId: "AS-****" }),
  { ...tool("reserve_stock", "锁定库存", "为已确认的商品与数量预留库存", "写入操作", "data/inventory.json", { productId: s("商品 ID"), quantity: n("数量"), userId: s("用户 ID") }, { reservationId: "RSV-****" }), enabled: false },
  tool("parse_address", "解析收货地址", "将自然语言地址拆分为结构化字段", "计算解析", "src/lib/tools.ts", { address: s("完整收货地址") }, { province: "上海市", city: "上海市" }),
];

function s(description: string) { return { type: "string", description }; }
function n(description: string) { return { type: "number", description }; }
function a(description: string) { return { type: "array", items: { type: "string" }, description }; }
function tool(id: string, name: string, description: string, category: ToolConfig["category"], dataSource: string, properties: Record<string, unknown>, outputExample: unknown): ToolConfig {
  return { id, name, description, category, sourceType: "本地代码", sourceFile: "src/lib/tools.ts", dataSource, inputSchema: { type: "object", properties }, outputExample, enabled: true, version: "1.0.0" };
}

export const DEFAULT_PLANNER: PlannerConfig = {
  version: 1,
  prompt: `你是零食电商客服 Agent 的 Planner。基于用户问题和多轮历史，生成执行计划 JSON。

## 严格规则
1. 只能引用“可用能力”中列出且启用的 skill id / tool id
2. 涉及价格、活动、优惠券、库存，必须用对应的 tool，禁止 LLM 编造
3. 最后一步必须执行 risk-check Tool（风控审核），如果 risk-check 未启用则直接返回错误计划
4. 涉及订单/售后问题必须调用 query_order / query_return_policy
5. 用户情绪激烈/明确要求人工/食品安全问题，必须选择对应的人工接管或安全处理 Skill
6. 用户问题模糊时，必须先澄清需求
7. 无法满足必需能力时 risk.action 必须为 degrade 或 handoff
8. 只返回 JSON，不得输出 Markdown 或额外说明。`,
  enabledSkills: DEFAULT_SKILLS.map((item) => item.id), enabledTools: DEFAULT_TOOLS.map((item) => item.id),
  mandatoryCapabilities: ["risk-check"],
  toolGroups: {
    base: DEFAULT_TOOLS.filter((item) => ["query_products", "query_order", "track_logistics", "search_faq"].includes(item.id)).map((item) => item.id),
    pricing: DEFAULT_TOOLS.filter((item) => ["query_products", "query_activities", "query_coupons", "calculate_price"].includes(item.id)).map((item) => item.id),
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
