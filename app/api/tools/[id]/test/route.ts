import { runTool } from "@/lib/agent/capabilities";
import { getTools } from "@/lib/admin/store";
import { validateToolInput } from "@/lib/admin/tool-input";
import { parseJsonBody } from "@/lib/http";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const parsed = await parseJsonBody<{ input?: unknown }>(request);
  if (!parsed.ok) return parsed.response;
  const tool = (await getTools()).find((item) => item.id === id);
  if (!tool) return Response.json({ error: { code: "TOOL_NOT_FOUND", message: "Tool 不存在。" } }, { status: 404 });
  if (!tool.enabled) return Response.json({ error: { code: "TOOL_DISABLED", message: "Tool 已禁用，不会伪造测试成功。" } }, { status: 409 });
  const validationErrors = validateToolInput(tool.inputSchema, parsed.value.input);
  if (validationErrors.length) return Response.json({ error: { code: "TOOL_INPUT_VALIDATION_FAILED", message: validationErrors.join("；"), details: validationErrors } }, { status: 400 });
  const input = parsed.value.input as { question: string; finalReply?: string };
  const started = Date.now();
  try {
    const output = await runTool(id, { question: input.question, finalReply: typeof input.finalReply === "string" ? input.finalReply : undefined });
    return Response.json({ toolId: id, input: parsed.value.input, output, durationMs: Date.now() - started, status: "SUCCESS", error: null });
  } catch (error) {
    return Response.json({ toolId: id, input: parsed.value.input, output: null, durationMs: Date.now() - started, status: "ERROR", error: error instanceof Error ? error.message : String(error) }, { status: 422 });
  }
}
