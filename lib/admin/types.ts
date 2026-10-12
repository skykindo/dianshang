import type { ProviderName } from "@/lib/agent/types";

export interface SkillConfig {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  model: string;
  temperature: number;
  maxTokens: number;
  dependencyTools: string[];
  prompt: string;
  version: number;
  updatedAt: string;
}

export interface SkillVersion {
  skillId: string;
  version: number;
  snapshot: SkillConfig;
  changeNote: string;
  createdAt: string;
  current?: boolean;
}

export interface ToolConfig {
  id: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputExample: unknown;
  enabled: boolean;
  version: string;
}

export interface PlannerConfig {
  version: number;
  prompt: string;
  enabledSkills: string[];
  enabledTools: string[];
  mandatoryCapabilities: string[];
  toolGroups: {
    base: string[];
    pricing: string[];
  };
  model: string;
  temperature: number;
  maxTokens: number;
  updatedAt: string;
}

export interface LlmConfig {
  provider: ProviderName;
  defaultModel: string;
  models: Record<ProviderName, string[]>;
  updatedAt: string;
}

export interface PublicLlmConfig extends LlmConfig {
  descriptions: Record<ProviderName, string>;
  environment: {
    coze: { apiKey: boolean; model: boolean; baseUrl: boolean; ready: boolean };
    deepseek: { apiKey: boolean; baseUrl: boolean; model: boolean; ready: boolean };
  };
  modeLabel: string;
}
