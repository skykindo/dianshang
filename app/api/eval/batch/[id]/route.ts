import { getEvalBatch } from "@/lib/eval/store";
export async function GET(_request:Request,context:{params:Promise<{id:string}>}){const {id}=await context.params;const batch=await getEvalBatch(id);return batch?Response.json({batch}):Response.json({error:{code:"EVAL_BATCH_NOT_FOUND",message:"评测批次不存在。",batchId:id}},{status:404});}
