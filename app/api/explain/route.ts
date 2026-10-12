import { createProvider } from "@/lib/agent/provider";
import { getRun } from "@/lib/agent/store";
import { parseJsonBody } from "@/lib/http";

export async function POST(request: Request) {
  const parsed = await parseJsonBody<{ runId?: unknown; focus?: unknown }>(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;
  if (!body.runId) return Response.json({ error: { code: "INVALID_INPUT", message: "缺少 runId。" } }, { status: 400 });
  if (typeof body.runId !== "string") return Response.json({ error: { code: "INVALID_INPUT", message: "runId 必须是字符串。" } }, { status: 400 });
  const focus = typeof body.focus === "string" ? body.focus.slice(0, 200) : undefined;
  const run = await getRun(body.runId);
  if (!run) return Response.json({ error: { code: "RUN_NOT_FOUND", message: "运行记录不存在。" } }, { status: 404 });
  try {
    const provider = await createProvider(run.provider);
    const explanation = await provider.generate({ purpose: "explain", system: "用简洁中文解释 Agent 运行或风险判断，引用 Trace 事实，不暴露隐藏思维过程。", prompt: JSON.stringify({ run, focus }), context: { run, focus } });
    return Response.json({ runId: run.id, explanation });
  } catch (error) {
    return Response.json({ error: { code: "EXPLAIN_FAILED", message: error instanceof Error ? error.message : String(error) } }, { status: 502 });
  }
}
