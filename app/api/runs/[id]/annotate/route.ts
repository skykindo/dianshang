import { getRun, saveRun } from "@/lib/agent/store";
import { parseJsonBody } from "@/lib/http";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const parsed = await parseJsonBody<{ annotation?: unknown }>(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;
  if (typeof body.annotation !== "string") return Response.json({ error: { code: "INVALID_INPUT", message: "annotation 必须是字符串。" } }, { status: 400 });
  const run = await getRun(id);
  if (!run) return Response.json({ error: { code: "RUN_NOT_FOUND", message: "运行记录不存在。" } }, { status: 404 });
  run.annotation = body.annotation.slice(0, 2000);
  await saveRun(run);
  return Response.json(run);
}
