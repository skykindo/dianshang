import { buildPlannerSystemPrompt, createPlan } from "@/lib/agent/planner";
import { createProvider } from "@/lib/agent/provider";
import { inferMandatoryCapabilities } from "@/lib/agent/catalog";
import { validatePlan } from "@/lib/agent/validator";
import { getLlmConfig, getPlannerConfig, getSkills, getTools } from "@/lib/admin/store";
import { AgentError } from "@/lib/agent/errors";
import { parseJsonBody } from "@/lib/http";

export async function POST(request: Request) {
  const parsed = await parseJsonBody<{ question?: unknown }>(request);
  if (!parsed.ok) return parsed.response;
  if (typeof parsed.value.question !== "string" || !parsed.value.question.trim()) return Response.json({ error: { code: "INVALID_INPUT", message: "question 必须是非空字符串。" } }, { status: 400 });
  const question = parsed.value.question.trim();
  try {
    const [config, skillConfigs, toolConfigs, llm] = await Promise.all([getPlannerConfig(), getSkills(), getTools(), getLlmConfig()]);
    const provider = await createProvider(undefined, config.model === "inherit" ? llm : { ...llm, defaultModel: config.model });
    const skills = skillConfigs.map((item) => ({ id: item.id, name: item.name, version: String(item.version), enabled: item.enabled && config.enabledSkills.includes(item.id) }));
    const tools = toolConfigs.map((item) => ({ id: item.id, name: item.name, version: item.version, enabled: item.enabled && config.enabledTools.includes(item.id) }));
    const availableSkills = skills.filter((item) => item.enabled);
    const availableTools = tools.filter((item) => item.enabled);
    const mandatoryCapabilities = [...new Set(["risk-check", ...config.mandatoryCapabilities, ...inferMandatoryCapabilities(question)])];
    const planned = await createPlan(provider, { userInput: question, conversationHistory: [], availableSkills, availableTools, mandatoryCapabilities, plannerPrompt: config.prompt, temperature: config.temperature, maxTokens: config.maxTokens });
    const validation = validatePlan({ plan: planned.plan, question, skills: availableSkills, tools: availableTools, mandatoryCapabilities, parseError: planned.parseError });
    const availableSkillLines = availableSkills.map((item) => `- [skill] ${item.id}: ${item.name}`).join("\n") || "- 无";
    const availableToolLines = availableTools.map((item) => `- [tool] ${item.id}: ${item.name}`).join("\n") || "- 无";
    const systemPrompt = `${buildPlannerSystemPrompt(config.prompt)}\n\n【可用 Skills】\n${availableSkillLines}\n\n【可用 Tools】\n${availableToolLines}\n\n【必经能力】\n${mandatoryCapabilities.join("\n")}\n\n【用户问题】\n${question}`;
    return Response.json({ provider: provider.name, model: provider.model, plan: planned.plan, validation, workspace: {
      availableSkills: availableSkills.map((item) => ({ id: item.id, name: item.name })),
      availableTools: availableTools.map((item) => ({ id: item.id, name: item.name })),
      mandatoryCapabilities,
      riskEnabled: availableTools.some((item) => item.id === "risk-check"),
      systemPrompt,
    } });
  } catch (error) {
    const code = error instanceof AgentError ? error.code : "PLANNER_PREVIEW_FAILED";
    const status = error instanceof AgentError ? error.status : 500;
    return Response.json({ error: { code, message: error instanceof Error ? error.message : String(error) } }, { status });
  }
}
