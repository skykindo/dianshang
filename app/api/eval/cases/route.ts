import { getRun } from "@/lib/agent/store";
import { getEvalCase, saveEvalCase } from "@/lib/eval/store";
import { validateEvalCase } from "@/lib/eval/validation";
import { parseJsonBody } from "@/lib/http";

export async function POST(request: Request) {
  const parsed=await parseJsonBody<Record<string,unknown>>(request); if(!parsed.ok)return parsed.response; let candidate:unknown=parsed.value;
  if(typeof parsed.value.copyFromId==="string") { const source=await getEvalCase(parsed.value.copyFromId); if(!source)return Response.json({error:{code:"EVAL_CASE_NOT_FOUND",message:"待复制用例不存在。"}},{status:404}); candidate={...source,name:`${source.name}（副本）`,sourceRunId:source.sourceRunId}; }
  else if(typeof parsed.value.sourceRunId==="string" && Object.keys(parsed.value).length===1) { const run=await getRun(parsed.value.sourceRunId); if(!run)return Response.json({error:{code:"RUN_NOT_FOUND",message:"运行记录不存在。"}},{status:404}); candidate={name:`来自 Run：${run.question.slice(0,30)}`,question:run.question,scenario:"运行沉淀",category:"Run 导入",difficulty:"medium",riskLevel:run.riskResult?.level??"low",expectedBehavior:"复现该 Run，并由运营补充期望。",expectedReply:"",expectedKeywords:[{operator:"OR",keywords:["请","建议"]}],forbiddenWords:[],expectedPrice:null,expectedInputRisk:(run.riskResult?.categories.length??0)>0,expectedReplySafe:true,expectedShouldSend:true,requiredCapabilities:run.steps.filter((step)=>step.status==="SUCCESS"&&step.capabilityId).map((step)=>step.capabilityId!),forbiddenCapabilities:[],evalDimension:["regression"],llmJudgePrompt:"",tags:["Run 导入"],sourceRunId:run.id,enabled:true}; }
  const validated=validateEvalCase(candidate); if(!validated.ok)return Response.json({error:{code:"INVALID_EVAL_CASE",message:validated.message}},{status:422}); const now=new Date().toISOString(); const item={...validated.value,id:crypto.randomUUID(),createdAt:now,updatedAt:now}; await saveEvalCase(item); return Response.json({case:item},{status:201});
}
