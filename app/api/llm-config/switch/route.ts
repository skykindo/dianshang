import { getLlmConfig, saveLlmConfig } from "@/lib/admin/store";
import { toPublicLlmConfig } from "@/lib/admin/public-config";
import type { ProviderName } from "@/lib/agent/types";
import { parseJsonBody } from "@/lib/http";

export async function POST(request: Request) {
  const parsed = await parseJsonBody<{ provider?: unknown }>(request);
  if (!parsed.ok) return parsed.response;
  const provider = parsed.value.provider;
  if (typeof provider !== "string" || !["coze", "deepseek", "classroom-fixture"].includes(provider)) return Response.json({ error: { code: "PROVIDER_UNSUPPORTED", message: "Provider 不受支持。" } }, { status: 400 });
  const current = await getLlmConfig();
  const typedProvider = provider as ProviderName;
  const defaultModel = current.models[typedProvider][0] || (typedProvider === "deepseek" ? process.env.DEEPSEEK_MODEL : process.env.LLM_MODEL) || (typedProvider === "classroom-fixture" ? "snackops-fixture-v2" : "");
  const saved = await saveLlmConfig({ ...current, provider: typedProvider, defaultModel });
  const overridden = saved.provider !== typedProvider;
  return Response.json({
    config: toPublicLlmConfig(saved),
    message: overridden ? `配置已保存，但环境变量 LLM_PROVIDER 当前锁定为 ${saved.provider}。` : `已切换到 ${provider}。`,
    environmentOverride: overridden,
  });
}
