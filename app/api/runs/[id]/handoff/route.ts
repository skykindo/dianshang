import { getRun, saveRun } from "@/lib/agent/store";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const run = await getRun(id);
  if (!run) return Response.json({ error: { code: "RUN_NOT_FOUND", message: "运行记录不存在。" } }, { status: 404 });
  run.status = "HANDOFF"; run.handoffAt = new Date().toISOString();
  await saveRun(run);
  return Response.json(run);
}
