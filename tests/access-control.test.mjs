import assert from "node:assert/strict";
import test from "node:test";

const env = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
const ctx = { waitUntil() {}, passThroughOnException() {} };

async function loadWorker() {
  const url = new URL("../dist/server/index.js", import.meta.url);
  url.searchParams.set("access-control", `${Date.now()}-${Math.random()}`);
  return (await import(url.href)).default;
}

test("portfolio pages are publicly accessible without platform identity", async () => {
  const worker = await loadWorker();
  const page = await worker.fetch(new Request("https://snackops.example/ops"), env, ctx);
  assert.equal(page.status, 200);
  assert.doesNotMatch(page.headers.get("location") ?? "", /signin-with-chatgpt/);
});
