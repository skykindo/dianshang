import assert from "node:assert/strict";
import test from "node:test";
import { createPlan, normalizePlan } from "../lib/agent/planner.ts";

test("planner normalizes DeepSeek-compatible risk aliases without bypassing required capabilities", () => {
  const plan = normalizePlan({
    selectedSkills: ["product-recommendation"],
    selectedTools: ["catalog-search", "risk-check"],
    risk: { action: "proceed", checkRequired: true, reason: "Benign recommendation with mandatory risk check." },
    executionPlan: [{ step: 1, tool: "risk-check" }],
  }, ["risk-check"]);
  assert.ok(plan);
  assert.equal(plan.risk.action, "continue");
  assert.equal(plan.risk.level, "low");
  assert.deepEqual(plan.risk.reasons, ["Benign recommendation with mandatory risk check."]);
  assert.deepEqual(plan.mandatoryCapabilities, ["risk-check"]);
  assert.ok(plan.selectedTools.includes("risk-check"));
});

test("planner normalization still rejects malformed capability lists and unknown actions", () => {
  assert.equal(normalizePlan({ selectedSkills: "all", selectedTools: [], risk: { action: "continue" } }, ["risk-check"]), null);
  assert.equal(normalizePlan({ selectedSkills: [], selectedTools: [], risk: { action: "invent" } }, ["risk-check"]), null);
});

test("普通商品问题会移除模型误选的安全回复 Skill", async () => {
  const provider = { generate: async () => JSON.stringify({
    selectedSkills: ["product-recommendation", "safety-response"],
    selectedTools: ["catalog-search", "risk-check"],
    reasoning: "商品推荐",
    mandatoryCapabilities: ["risk-check"],
    risk: { level: "low", reasons: [], action: "continue" },
  }) };
  const { plan } = await createPlan(provider, {
    userInput: "推荐办公室吃的坚果",
    conversationHistory: [],
    availableSkills: [],
    availableTools: [],
    mandatoryCapabilities: ["risk-check"],
  });
  assert.deepEqual(plan.selectedSkills, ["product-recommendation"]);
});
