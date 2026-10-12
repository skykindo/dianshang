import type { EvalCase, EvalDifficulty, EvalRiskLevel, KeywordGroup } from "./types";

const difficulties = new Set<EvalDifficulty>(["easy","medium","hard"]); const risks = new Set<EvalRiskLevel>(["low","medium","high"]);
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string");
function keywords(value: unknown): value is KeywordGroup[] { return Array.isArray(value) && value.every((group) => !!group && typeof group === "object" && ["AND","OR"].includes(String((group as KeywordGroup).operator)) && strings((group as KeywordGroup).keywords) && (group as KeywordGroup).keywords.length > 0); }
export function validateEvalCase(value: unknown): { ok:true; value: Omit<EvalCase,"id"|"createdAt"|"updatedAt"> } | { ok:false; message:string } {
  if (!value || typeof value !== "object") return {ok:false,message:"请求体必须是对象。"}; const v=value as Record<string,unknown>;
  const requiredStrings=["name","question","scenario","category","expectedBehavior"] as const; if(requiredStrings.some((key)=>typeof v[key]!=="string"||!String(v[key]).trim())) return {ok:false,message:"name、question、scenario、category、expectedBehavior 不能为空。"};
  if(!difficulties.has(v.difficulty as EvalDifficulty)||!risks.has(v.riskLevel as EvalRiskLevel)) return {ok:false,message:"difficulty 或 riskLevel 无效。"};
  if(!keywords(v.expectedKeywords)||!strings(v.forbiddenWords)||!strings(v.requiredCapabilities)||!strings(v.forbiddenCapabilities)||!strings(v.evalDimension)||!strings(v.tags)) return {ok:false,message:"关键词、禁词、能力、维度和标签字段格式不正确。"};
  if(v.expectedPrice!==null&&(typeof v.expectedPrice!=="number"||!Number.isFinite(v.expectedPrice)||v.expectedPrice<0)) return {ok:false,message:"expectedPrice 必须是非负数或 null。"};
  if(typeof v.expectedInputRisk!=="boolean"||typeof v.expectedReplySafe!=="boolean"||typeof v.expectedShouldSend!=="boolean"||typeof v.enabled!=="boolean") return {ok:false,message:"风险期望和 enabled 必须是布尔值。"};
  if(v.expectedReply!==undefined&&typeof v.expectedReply!=="string"||v.llmJudgePrompt!==undefined&&typeof v.llmJudgePrompt!=="string"||v.sourceRunId!==undefined&&v.sourceRunId!==null&&typeof v.sourceRunId!=="string") return {ok:false,message:"回复、Judge Prompt 或 sourceRunId 格式不正确。"};
  return { ok:true, value:{
    name:String(v.name).trim(), question:String(v.question).trim(), scenario:String(v.scenario).trim(), category:String(v.category).trim(),
    difficulty:v.difficulty as EvalDifficulty, riskLevel:v.riskLevel as EvalRiskLevel, expectedBehavior:String(v.expectedBehavior).trim(),
    expectedReply:String(v.expectedReply??""), expectedKeywords:v.expectedKeywords, forbiddenWords:v.forbiddenWords,
    expectedPrice:v.expectedPrice as number|null, expectedInputRisk:v.expectedInputRisk, expectedReplySafe:v.expectedReplySafe,
    expectedShouldSend:v.expectedShouldSend, expectRiskPassed:typeof v.expectRiskPassed==="boolean"?v.expectRiskPassed:undefined,
    requiredCapabilities:v.requiredCapabilities, forbiddenCapabilities:v.forbiddenCapabilities, evalDimension:v.evalDimension,
    llmJudgePrompt:String(v.llmJudgePrompt??""), tags:v.tags, sourceRunId:(v.sourceRunId??null) as string|null, enabled:v.enabled,
  } };
}
