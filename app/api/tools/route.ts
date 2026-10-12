import { getTools, saveTools } from "@/lib/admin/store";
import { parseJsonBody } from "@/lib/http";

export async function GET() { return Response.json({ tools: await getTools() }); }

export async function PUT(request: Request) {
  const parsed = await parseJsonBody<{ id?: unknown; enabled?: unknown }>(request);
  if (!parsed.ok) return parsed.response;
  if (typeof parsed.value.id !== "string" || typeof parsed.value.enabled !== "boolean") {
    return Response.json({ error: { code: "INVALID_INPUT", message: "id 和 enabled 字段不合法。" } }, { status: 400 });
  }
  const tools = await getTools();
  if (!tools.some((item) => item.id === parsed.value.id)) return Response.json({ error: { code: "TOOL_NOT_FOUND", message: "Tool 不存在。" } }, { status: 404 });
  const next = tools.map((item) => item.id === parsed.value.id ? { ...item, enabled: parsed.value.enabled as boolean } : item);
  await saveTools(next);
  return Response.json({ tools: next });
}
