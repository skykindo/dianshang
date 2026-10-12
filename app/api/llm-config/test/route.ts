import { AgentError } from "@/lib/agent/errors";
import { createProvider } from "@/lib/agent/provider";
import type { ProviderName } from "@/lib/agent/types";
import { parseJsonBody } from "@/lib/http";

export async function POST(request: Request) {
  const parsed = await parseJsonBody<{ provider?: unknown }>(request);
  if (!parsed.ok) return parsed.response;
  const requested = parsed.value.provider;
  if (requested !== undefined && (typeof requested !== "string" || !["coze", "deepseek", "classroom-fixture"].includes(requested))) return Response.json({ error: { code: "PROVIDER_UNSUPPORTED", message: "Provider 不受支持。" } }, { status: 400 });
  const started = Date.now();
  try {
    const provider = await createProvider(requested as ProviderName | undefined);
    const output = await provider.generate({ purpose: "explain", system: "返回简短连接测试结果。", prompt: "SnackOps provider health check", context: { run: { id: "health-check", status: "SUCCESS", steps: [] } } });
    return Response.json({ status: "SUCCESS", provider: provider.name, model: provider.model, durationMs: Date.now() - started, responsePreview: output.slice(0, 160) });
  } catch (error) {
    const code = error instanceof AgentError ? error.code : "PROVIDER_TEST_FAILED";
    const status = error instanceof AgentError ? error.status : 502;
    return Response.json({ error: { code, message: error instanceof Error ? error.message : String(error), durationMs: Date.now() - started } }, { status });
  }
}
