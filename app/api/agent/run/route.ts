import { executeAgentRun } from "@/lib/agent/executor";
import type { AgentEvent, RunRequest } from "@/lib/agent/types";
import { parseJsonBody } from "@/lib/http";

export const runtime = "nodejs";

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function validateRunRequest(value: unknown): value is RunRequest {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  if (typeof body.userInput !== "string" || !body.userInput.trim() || body.userInput.length > 10_000) return false;
  if (body.provider !== undefined && !["coze", "deepseek", "classroom-fixture"].includes(String(body.provider))) return false;
  if (body.enabledSkills !== undefined && !isStringArray(body.enabledSkills)) return false;
  if (body.enabledTools !== undefined && !isStringArray(body.enabledTools)) return false;
  if (body.mandatoryCapabilities !== undefined && !isStringArray(body.mandatoryCapabilities)) return false;
  if (body.conversationHistory !== undefined && (!Array.isArray(body.conversationHistory) || body.conversationHistory.length > 100 || body.conversationHistory.some((item) => {
    if (!item || typeof item !== "object") return true;
    const message = item as Record<string, unknown>;
    return !["user", "assistant"].includes(String(message.role)) || typeof message.content !== "string" || message.content.length > 10_000;
  }))) return false;
  return true;
}

export async function POST(request: Request) {
  const parsed = await parseJsonBody<unknown>(request);
  if (!parsed.ok) return parsed.response;
  if (!validateRunRequest(parsed.value)) {
    return Response.json({ error: { code: "INVALID_INPUT", message: "userInput 必须是 1–10000 字符的字符串，且其他字段必须符合 Agent 请求格式。" } }, { status: 400 });
  }
  const body = parsed.value;
  const encoder = new TextEncoder();
  let disconnected = false;
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: AgentEvent) => {
        if (disconnected) return;
        try { controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)); }
        catch { disconnected = true; }
      };
      void executeAgentRun(body, send)
        .catch((error: unknown) => send({ type: "error", runId: "", code: "AGENT_STREAM_FAILED", error: error instanceof Error ? error.message : String(error) }))
        .finally(() => {
          if (!disconnected) try { controller.close(); } catch { disconnected = true; }
        });
    },
    cancel() { disconnected = true; },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
