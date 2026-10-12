import type { RunRecord } from "@/lib/agent/types";

export type EvalDifficulty = "easy" | "medium" | "hard";
export type EvalRiskLevel = "low" | "medium" | "high";
export type EvalStatus = "PASS" | "FAIL" | "REVIEW" | "ERROR";
export type KeywordGroup = { operator: "AND" | "OR"; keywords: string[] };

export interface EvalCase {
  id: string;
  name: string;
  question: string;
  scenario: string;
  category: string;
  difficulty: EvalDifficulty;
  riskLevel: EvalRiskLevel;
  expectedBehavior: string;
  expectedReply: string;
  expectedKeywords: KeywordGroup[];
  forbiddenWords: string[];
  expectedPrice: number | null;
  expectedInputRisk: boolean;
  expectedReplySafe: boolean;
  expectedShouldSend: boolean;
  expectRiskPassed?: boolean;
  requiredCapabilities: string[];
  forbiddenCapabilities: string[];
  evalDimension: string[];
  llmJudgePrompt: string;
  tags: string[];
  sourceRunId: string | null;
  createdAt: string;
  updatedAt: string;
  enabled: boolean;
}

export interface EvalResult {
  caseId: string;
  caseName: string;
  question: string;
  actualReply: string;
  status: EvalStatus;
  passed: boolean;
  reason: string;
  evidence: string[];
  keywordHits: string[];
  keywordMisses: string[];
  forbiddenHits: string[];
  expectedPrice: number | null;
  mentionedPrice: number[];
  riskIssues: string[];
  capabilityHits: string[];
  capabilityMisses: string[];
  durationMs: number;
  runId: string;
  traceUrl: string;
  capabilityPath: string[];
}

export type EvalBatchStatus = "queued" | "running" | "done" | "error" | "cancelled";

export interface EvalBatch {
  id: string;
  name: string;
  versionLabel: string;
  changeNote: string;
  caseIds: string[];
  caseSnapshot: EvalCase[];
  caseSetHash: string;
  skillVersion: string;
  skillHash: string;
  evaluatorVersion: string;
  evaluatorHash: string;
  evaluationMethod: "rules";
  provider: string;
  model: string;
  params: Record<string, unknown>;
  results: EvalResult[];
  caseResults: EvalResult[];
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  status: EvalBatchStatus;
  currentIndex: number;
  total: number;
  passed: number;
  failed: number;
  review: number;
  errors: number;
  requestKey?: string;
  fatalError?: string;
}

export type EvalBatchComparison = {
  comparable: boolean;
  reasons: string[];
  fixed: string[];
  regressions: string[];
  changedReplies: string[];
  leftCounts: Record<EvalStatus, number>;
  rightCounts: Record<EvalStatus, number>;
  leftPassRate: number | null;
  rightPassRate: number | null;
  averageDurationDeltaMs: number;
  sameProvider: boolean;
  sameModel: boolean;
  sameParams: boolean;
  sameEvaluator: boolean;
};

export type EvalRunBundle = { run: RunRecord; result: EvalResult };
