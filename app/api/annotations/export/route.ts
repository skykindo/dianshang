import { listAnnotations } from "@/lib/ops/store";
function csv(value: unknown) {
  let text = String(value ?? "");
  // Excel and similar clients evaluate formula-looking cells even when quoted.
  if (/^[=+\-@]/.test(text.trimStart())) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export async function GET() { const rows = await listAnnotations(); const header = ["id","run_id","target","status","issue_type","correctness","relevance","completeness","safety","tone","overall","annotator","note","question","answer","created_at","updated_at"]; const body = rows.map((item) => [item.id,item.runId,item.target,item.status,item.issueType,item.dimensions.correctness,item.dimensions.relevance,item.dimensions.completeness,item.dimensions.safety,item.dimensions.tone,item.dimensions.overall,item.annotator,item.note,item.question,item.answer,item.createdAt,item.updatedAt].map(csv).join(",")); return new Response(`\uFEFF${[header.join(","), ...body].join("\r\n")}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="snackops-annotations-${new Date().toISOString().slice(0,10)}.csv"` } }); }
