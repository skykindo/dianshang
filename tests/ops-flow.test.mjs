import assert from "node:assert/strict";
import test from "node:test";

const runtimeEnv = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
const runtimeContext = { waitUntil() {}, passThroughOnException() {} };
async function loadWorker() { const url = new URL("../dist/server/index.js", import.meta.url); url.searchParams.set("ops-test", `${Date.now()}-${Math.random()}`); return (await import(url.href)).default; }
async function request(worker, path, init) { return worker.fetch(new Request(`http://localhost${path}`, init), runtimeEnv, runtimeContext); }
async function json(worker, path, init) { const response = await request(worker, path, init); return { response, body: await response.json() }; }
const post = (body) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

test("ops loop persists low ratings, annotations, prompt snapshots and rollback", async () => {
  const worker = await loadWorker();
  const runResponse = await request(worker, "/api/agent/run", post({ userInput: "海盐苏打现在多少钱？", source: "ops-acceptance" }));
  assert.equal(runResponse.status, 200); const stream = await runResponse.text(); const runId = [...stream.matchAll(/"runId":"([^"]+)"/g)].at(-1)?.[1]; assert.ok(runId);

  const rating = await json(worker, "/api/ratings", post({ runId, score: 1, issueType: "correctness", feedback: "价格依据不清楚" }));
  assert.equal(rating.response.status, 201); assert.equal(rating.body.rating.question, "海盐苏打现在多少钱？"); assert.equal(rating.body.improvement.source, "low-rating");
  const listedRatings = await json(worker, "/api/ratings?score=1&issueType=correctness"); assert.ok(listedRatings.body.ratings.some((item) => item.runId === runId));

  const dimensions = { correctness: 1, relevance: 3, completeness: 2, safety: 5, tone: 4, overall: 2 };
  const annotation = await json(worker, "/api/annotations", post({ runId, target: "reply", status: "pending", issueType: "correctness", dimensions, annotator: "=HYPERLINK(\"https://invalid.example\")", note: "补充价格来源" }));
  assert.equal(annotation.response.status, 201); const annotationId = annotation.body.annotation.id;
  const refreshed = await json(worker, `/api/annotations/${annotationId}`); assert.equal(refreshed.body.annotation.note, "补充价格来源");
  const updated = await json(worker, `/api/annotations/${annotationId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "accepted", dimensions: { ...dimensions, tone: 5 }, note: "已进入评测集" }) });
  assert.equal(updated.response.status, 200); assert.equal(updated.body.annotation.status, "accepted"); assert.equal(updated.body.annotation.dimensions.tone, 5);
  const exported = await request(worker, "/api/annotations/export"); const csv = await exported.text(); assert.match(exported.headers.get("content-type") ?? "", /text\/csv/); assert.match(csv, /correctness,relevance,completeness,safety,tone,overall/); assert.match(csv, new RegExp(runId)); assert.match(csv, /'=(?:HYPERLINK)/); assert.doesNotMatch(csv, /,"=HYPERLINK/);

  const skillsBefore = await json(worker, "/api/skills"); const skillBefore = skillsBefore.body.skills[0];
  const improvements = await json(worker, "/api/improvements"); const item = improvements.body.improvements.find((value) => value.source === "low-rating" && value.runId === runId); assert.ok(item); assert.equal(improvements.body.clustering.label, "规则聚类");
  const draft = await json(worker, "/api/improvements/generate-prompt", post({ improvementId: item.id, skillId: skillBefore.id })); assert.equal(draft.response.status, 200); assert.equal(draft.body.applied, false);
  const afterDraft = await json(worker, "/api/skills"); assert.equal(afterDraft.body.skills[0].prompt, skillBefore.prompt); assert.equal(afterDraft.body.skills[0].version, skillBefore.version);

  const applied = await json(worker, "/api/improvements/apply-prompt", post({ improvementId: item.id, confirm: true })); assert.equal(applied.response.status, 200); assert.equal(applied.body.snapshotCreated, true); assert.equal(applied.body.skill.version, skillBefore.version + 1);
  const versions = await json(worker, `/api/skills/${skillBefore.id}/versions`); assert.ok(versions.body.versions.some((version) => version.version === skillBefore.version && !version.current));
  const rolledBack = await json(worker, `/api/skills/${skillBefore.id}/versions`, post({ version: skillBefore.version, confirm: true })); assert.equal(rolledBack.response.status, 200); assert.equal(rolledBack.body.snapshotCreated, true);
  const afterRollback = await json(worker, "/api/skills"); assert.equal(afterRollback.body.skills[0].prompt, skillBefore.prompt);
  const invalidAb = await json(worker, "/api/ab-tests", post({ name: "无效实验", skillId: skillBefore.id, versionA: 999, versionB: 1000, trafficPercent: 50 })); assert.equal(invalidAb.response.status, 422);
  const validAb = await json(worker, "/api/ab-tests", post({ name: "推荐 Prompt 对照", skillId: skillBefore.id, versionA: skillBefore.version, versionB: skillBefore.version + 1, trafficPercent: 50 })); assert.equal(validAb.response.status, 201);
});

test("ops page and independent endpoints fail safely", async () => {
  const worker = await loadWorker(); const page = await request(worker, "/ops", { headers: { accept: "text/html" } }); assert.equal(page.status, 200); assert.match(await page.text(), /运营中心/);
  const invalid = await json(worker, "/api/ratings", post({ runId: "missing", score: 0 })); assert.equal(invalid.response.status, 400);
  const overview = await json(worker, "/api/ops/overview"); assert.equal(overview.response.status, 200); assert.equal(typeof overview.body.metrics.successRate, "number");
});
