"use client";

import { useEffect, useState } from "react";
import type { ProviderName } from "@/lib/agent/types";
import type { PublicLlmConfig } from "@/lib/admin/types";

const providers: ProviderName[] = ["classroom-fixture", "deepseek", "coze"];

export default function ModelsAdmin() {
  const [config, setConfig] = useState<PublicLlmConfig | null>(null); const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(""); const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);
  useEffect(() => { let active = true; void fetch("/api/llm-config").then(async (response) => { if (!response.ok) throw new Error("无法读取模型配置。"); const data = await response.json() as { config: PublicLlmConfig }; if (active) { setConfig(data.config); setLoading(false); } }).catch((error) => { if (active) { setMessage({ type: "error", text: error instanceof Error ? error.message : String(error) }); setLoading(false); } }); return () => { active = false; }; }, []);
  async function switchProvider(provider: ProviderName) {
    setBusy(`switch-${provider}`); setMessage(null); setTestResult(null);
    try {
      const response = await fetch("/api/llm-config/switch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider }) });
      const data = await response.json() as { config?: PublicLlmConfig; message?: string; error?: { message?: string } };
      if (!response.ok || !data.config) throw new Error(data.error?.message ?? "切换失败。");
      setConfig(data.config); setMessage({ type: "success", text: data.message ?? "切换成功。" });
    } catch (error) { setMessage({ type: "error", text: error instanceof Error ? error.message : String(error) }); }
    finally { setBusy(""); }
  }
  async function saveModels() {
    if (!config) return; setBusy("save"); setMessage(null);
    try {
      const response = await fetch("/api/llm-config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ defaultModel: config.defaultModel, models: config.models }) });
      const data = await response.json() as { config?: PublicLlmConfig; message?: string; error?: { message?: string } };
      if (!response.ok || !data.config) throw new Error(data.error?.message ?? "保存失败。");
      setConfig(data.config); setMessage({ type: "success", text: data.message ?? "保存成功。" });
    } catch (error) { setMessage({ type: "error", text: error instanceof Error ? error.message : String(error) }); }
    finally { setBusy(""); }
  }
  async function testConnection(provider: ProviderName) {
    setBusy(`test-${provider}`); setMessage(null); setTestResult(null);
    try {
      const response = await fetch("/api/llm-config/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider }) });
      const data = await response.json() as Record<string, unknown> & { error?: { message?: string; code?: string } };
      setTestResult(data); setMessage(response.ok ? { type: "success", text: `${provider} 连接测试成功。` } : { type: "error", text: `${data.error?.code ?? "PROVIDER_TEST_FAILED"}：${data.error?.message ?? "连接失败。"}` });
    } catch (error) { setMessage({ type: "error", text: error instanceof Error ? error.message : String(error) }); }
    finally { setBusy(""); }
  }
  if (loading) return <div className="admin-state">模型配置加载中…</div>;
  if (!config) return <div className="admin-state error-box">{message?.text ?? "模型配置不可用。"}</div>;
  const readiness = config.provider === "coze" ? config.environment.coze.ready : config.provider === "deepseek" ? config.environment.deepseek.ready : true;
  return <><section className={`mode-banner ${config.provider === "classroom-fixture" ? "fixture" : readiness ? "real" : "warning"}`}><div><small>CURRENT RUN MODE</small><h1>{config.modeLabel}</h1><p>{config.provider} · {config.defaultModel || "未配置默认模型"}</p></div><b>{config.provider === "classroom-fixture" ? "DEMO STABLE" : readiness ? "READY" : "CONFIG MISSING"}</b></section>{message && <div className={`inline-message ${message.type}`}>{message.text}</div>}
    <section className="admin-hero compact-admin-hero"><div><p className="eyebrow">MODEL CONTROL</p><h1>模型管理</h1><p>密钥仅在服务端读取；页面和 API 只显示是否已配置。</p></div></section>
    <div className="provider-grid">{providers.map((provider) => { const active = config.provider === provider; const envState = provider === "coze" ? config.environment.coze : provider === "deepseek" ? config.environment.deepseek : null; return <article className={`admin-panel provider-card ${active ? "active" : ""}`} key={provider}><div className="admin-panel-head"><div><small>PROVIDER</small><h2>{provider}</h2></div>{active && <span className="active-pill">CURRENT</span>}</div><p>{config.descriptions[provider]}</p>{envState ? <div className="env-grid">{Object.entries(envState).filter(([key]) => key !== "ready").map(([key, value]) => <span className={value ? "set" : "missing"} key={key}><i />{key}: {value ? "configured" : "missing"}</span>)}</div> : <div className="fixture-note">无外部密钥·确定性输出·完整 Agent 链路</div>}<div className="card-actions"><button disabled={active || Boolean(busy)} onClick={() => void switchProvider(provider)}>{active ? "已启用" : "切换"}</button><button disabled={Boolean(busy)} onClick={() => void testConnection(provider)}>{busy === `test-${provider}` ? "测试中…" : "测试连接"}</button></div></article>; })}</div>
    <section className="admin-panel model-editor"><div className="admin-panel-head"><div><h2>默认模型与模型列表</h2><p>当前 Provider 的后续 Run 将使用这个默认模型。</p></div><button className="primary-action" disabled={Boolean(busy)} onClick={() => void saveModels()}>{busy === "save" ? "保存中…" : "保存模型配置"}</button></div><label className="full-field">默认模型<input value={config.defaultModel} onChange={(e) => setConfig({ ...config, defaultModel: e.target.value })} /></label><div className="model-list-grid">{providers.map((provider) => <label key={provider}>{provider} 模型（每行一个）<textarea rows={5} value={config.models[provider].join("\n")} onChange={(e) => setConfig({ ...config, models: { ...config.models, [provider]: e.target.value.split("\n") } })} /></label>)}</div>{testResult && <div className="test-result"><small>SERVER CONNECTION RESULT</small><pre>{JSON.stringify(testResult, null, 2)}</pre></div>}</section>
  </>;
}
