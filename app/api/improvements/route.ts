import { listImprovements } from "@/lib/ops/store";
export async function GET() { return Response.json({ improvements: await listImprovements(), clustering: { method: "deterministic-rules", label: "规则聚类" } }); }
