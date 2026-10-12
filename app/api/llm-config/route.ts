import { getLlmConfig, saveLlmConfig } from "@/lib/admin/store";
import { toPublicLlmConfig } from "@/lib/admin/public-config";
import type { ProviderName } from "@/lib/agent/types";
import { parseJsonBody } from "@/lib/http";

export async function GET() { return Response.json({ config: toPublicLlmConfig(await getLlmConfig()) }); }

export async function PUT(request: Request) {
  const parsed = await parseJsonBody<{ defaultModel?: unknown; models?: unknown }>(request);
  if (!parsed.ok) return parsed.response;
  const current = await getLlmConfig();
  if (typeof parsed.value.defaultModel !== "string" || !parsed.value.defaultModel.trim() || !parsed.value.models || typeof parsed.value.models !== "object") {
    return Response.json({ error: { code: "INVALID_INPUT", message: "defaultModel 和 models 配置不合法。" } }, { status: 400 });
  }
  const source = parsed.value.models as Record<string, unknown>;
  const providers: ProviderName[] = ["coze", "deepseek", "classroom-fixture"];
  const models = {} as Record<ProviderName, string[]>;
  for (const provider of providers) {
    const value = source[provider];
    if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) return Response.json({ error: { code: "INVALID_INPUT", message: `${provider} 模型列表不合法。` } }, { status: 400 });
    models[provider] = [...new Set(value.map((item) => item.trim()).filter(Boolean))];
  }
  const saved = await saveLlmConfig({ provider: current.provider, defaultModel: parsed.value.defaultModel.trim(), models });
  return Response.json({ config: toPublicLlmConfig(saved), message: "模型配置已保存。" });
}
