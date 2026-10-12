import { getAnnotation, improvementFor, listImprovements, saveAnnotation, saveImprovement } from "@/lib/ops/store";
import type { AnnotationDimensions, AnnotationStatus, IssueType } from "@/lib/ops/types";
import { parseJsonBody } from "@/lib/http";

const statuses = new Set<AnnotationStatus>(["pending", "accepted", "rejected"]);
const issues = new Set<IssueType>(["correctness", "relevance", "completeness", "safety", "tone", "other"]);
function validDimensions(value: unknown): value is AnnotationDimensions {
  return !!value && typeof value === "object" && ["correctness", "relevance", "completeness", "safety", "tone", "overall"].every((key) => {
    const score = (value as Record<string, unknown>)[key];
    return Number.isInteger(score) && Number(score) >= 1 && Number(score) <= 5;
  });
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const item = await getAnnotation((await context.params).id);
  return item ? Response.json({ annotation: item }) : Response.json({ error: { code: "ANNOTATION_NOT_FOUND", message: "标注不存在。" } }, { status: 404 });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const item = await getAnnotation((await context.params).id);
  if (!item) return Response.json({ error: { code: "ANNOTATION_NOT_FOUND", message: "标注不存在。" } }, { status: 404 });
  const parsed = await parseJsonBody<Record<string, unknown>>(request); if (!parsed.ok) return parsed.response;
  const value = parsed.value;
  if (value.status !== undefined && (typeof value.status !== "string" || !statuses.has(value.status as AnnotationStatus))) return Response.json({ error: { code: "INVALID_STATUS", message: "无效标注状态。" } }, { status: 400 });
  if (value.target !== undefined && value.target !== "run" && value.target !== "reply") return Response.json({ error: { code: "INVALID_TARGET", message: "标注目标只能是 run 或 reply。" } }, { status: 400 });
  if (value.issueType !== undefined && (typeof value.issueType !== "string" || !issues.has(value.issueType as IssueType))) return Response.json({ error: { code: "INVALID_ISSUE_TYPE", message: "无效问题类型。" } }, { status: 400 });
  if (value.dimensions !== undefined && !validDimensions(value.dimensions)) return Response.json({ error: { code: "INVALID_DIMENSIONS", message: "六个评分维度必须是 1-5 的整数。" } }, { status: 400 });
  if (value.annotator !== undefined && (typeof value.annotator !== "string" || !value.annotator.trim())) return Response.json({ error: { code: "INVALID_ANNOTATOR", message: "标注人不能为空。" } }, { status: 400 });
  if (value.note !== undefined && typeof value.note !== "string") return Response.json({ error: { code: "INVALID_NOTE", message: "备注必须是字符串。" } }, { status: 400 });
  const next = { ...item, status: (value.status ?? item.status) as AnnotationStatus, target: (value.target ?? item.target) as "run" | "reply", issueType: (value.issueType ?? item.issueType) as IssueType, dimensions: (value.dimensions ?? item.dimensions) as AnnotationDimensions, annotator: typeof value.annotator === "string" ? value.annotator.trim() : item.annotator, note: typeof value.note === "string" ? value.note : item.note, updatedAt: new Date().toISOString() };
  await saveAnnotation(next);
  let improvement = null;
  if (next.dimensions.overall <= 2) {
    const existing = (await listImprovements()).find((entry) => entry.source === "low-annotation" && entry.sourceId === next.id);
    improvement = existing ?? improvementFor("low-annotation", next.id, next.runId, next.issueType);
    if (!existing) await saveImprovement(improvement);
  }
  return Response.json({ annotation: next, improvement });
}
