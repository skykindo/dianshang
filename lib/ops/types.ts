export type AnnotationStatus = "pending" | "accepted" | "rejected";
export type IssueType = "correctness" | "relevance" | "completeness" | "safety" | "tone" | "other";

export interface Rating {
  id: string; runId: string; score: number; issueType: IssueType; feedback: string;
  question: string; answer: string; createdAt: string;
}
export interface AnnotationDimensions { correctness: number; relevance: number; completeness: number; safety: number; tone: number; overall: number; }
export interface Annotation {
  id: string; runId: string; target: "run" | "reply"; status: AnnotationStatus; issueType: IssueType;
  dimensions: AnnotationDimensions; annotator: string; note: string; question: string; answer: string;
  createdAt: string; updatedAt: string;
}
export type ImprovementDirection = "Planner" | "Skill" | "Tool" | "Eval";
export interface Improvement {
  id: string; source: "low-rating" | "low-annotation" | "bad-case" | "manual"; sourceId: string; runId: string;
  issueType: IssueType; direction: ImprovementDirection; title: string; suggestion: string; clusterLabel: string;
  status: "open" | "drafted" | "applied" | "dismissed"; skillId?: string; proposalPrompt?: string;
  baseVersion?: number; appliedVersion?: number; createdAt: string; updatedAt: string;
}
export interface AbTest {
  id: string; name: string; skillId: string; versionA: number; versionB: number; trafficPercent: number;
  status: "draft" | "running" | "paused" | "completed"; createdAt: string; updatedAt: string;
}
