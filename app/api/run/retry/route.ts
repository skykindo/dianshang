import { executeAgentRun } from "@/lib/agent/executor";
import { getRun } from "@/lib/agent/store";
import { parseJsonBody } from "@/lib/http";

export async function POST(request: Request) {
  const parsed = await parseJsonBody<{ runId?: unknown }>(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;
  if (!body.runId) return Response.json({ error: { code: "INVALID_INPUT", message: "缺少 runId。" } }, { status: 400 });
  if (typeof body.runId !== "string") return Response.json({ error: { code: "INVALID_INPUT", message: "runId 必须是字符串。" } }, { status: 400 });
  const original = await getRun(body.runId);
  if (!original) return Response.json({ error: { code: "RUN_NOT_FOUND", message: "运行记录不存在。" } }, { status: 404 });
  const config = original.executionConfig;
  const run = await executeAgentRun({
    userInput: original.question,
    conversationId: original.conversationId,
    conversationHistory: config?.conversationHistory ?? [],
    source: "retry",
    provider: original.provider,
    enabledSkills: config?.enabledSkills,
    enabledTools: config?.enabledTools,
    mandatoryCapabilities: config?.mandatoryCapabilities,
    simulateToolFailure: config?.simulateToolFailure,
    retryOf: original.id,
  });
  return Response.json(run, { status: run.status === "ERROR" ? 422 : 200 });
}
