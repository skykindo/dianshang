import { listRuns } from "@/lib/agent/store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 20) || 20));
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);
  const runs = await listRuns(limit, offset);
  return Response.json({ runs, limit, offset, nextOffset: runs.length === limit ? offset + limit : null });
}
