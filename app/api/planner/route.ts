import { getLlmConfig, getPlannerConfig, getSkills, getTools, savePlannerConfig } from "@/lib/admin/store";
import { parseJsonBody } from "@/lib/http";

export async function GET() {
  const [planner, skills, tools, llm] = await Promise.all([getPlannerConfig(), getSkills(), getTools(), getLlmConfig()]);
  return Response.json({ planner, skills, tools, llm: { provider: llm.provider, defaultModel: llm.defaultModel, models: llm.models } });
}

export async function PUT(request: Request) {
  const parsed = await parseJsonBody<{ prompt?: unknown; enabledSkills?: unknown; enabledTools?: unknown; mandatoryCapabilities?: unknown; toolGroups?: unknown; model?: unknown; temperature?: unknown; maxTokens?: unknown }>(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;
  const [skills, tools] = await Promise.all([getSkills(), getTools()]);
  const skillIds = new Set(skills.map((item) => item.id));
  const toolIds = new Set(tools.map((item) => item.id));
  const stringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string");
  const groups = body.toolGroups && typeof body.toolGroups === "object" ? body.toolGroups as { base?: unknown; pricing?: unknown } : null;
  const validGroups = !!groups && stringArray(groups.base) && groups.base.every((id) => toolIds.has(id)) && stringArray(groups.pricing) && groups.pricing.every((id) => toolIds.has(id));
  const valid = typeof body.prompt === "string" && body.prompt.trim() && stringArray(body.enabledSkills) && body.enabledSkills.every((id) => skillIds.has(id)) &&
    stringArray(body.enabledTools) && body.enabledTools.every((id) => toolIds.has(id)) && stringArray(body.mandatoryCapabilities) && body.mandatoryCapabilities.every((id) => skillIds.has(id) || toolIds.has(id)) &&
    validGroups && typeof body.model === "string" && typeof body.temperature === "number" && body.temperature >= 0 && body.temperature <= 2 &&
    typeof body.maxTokens === "number" && Number.isInteger(body.maxTokens) && body.maxTokens >= 100 && body.maxTokens <= 32768;
  if (!valid) return Response.json({ error: { code: "PLANNER_VALIDATION_FAILED", message: "Planner Prompt 或能力列表不合法。" } }, { status: 422 });
  const mandatoryCapabilities = [...new Set(["risk-check", ...(body.mandatoryCapabilities as string[])])];
  const planner = await savePlannerConfig({
    prompt: body.prompt as string,
    enabledSkills: body.enabledSkills as string[],
    enabledTools: body.enabledTools as string[],
    mandatoryCapabilities,
    toolGroups: { base: groups!.base as string[], pricing: groups!.pricing as string[] },
    model: body.model as string,
    temperature: body.temperature as number,
    maxTokens: body.maxTokens as number,
  });
  return Response.json({ planner, message: `Planner v${planner.version} 已保存。` });
}
