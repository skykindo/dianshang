import { getSkills, getTools, saveSkill, SkillVersionConflictError } from "@/lib/admin/store";
import type { SkillConfig } from "@/lib/admin/types";
import { parseJsonBody } from "@/lib/http";

export async function GET() {
  return Response.json({ skills: await getSkills() });
}

export async function PUT(request: Request) {
  const parsed = await parseJsonBody<{ id?: unknown; skill?: unknown; changeNote?: unknown }>(request);
  if (!parsed.ok) return parsed.response;
  const { id, skill, changeNote } = parsed.value;
  if (typeof id !== "string" || !skill || typeof skill !== "object" || typeof changeNote !== "string" || !changeNote.trim()) {
    return Response.json({ error: { code: "INVALID_INPUT", message: "缺少有效的 id、skill 或 changeNote。" } }, { status: 400 });
  }
  const value = skill as Partial<SkillConfig>;
  const tools = await getTools();
  const toolIds = new Set(tools.map((item) => item.id));
  const valid = typeof value.name === "string" && value.name.trim() && typeof value.description === "string" &&
    typeof value.enabled === "boolean" && typeof value.model === "string" && Number.isInteger(value.version) &&
    Number(value.version) >= 1 && Number.isFinite(value.temperature) &&
    Number(value.temperature) >= 0 && Number(value.temperature) <= 2 && Number.isInteger(value.maxTokens) &&
    Number(value.maxTokens) >= 64 && Number(value.maxTokens) <= 128000 && Array.isArray(value.dependencyTools) &&
    value.dependencyTools.every((item) => typeof item === "string" && toolIds.has(item)) && typeof value.prompt === "string" && value.prompt.trim();
  if (!valid) return Response.json({ error: { code: "SKILL_VALIDATION_FAILED", message: "Skill 配置不合法：请检查温度、Token 上限、Prompt 和依赖 Tool。" } }, { status: 422 });
  try {
    const saved = await saveSkill(id, {
      name: value.name!.trim(), description: value.description!, enabled: value.enabled!, model: value.model!,
      temperature: Number(value.temperature), maxTokens: Number(value.maxTokens), dependencyTools: [...value.dependencyTools!], prompt: value.prompt!,
    }, changeNote.trim(), value.version);
    return Response.json({ skill: saved, message: `已保存 v${saved.version}，旧版本已快照。` });
  } catch (error) {
    if (error instanceof SkillVersionConflictError) {
      return Response.json({ error: { code: "SKILL_VERSION_CONFLICT", message: error.message, currentVersion: error.currentVersion } }, { status: 409 });
    }
    return Response.json({ error: { code: "SKILL_SAVE_FAILED", message: error instanceof Error ? error.message : String(error), oldVersionPreserved: true } }, { status: 500 });
  }
}
