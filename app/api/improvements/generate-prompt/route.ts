import { getSkills } from "@/lib/admin/store";
import { getImprovement, saveImprovement } from "@/lib/ops/store";
import { parseJsonBody } from "@/lib/http";

export async function POST(request: Request) {
  const parsed = await parseJsonBody<{ improvementId?: unknown; skillId?: unknown }>(request); if (!parsed.ok) return parsed.response;
  const { improvementId, skillId } = parsed.value; if (typeof improvementId !== "string" || typeof skillId !== "string") return Response.json({ error: { code: "INVALID_INPUT", message: "improvementId 和 skillId 为必填项。" } }, { status: 400 });
  const improvement = await getImprovement(improvementId); const skill = (await getSkills()).find((item) => item.id === skillId);
  if (!improvement || !skill) return Response.json({ error: { code: "NOT_FOUND", message: "改进项或 Skill 不存在。" } }, { status: 404 });
  const rule = `\n\n【运营改进规则】\n- 针对 ${improvement.issueType} 问题：${improvement.suggestion}\n- 回答前检查信息依据；无法确认时明确说明并转人工。\n- 本规则对应样本 Run：${improvement.runId}`;
  const draftPrompt = `${skill.prompt.trim()}${rule}`; const now = new Date().toISOString();
  const next = { ...improvement, status: "drafted" as const, skillId, proposalPrompt: draftPrompt, baseVersion: skill.version, updatedAt: now }; await saveImprovement(next);
  return Response.json({ proposal: next, currentPrompt: skill.prompt, draftPrompt, diff: { removed: [], added: rule.trim().split("\n") }, applied: false, warning: "草案尚未应用，生产 Prompt 未被修改。", generator: "deterministic-rules" });
}
