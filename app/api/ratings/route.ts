import { getRun } from "@/lib/agent/store";
import { improvementFor, listImprovements, listRatings, saveImprovement, saveRating } from "@/lib/ops/store";
import type { IssueType, Rating } from "@/lib/ops/types";
import { parseJsonBody } from "@/lib/http";

const issues = new Set<IssueType>(["correctness", "relevance", "completeness", "safety", "tone", "other"]);
export async function GET(request: Request) {
  const url = new URL(request.url); const score = Number(url.searchParams.get("score")); const issueType = url.searchParams.get("issueType"); const from = url.searchParams.get("from"); const to = url.searchParams.get("to");
  const values = (await listRatings()).filter((item) => (!score || item.score === score) && (!issueType || item.issueType === issueType) && (!from || item.createdAt >= from) && (!to || item.createdAt <= to));
  return Response.json({ ratings: values });
}
export async function POST(request: Request) {
  const parsed = await parseJsonBody<{ runId?: unknown; score?: unknown; issueType?: unknown; feedback?: unknown }>(request); if (!parsed.ok) return parsed.response;
  const { runId, score, issueType = "other", feedback = "" } = parsed.value;
  if (typeof runId !== "string" || !Number.isInteger(score) || Number(score) < 1 || Number(score) > 5 || typeof issueType !== "string" || !issues.has(issueType as IssueType) || typeof feedback !== "string") return Response.json({ error: { code: "INVALID_RATING", message: "runId、1-5 分评分和有效问题类型为必填项。" } }, { status: 400 });
  const run = await getRun(runId); if (!run) return Response.json({ error: { code: "RUN_NOT_FOUND", message: "运行记录不存在。" } }, { status: 404 });
  const rating: Rating = { id: crypto.randomUUID(), runId, score: Number(score), issueType: issueType as IssueType, feedback, question: run.question, answer: run.finalReply, createdAt: new Date().toISOString() };
  await saveRating(rating); let improvement = null;
  if (rating.score <= 2) { const existing = (await listImprovements()).find((item) => item.source === "low-rating" && item.sourceId === rating.id); improvement = existing ?? improvementFor("low-rating", rating.id, runId, rating.issueType); if (!existing) await saveImprovement(improvement); }
  return Response.json({ rating, improvement }, { status: 201 });
}
