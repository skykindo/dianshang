import type { LlmConfig, PublicLlmConfig } from "./types";

export function toPublicLlmConfig(config: LlmConfig): PublicLlmConfig {
  const cozeApiKey = Boolean(process.env.COZE_API_TOKEN ?? process.env.COZE_CODING_API_KEY);
  const deepseekKey = Boolean(process.env.DEEPSEEK_API_KEY);
  const cozeModel = Boolean(process.env.LLM_MODEL || config.models.coze[0] || (config.provider === "coze" && config.defaultModel));
  const deepseekModel = Boolean(process.env.DEEPSEEK_MODEL || process.env.LLM_MODEL || config.models.deepseek[0] || (config.provider === "deepseek" && config.defaultModel));
  return {
    ...structuredClone(config),
    descriptions: {
      coze: "通过 coze-coding-dev-sdk 调用 Coze 模型服务。",
      deepseek: "直接调用 DeepSeek 官方 API，不在客户端暴露密钥。",
      "classroom-fixture": "无外部密钥的确定性演示模式，仍经过完整 Agent 链路。",
    },
    environment: {
      coze: { apiKey: cozeApiKey, model: cozeModel, baseUrl: Boolean(process.env.COZE_INTEGRATION_BASE_URL || process.env.COZE_INTEGRATION_MODEL_BASE_URL), ready: cozeApiKey && cozeModel },
      deepseek: { apiKey: deepseekKey, baseUrl: true, model: deepseekModel, ready: deepseekKey && deepseekModel },
    },
    modeLabel: config.provider === "classroom-fixture" ? "演示稳定模式" : "真实 Provider 模式",
  };
}
