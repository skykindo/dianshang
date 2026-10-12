import { getSkillVersions, getSkills, saveSkill } from "@/lib/admin/store";
import { parseJsonBody } from "@/lib/http";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const versions = await getSkillVersions(id);
  return versions.length ? Response.json({ versions }) : Response.json({ error: { code: "SKILL_NOT_FOUND", message: "Skill 不存在。" } }, { status: 404 });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params; const parsed = await parseJsonBody<{ version?: unknown; confirm?: unknown }>(request); if (!parsed.ok) return parsed.response;
  if (!Number.isInteger(parsed.value.version) || parsed.value.confirm !== true) return Response.json({ error: { code: "CONFIRMATION_REQUIRED", message: "有效 version 和 confirm=true 为必填项。" } }, { status: 400 });
  const target = (await getSkillVersions(id)).find((item) => item.version === parsed.value.version && !item.current); const current = (await getSkills()).find((item) => item.id === id);
  if (!target || !current) return Response.json({ error: { code: "VERSION_NOT_FOUND", message: "目标版本不存在或已是当前版本。" } }, { status: 404 });
  const value = target.snapshot; const saved = await saveSkill(id, { name: value.name, description: value.description, enabled: value.enabled, model: value.model, temperature: value.temperature, maxTokens: value.maxTokens, dependencyTools: value.dependencyTools, prompt: value.prompt }, `回滚到 v${target.version}`, current.version);
  return Response.json({ skill: saved, restoredFrom: target.version, snapshotCreated: true, message: `已保存当前 v${current.version} 快照，并从 v${target.version} 恢复正文。` });
}
