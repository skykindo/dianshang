"use client";

import { useEffect, useState } from "react";
import type { ToolConfig } from "@/lib/admin/types";

type TestResult = { toolId: string; input: unknown; output: unknown; durationMs: number; status: "SUCCESS" | "ERROR"; error: string | null };

function sampleInput(tool: ToolConfig) {
  const required = Array.isArray(tool.inputSchema.required) ? tool.inputSchema.required : [];
  const value: Record<string, string> = {};
  for (const key of required) if (typeof key === "string") value[key] = key === "finalReply" ? "请不要转账或提供验证码。" : "20 元内有哪些饼干？";
  return JSON.stringify(value, null, 2);
}

export default function ToolsAdmin() {
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [tools, setTools] = useState<ToolConfig[]>([]); const [selectedId, setSelectedId] = useState("");
  const [input, setInput] = useState('{"question":"20 元内有哪些饼干？"}'); const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null); const [success, setSuccess] = useState("");
  useEffect(() => { let active = true; void fetch("/api/tools").then(async (response) => {
    if (!response.ok) throw new Error("加载 Tool 失败。"); const data = await response.json() as { tools: ToolConfig[] };
    if (active) { setTools(data.tools); setSelectedId(data.tools[0]?.id ?? ""); if (data.tools[0]) setInput(sampleInput(data.tools[0])); setLoading(false); }
  }).catch((reason) => { if (active) { setError(reason instanceof Error ? reason.message : String(reason)); setLoading(false); } }); return () => { active = false; }; }, []);
  const selected = tools.find((item) => item.id === selectedId);
  async function toggle(tool: ToolConfig) {
    setError(""); setSuccess("");
    try {
      const response = await fetch("/api/tools", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: tool.id, enabled: !tool.enabled }) });
      const data = await response.json() as { tools?: ToolConfig[]; error?: { message?: string } };
      if (!response.ok || !data.tools) throw new Error(data.error?.message ?? "更新失败。");
      setTools(data.tools); setSuccess(`${tool.id} 已${tool.enabled ? "禁用" : "启用"}。`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  }
  async function testTool() {
    if (!selected) return; setTesting(true); setResult(null); setError("");
    try {
      const parsedInput = JSON.parse(input) as unknown;
      const response = await fetch(`/api/tools/${selected.id}/test`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input: parsedInput }) });
      const data = await response.json() as unknown;
      if (!response.ok && (!data || typeof data !== "object" || !("toolId" in data))) {
        const apiError = data && typeof data === "object" && "error" in data ? (data as { error?: { message?: string } }).error : undefined;
        throw new Error(apiError?.message ?? "Tool 测试失败。");
      }
      setResult(data as TestResult);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setTesting(false); }
  }
  if (loading) return <div className="admin-state">Tool 注册表加载中…</div>;
  return <><section className="admin-hero"><div><p className="eyebrow">SERVER TOOLING</p><h1>Tool 管理</h1><p>测试请求由服务端执行，客户端只展示实际输入、输出和耗时。</p></div></section>{error && <div className="inline-message error">{error}</div>}{success && <div className="inline-message success">{success}</div>}
    <div className="tool-card-grid">{tools.length ? tools.map((tool) => <article className={`admin-panel tool-card ${selectedId === tool.id ? "selected" : ""}`} key={tool.id}><div className="admin-panel-head"><div><small>{tool.id} · {tool.version}</small><h2>{tool.name}</h2></div><label className="switch"><em className="sr-only">启用 {tool.name}</em><input type="checkbox" checked={tool.enabled} onChange={() => void toggle(tool)} /><span /></label></div><p>{tool.description}</p><details><summary>Input schema</summary><pre>{JSON.stringify(tool.inputSchema, null, 2)}</pre></details><details><summary>Output example</summary><pre>{JSON.stringify(tool.outputExample, null, 2)}</pre></details><button className="select-tool" onClick={() => { setSelectedId(tool.id); setInput(sampleInput(tool)); setResult(null); setError(""); }}>在测试器中打开</button></article>) : <div className="admin-state">Tool 列表为空。</div>}</div>
    {selected && <section className="admin-panel tool-tester"><div className="admin-panel-head"><div><p className="eyebrow">LIVE SERVER CALL</p><h2>测试 {selected.id}</h2></div><b className={`status ${selected.enabled ? "success" : "error"}`}>{selected.enabled ? "ENABLED" : "DISABLED"}</b></div><label className="full-field">输入 JSON<textarea className="code-input" rows={6} value={input} onChange={(e) => setInput(e.target.value)} /></label><button className="primary-action" disabled={testing || !selected.enabled} onClick={() => void testTool()}>{testing ? "服务端执行中…" : "调用 Tool"}</button>
      {result && <div className={`test-result ${result.status.toLowerCase()}`}><div><b>{result.status}</b><span>{result.durationMs}ms</span></div><small>REAL INPUT</small><pre>{JSON.stringify(result.input, null, 2)}</pre><small>REAL OUTPUT</small><pre>{JSON.stringify(result.output, null, 2)}</pre>{result.error && <p>{result.error}</p>}</div>}</section>}
  </>;
}
