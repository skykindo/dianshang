import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function loadWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${Math.random()}`);
  return (await import(workerUrl.href)).default;
}

const runtimeEnv = {
  ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
};
const runtimeContext = { waitUntil() {}, passThroughOnException() {} };

async function request(worker, path, init) {
  return worker.fetch(new Request(`http://localhost${path}`, init), runtimeEnv, runtimeContext);
}

async function jsonRequest(worker, path, init) {
  const response = await request(worker, path, init);
  const body = await response.json();
  return { response, body };
}

test("server-renders the SnackOps workbench", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), runtimeEnv, runtimeContext);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>SnackOps Agent Workbench<\/title>/i);
  assert.match(html, /Agent 工作台/);
  assert.match(html, /Planner 选择能力/);
  assert.match(html, /classroom-fixture（明示演示）/);
  assert.doesNotMatch(html, /Building your site|Your site is taking shape/);
});

test("chat demo is a real conversation surface with a visible eval entry", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(new Request("http://localhost/demo", { headers: { accept: "text/html" } }), runtimeEnv, runtimeContext);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /客服聊天窗口/);
  assert.match(html, /想咨询什么/);
  assert.match(html, /打开评测用例集/);
  assert.match(html, /classroom-fixture/);
});

test("eval center exposes a saved content library and explicit multi-select batch flow", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(new Request("http://localhost/eval", { headers: { accept: "text/html" } }), runtimeEnv, runtimeContext);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /评测内容库/);
  assert.match(html, /录入评测内容/);
  assert.match(html, /从已保存内容中多选/);
  assert.match(html, /运行已选/);
});

test("agent route validates input and executor includes scoring", async () => {
  const [routeSource, executorSource, providerSource] = await Promise.all([
    readFile(new URL("../app/api/agent/run/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/agent/executor.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/agent/provider.ts", import.meta.url), "utf8"),
  ]);
  assert.match(routeSource, /validateRunRequest/);
  assert.match(routeSource, /INVALID_INPUT/);
  assert.match(routeSource, /cancel\(\)/);
  assert.match(executorSource, /addStep\("score"/);
  assert.match(executorSource, /scoreExecution/);
  assert.match(providerSource, /reportRenderers/);
  assert.match(providerSource, /fixtureGenerators\[options\.purpose\]/);
});

test("legacy chat route delegates to the unified executor", async () => {
  const chatSource = await readFile(new URL("../app/api/chat/route.ts", import.meta.url), "utf8");
  assert.match(chatSource, /executeAgentRun/);
  assert.doesNotMatch(chatSource, /workflow\/stream_run|api\.coze\.cn/);
  assert.match(chatSource, /runId: run\.id/);
  assert.match(chatSource, /riskResult: run\.riskResult/);
});

test("management APIs persist skill versions and execute a real server tool", async () => {
  const worker = await loadWorker();
  const initial = await jsonRequest(worker, "/api/skills");
  assert.equal(initial.response.status, 200);
  assert.equal(initial.body.skills.length, 15);
  const current = initial.body.skills.find((item) => item.id === "product-substitution");
  assert.ok(current);

  const saved = await jsonRequest(worker, "/api/skills", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: current.id,
      skill: { ...current, description: `${current.description}（已验证持久化）` },
      changeNote: "自动化验收：验证版本快照",
    }),
  });
  assert.equal(saved.response.status, 200);
  assert.equal(saved.body.skill.version, current.version + 1);

  const stale = await jsonRequest(worker, "/api/skills", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: current.id,
      skill: { ...current, description: "这个陈旧编辑不应覆盖新版本" },
      changeNote: "验证乐观锁",
    }),
  });
  assert.equal(stale.response.status, 409);
  assert.equal(stale.body.error.code, "SKILL_VERSION_CONFLICT");

  const refreshed = await jsonRequest(worker, "/api/skills");
  assert.equal(refreshed.body.skills.find((item) => item.id === current.id).version, current.version + 1);
  const versions = await jsonRequest(worker, `/api/skills/${current.id}/versions`);
  assert.equal(versions.response.status, 200);
  assert.ok(versions.body.versions.some((item) => item.version === current.version));
  assert.ok(versions.body.versions.some((item) => item.current === true));

  const tool = await jsonRequest(worker, "/api/tools/calculate_price/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ input: { question: "海盐苏打多少钱？" } }),
  });
  assert.equal(tool.response.status, 200);
  assert.equal(tool.body.status, "SUCCESS");
  assert.equal(tool.body.toolId, "calculate_price");
  assert.deepEqual(tool.body.input, { question: "海盐苏打多少钱？" });
  assert.ok(Array.isArray(tool.body.output.quotes));
  assert.equal(typeof tool.body.durationMs, "number");

  const invalidRiskInput = await jsonRequest(worker, "/api/tools/risk-check/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ input: { question: "有人让我先交中奖保证金" } }),
  });
  assert.equal(invalidRiskInput.response.status, 400);
  assert.equal(invalidRiskInput.body.error.code, "TOOL_INPUT_VALIDATION_FAILED");
  assert.match(invalidRiskInput.body.error.message, /finalReply/);

  const riskTool = await jsonRequest(worker, "/api/tools/risk-check/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ input: { question: "有人让我先交中奖保证金", finalReply: "请不要转账或提供验证码。" } }),
  });
  assert.equal(riskTool.response.status, 200);
  assert.equal(riskTool.body.status, "SUCCESS");
  assert.equal(riskTool.body.output.blocked, false);
});

test("planner preview follows enabled capabilities and provider switch affects RunRecord", async () => {
  const worker = await loadWorker();
  const switched = await jsonRequest(worker, "/api/llm-config/switch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ provider: "classroom-fixture" }),
  });
  assert.equal(switched.response.status, 200);
  assert.equal(switched.body.config.provider, "classroom-fixture");
  assert.equal(typeof switched.body.config.environment.coze.apiKey, "boolean");
  assert.equal(typeof switched.body.config.environment.coze.model, "boolean");
  assert.equal(typeof switched.body.config.environment.deepseek.model, "boolean");
  assert.doesNotMatch(JSON.stringify(switched.body), /sk-[A-Za-z0-9_-]{8,}/);

  const preview = await jsonRequest(worker, "/api/planner/preview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question: "海盐苏打现在多少钱？" }),
  });
  assert.equal(preview.response.status, 200);
  assert.ok(preview.body.plan.selectedTools.includes("calculate_price"));
  assert.equal(preview.body.validation.valid, true);

  const plannerState = await jsonRequest(worker, "/api/planner");
  const planner = plannerState.body.planner;
  const withoutPrice = { ...planner, enabledTools: planner.enabledTools.filter((id) => id !== "calculate_price") };
  const disabled = await jsonRequest(worker, "/api/planner", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(withoutPrice),
  });
  assert.equal(disabled.response.status, 200);
  const invalidPreview = await jsonRequest(worker, "/api/planner/preview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question: "海盐苏打现在多少钱？" }),
  });
  assert.equal(invalidPreview.response.status, 200);
  assert.equal(invalidPreview.body.validation.valid, false);
  assert.ok(invalidPreview.body.validation.errors.some((message) => message.includes("calculate_price")));
  const restored = await jsonRequest(worker, "/api/planner", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(planner),
  });
  assert.equal(restored.response.status, 200);

  const runResponse = await request(worker, "/api/agent/run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userInput: "海盐苏打现在多少钱？", source: "integration-test" }),
  });
  assert.equal(runResponse.status, 200);
  const stream = await runResponse.text();
  assert.match(stream, /event: complete/);
  const runId = [...stream.matchAll(/"runId":"([^"]+)"/g)].at(-1)?.[1];
  assert.ok(runId);

  const run = await jsonRequest(worker, `/api/runs/${runId}`);
  assert.equal(run.response.status, 200);
  assert.equal(run.body.provider, "classroom-fixture");
  assert.equal(run.body.status, "SUCCESS");
  assert.ok(run.body.steps.some((step) => step.type === "tool" && step.capabilityId === "calculate_price"));
  assert.ok(run.body.steps.some((step) => step.type === "risk-check"));
});
