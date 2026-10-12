import { getSkills, saveSkill } from "@/lib/admin/store";
import { getImprovement, saveImprovement } from "@/lib/ops/store";
import { parseJsonBody } from "@/lib/http";

export async function POST(request: Request) {
  const parsed = await parseJsonBody<{ improvementId?: unknown; confirm?: unknown }>(request); if (!parsed.ok) return parsed.response;
  if (typeof parsed.value.improvementId !== "string" || parsed.value.confirm !== true) return Response.json({ error: { code: "CONFIRMATION_REQUIRED", message: "必须明确 confirm=true 才能应用 Prompt。" } }, { status: 400 });
  const improvement = await getImprovement(parsed.value.improvementId); if (!improvement?.skillId || !improvement.proposalPrompt || !improvement.baseVersion) return Response.json({ error: { code: "DRAFT_NOT_FOUND", message: "请先生成 Prompt 草案。" } }, { status: 409 });
  const skill = (await getSkills()).find((item) => item.id === improvement.skillId); if (!skill) return Response.json({ error: { code: "SKILL_NOT_FOUND", message: "Skill 不存在。" } }, { status: 404 });
  if (skill.version !== improvement.baseVersion) return Response.json({ error: { code: "VERSION_CONFLICT", message: "生产 Skill 已变化，请重新生成草案后再应用。" } }, { status: 409 });
  const saved = await saveSkill(skill.id, { name: skill.name, description: skill.description, enabled: skill.enabled, model: skill.model, temperature: skill.temperature, maxTokens: skill.maxTokens, dependencyTools: skill.dependencyTools, prompt: improvement.proposalPrompt }, `运营改进 ${improvement.id}：${improvement.title}`, skill.version);
  const next = { ...improvement, status: "applied" as const, appliedVersion: saved.version, updatedAt: new Date().toISOString() }; await saveImprovement(next);
  return Response.json({ improvement: next, skill: saved, snapshotCreated: true, message: `已快照 v${skill.version} 并应用为 v${saved.version}。` });
}
