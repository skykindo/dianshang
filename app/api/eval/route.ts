import { getSkills, getTools } from "@/lib/admin/store";
import { listEvalBatches, listEvalCases } from "@/lib/eval/store";

export async function GET(request: Request) {
  const url = new URL(request.url); const includeDisabled = url.searchParams.get("includeDisabled") === "1" || url.searchParams.get("includeDisabled") === "true";
  const category=url.searchParams.get("category"); const difficulty=url.searchParams.get("difficulty"); const risk=url.searchParams.get("riskLevel"); const dimension=url.searchParams.get("evalDimension");
  const all = await listEvalCases(); const cases = all.filter((item)=>(includeDisabled||item.enabled)&&(!category||item.category===category)&&(!difficulty||item.difficulty===difficulty)&&(!risk||item.riskLevel===risk)&&(!dimension||item.evalDimension.includes(dimension)));
  const [batches,skills,tools]=await Promise.all([listEvalBatches(),getSkills(),getTools()]);
  return Response.json({ cases, enabledCases: all.filter((item)=>item.enabled), batches, skills, tools });
}
