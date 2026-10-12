import { getRun } from "@/lib/agent/store";
import { improvementFor, listAnnotations, saveAnnotation, saveImprovement } from "@/lib/ops/store";
import type { Annotation, AnnotationDimensions, AnnotationStatus, IssueType } from "@/lib/ops/types";
import { parseJsonBody } from "@/lib/http";

const statuses = new Set<AnnotationStatus>(["pending", "accepted", "rejected"]); const issues = new Set<IssueType>(["correctness", "relevance", "completeness", "safety", "tone", "other"]);
function validDimensions(value: unknown): value is AnnotationDimensions { return !!value && typeof value === "object" && ["correctness", "relevance", "completeness", "safety", "tone", "overall"].every((key) => Number.isInteger((value as Record<string, unknown>)[key]) && Number((value as Record<string, unknown>)[key]) >= 1 && Number((value as Record<string, unknown>)[key]) <= 5); }
export async function GET(request: Request) { const url = new URL(request.url); const status = url.searchParams.get("status"); const issue = url.searchParams.get("issueType"); return Response.json({ annotations: (await listAnnotations()).filter((item) => (!status || item.status === status) && (!issue || item.issueType === issue)) }); }
export async function POST(request: Request) {
  const parsed = await parseJsonBody<Record<string, unknown>>(request); if (!parsed.ok) return parsed.response; const value = parsed.value;
  if (typeof value.runId !== "string" || (value.target !== "run" && value.target !== "reply") || typeof value.status !== "string" || !statuses.has(value.status as AnnotationStatus) || typeof value.issueType !== "string" || !issues.has(value.issueType as IssueType) || !validDimensions(value.dimensions) || typeof value.annotator !== "string" || !value.annotator.trim() || typeof value.note !== "string") return Response.json({ error: { code: "INVALID_ANNOTATION", message: "标注目标、状态、六个 1-5 分维度及标注人为必填项。" } }, { status: 400 });
  const run = await getRun(value.runId); if (!run) return Response.json({ error: { code: "RUN_NOT_FOUND", message: "运行记录不存在。" } }, { status: 404 }); const now = new Date().toISOString();
  const annotation: Annotation = { id: crypto.randomUUID(), runId: value.runId, target: value.target, status: value.status as AnnotationStatus, issueType: value.issueType as IssueType, dimensions: value.dimensions, annotator: value.annotator.trim(), note: value.note, question: run.question, answer: run.finalReply, createdAt: now, updatedAt: now };
  await saveAnnotation(annotation); let improvement = null; if (annotation.dimensions.overall <= 2) { improvement = improvementFor("low-annotation", annotation.id, annotation.runId, annotation.issueType); await saveImprovement(improvement); }
  return Response.json({ annotation, improvement }, { status: 201 });
}
