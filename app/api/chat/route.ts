import { executeAgentRun } from "@/lib/agent/executor";
import type { ProviderName } from "@/lib/agent/types";
import { parseJsonBody } from "@/lib/http";

// 保留旧路径的响应外形，但所有请求都必须经过统一 Agent 主链路。
export async function POST(request: Request) {
  const parsed = await parseJsonBody<{ userInput?: unknown; provider?: unknown }>(request);
  if (!parsed.ok) return parsed.response;
  const userInput = typeof parsed.value.userInput === "string" ? parsed.value.userInput.trim() : "";
  if (!userInput || userInput.length > 10_000) {
    return Response.json({ error: { code: "INVALID_INPUT", message: "userInput 必须是 1–10000 字符的字符串。" } }, { status: 400 });
  }
  const provider = typeof parsed.value.provider === "string" ? parsed.value.provider as ProviderName : undefined;
  if (provider && !["coze", "deepseek", "classroom-fixture"].includes(provider)) {
    return Response.json({ error: { code: "PROVIDER_UNSUPPORTED", message: `不支持的 LLM Provider：${provider}` } }, { status: 400 });
  }
  const run = await executeAgentRun({ userInput, provider, source: "legacy-chat" });
  return Response.json(
    { reply: run.finalReply, runId: run.id, status: run.status, error: run.error, riskResult: run.riskResult },
    { status: run.status === "ERROR" ? 422 : 200 },
  );
}
