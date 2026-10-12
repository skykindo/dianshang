export type ProviderName = "coze" | "deepseek" | "classroom-fixture";
export type RunStatus = "RUNNING" | "SUCCESS" | "ERROR" | "HANDOFF";
export type StepType = "planner" | "validator" | "skill" | "tool" | "score" | "llm" | "risk-check";
export type StepStatus = "RUNNING" | "SUCCESS" | "ERROR" | "BLOCKED";

export type ConversationMessage = { role: "user" | "assistant"; content: string };
export type Capability = { id: string; name: string; version: string; enabled: boolean };

export interface AgentPlan {
  selectedSkills: string[];
  selectedTools: string[];
  reasoning: string;
  mandatoryCapabilities: string[];
  risk: { level: "low" | "medium" | "high"; reasons: string[]; action: "continue" | "degrade" | "handoff" };
}

export interface PlanValidation {
  valid: boolean;
  blocked: boolean;
  errors: string[];
  warnings: string[];
}

export interface RunStep {
  stepId: string;
  type: StepType;
  capabilityId?: string;
  input: unknown;
  output?: unknown;
  startedAt: string;
  durationMs: number;
  status: StepStatus;
  error?: string;
}

export interface RiskResult {
  level: "low" | "medium" | "high";
  blocked: boolean;
  categories: string[];
  message: string;
}

export interface ExecutionScore {
  score: number;
  grade: "ready" | "incomplete" | "unsafe";
  findings: string[];
  coveredCapabilities: string[];
}

export interface RunExecutionConfig {
  conversationHistory: ConversationMessage[];
  enabledSkills: string[];
  enabledTools: string[];
  mandatoryCapabilities: string[];
  simulateToolFailure?: string;
}

export interface RunRecord {
  id: string;
  question: string;
  source: string;
  conversationId: string;
  createdAt: string;
  status: RunStatus;
  finalReply: string;
  plan: AgentPlan | null;
  steps: RunStep[];
  riskResult: RiskResult | null;
  durationMs: number;
  error: string | null;
  provider: ProviderName;
  model: string;
  skillVersions: Record<string, string>;
  toolVersions: Record<string, string>;
  executionConfig: RunExecutionConfig;
  annotation?: string;
  handoffAt?: string;
  retryOf?: string;
}

export interface RunRequest {
  userInput: string;
  conversationHistory?: ConversationMessage[];
  conversationId?: string;
  source?: string;
  provider?: ProviderName;
  enabledSkills?: string[];
  enabledTools?: string[];
  mandatoryCapabilities?: string[];
  simulateToolFailure?: string;
  retryOf?: string;
}

export type AgentEvent =
  | { type: "run"; run: RunRecord }
  | { type: "step"; runId: string; step: RunStep }
  | { type: "final"; runId: string; reply: string; riskResult: RiskResult | null }
  | { type: "error"; runId: string; error: string; code?: string }
  | { type: "complete"; runId: string; status: RunStatus };
