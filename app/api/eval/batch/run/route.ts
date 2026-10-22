import { createEvalBatch, runEvalBatch } from "@/lib/eval/batch";
import { getEvalBatch, listEvalBatches, listEvalCases } from "@/lib/eval/store";
import { parseJsonBody } from "@/lib/http";
import { waitUntil } from "@vercel/functions";

type Body={name?:unknown;versionLabel?:unknown;changeNote?:unknown;caseIds?:unknown;baseBatchId?:unknown;requestKey?:unknown};
declare global { var __snackOpsEvalBatchRequests: Map<string,Promise<Awaited<ReturnType<typeof createEvalBatch>>>>|undefined; }
const requests=globalThis.__snackOpsEvalBatchRequests??=new Map();
export async function POST(request:Request){
  const parsed=await parseJsonBody<Body>(request);if(!parsed.ok)return parsed.response;const body=parsed.value;
  for(const key of ["name","versionLabel","changeNote","baseBatchId","requestKey"] as const)if(body[key]!==undefined&&typeof body[key]!=="string")return Response.json({error:{code:"INVALID_INPUT",message:`${key} 必须是字符串。`}},{status:400});
  if(body.caseIds!==undefined&&(!Array.isArray(body.caseIds)||body.caseIds.some(id=>typeof id!=="string")))return Response.json({error:{code:"INVALID_CASE_IDS",message:"caseIds 必须是字符串数组。"}},{status:400});
  if(Array.isArray(body.caseIds)&&body.caseIds.length===0)return Response.json({error:{code:"EMPTY_CASE_IDS",message:"caseIds 不能是空数组。"}},{status:400});
  if(body.requestKey){const pending=requests.get(body.requestKey as string);if(pending){const existing=await pending;return Response.json({batchId:existing.id,batch:existing,deduplicated:true},{status:200});}const existing=(await listEvalBatches()).find(batch=>batch.requestKey===body.requestKey);if(existing)return Response.json({batchId:existing.id,batch:existing,deduplicated:true},{status:200});}
  const all=await listEvalCases();let requested=body.caseIds as string[]|undefined;
  if(!requested&&body.baseBatchId){const base=await getEvalBatch(body.baseBatchId as string);if(!base)return Response.json({error:{code:"BASE_BATCH_NOT_FOUND",message:"基准批次不存在。"}},{status:404});requested=base.caseIds;}
  const ids=requested??all.filter(item=>item.enabled).map(item=>item.id);const unique=[...new Set(ids)];const byId=new Map(all.map(item=>[item.id,item]));const invalidIds=unique.filter(id=>!byId.has(id));
  if(invalidIds.length)return Response.json({error:{code:"INVALID_CASE_IDS",message:"部分 caseId 不存在。",invalidIds}},{status:400});
  const cases=unique.map(id=>byId.get(id)!);const creation=createEvalBatch({name:body.name as string|undefined,versionLabel:body.versionLabel as string|undefined,changeNote:body.changeNote as string|undefined,cases,requestKey:body.requestKey as string|undefined});if(body.requestKey){if(requests.size>100)requests.delete(requests.keys().next().value!);requests.set(body.requestKey as string,creation);}const batch=await creation;
  const execution=runEvalBatch(batch.id);try{waitUntil(execution);}catch{void execution;}return Response.json({batchId:batch.id,batch},{status:202});
}
