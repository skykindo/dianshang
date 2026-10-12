"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import AdminNav from "@/components/admin-nav";
import type { AgentEvent, ProviderName, RunRecord, RunStep } from "@/lib/agent/types";

const examples = ["推荐一款低糖的下午茶零食", "20 元内有哪些好吃的饼干？", "我的订单物流到哪了？", "客服说我中奖了，要先转保证金"];
const skillOptions = ["product-recommendation", "order-support", "safety-response"];
const toolOptions = ["catalog-search", "price-query", "order-query", "logistics-query", "risk-check"];

function upsertStep(steps: RunStep[], step: RunStep) {
  const index = steps.findIndex((item) => item.stepId === step.stepId);
  return index < 0 ? [...steps, step] : steps.map((item, i) => i === index ? step : item);
}

export default function AgentWorkbench() {
  const [question, setQuestion] = useState(examples[0]);
  const [provider, setProvider] = useState<ProviderName | "">("");
  const [enabledSkills, setEnabledSkills] = useState(skillOptions);
  const [enabledTools, setEnabledTools] = useState(toolOptions);
  const [simulateFailure, setSimulateFailure] = useState("");
  const [run, setRun] = useState<RunRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const toggle = (value: string, values: string[], setter: (next: string[]) => void) => setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!question.trim() || busy) return;
    setBusy(true); setRun(null);
    try {
      const response = await fetch("/api/agent/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        userInput: question, provider: provider || undefined, source: "workbench", enabledSkills, enabledTools,
        simulateToolFailure: simulateFailure || undefined,
      }) });
      if (!response.ok || !response.body) throw new Error("无法建立 Agent 事件流。");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = ""; let runId = "";
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const blocks = buffer.split("\n\n"); buffer = blocks.pop() ?? "";
        for (const block of blocks) {
          const data = block.split("\n").find((line) => line.startsWith("data: "))?.slice(6);
          if (!data) continue;
          const eventData = JSON.parse(data) as AgentEvent;
          if (eventData.type === "run") { runId = eventData.run.id; setRun(eventData.run); }
          if (eventData.type === "step") setRun((current) => current ? { ...current, steps: upsertStep(current.steps, eventData.step) } : current);
          if (eventData.type === "final") setRun((current) => current ? { ...current, finalReply: eventData.reply, riskResult: eventData.riskResult } : current);
          if (eventData.type === "error") setRun((current) => current ? { ...current, status: "ERROR", error: eventData.error } : current);
        }
        if (done) break;
      }
      if (runId) {
        const detail = await fetch(`/api/runs/${runId}`);
        if (detail.ok) setRun(await detail.json() as RunRecord);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRun((current) => current ? { ...current, status: "ERROR", error: message } : {
        id: "", question, source: "workbench", conversationId: "", createdAt: new Date().toISOString(), status: "ERROR", finalReply: "", plan: null, steps: [], riskResult: null, durationMs: 0, error: message, provider: provider || "classroom-fixture", model: "unavailable", skillVersions: {}, toolVersions: {}, executionConfig: { conversationHistory: [], enabledSkills, enabledTools, mandatoryCapabilities: [], simulateToolFailure: simulateFailure || undefined },
      });
    } finally { setBusy(false); }
  }

  return (
    <main className="admin-shell workbench-shell">
      <AdminNav active="home" />
      <section className="hero">
        <div><p className="eyebrow">AGENT CONTROL ROOM</p><h1>从计划到安全回复，每一步都可见</h1><p>用于调试单次运行：Planner 选择能力，Validator 守住边界，Executor 记录真实结果。</p></div>
        {run?.id && <Link className="detail-link" href={`/runs/${run.id}`}>打开完整 RunRecord ↗</Link>}
      </section>
      <div className="workspace-grid">
        <section className="panel composer-panel">
          <div className="panel-title"><span>01</span><div><h2>发起运行</h2><p>与 /demo 共用同一条 Agent 主链路</p></div></div>
          <form onSubmit={submit}>
            <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={7} aria-label="客服问题" />
            <div className="example-row">{examples.map((item, index) => <button type="button" key={item} onClick={() => setQuestion(item)}>{["推荐", "价格", "物流", "防诈"][index]}</button>)}</div>
            <label className="field-label">LLM Provider<select value={provider} onChange={(e) => setProvider(e.target.value as ProviderName | "")}><option value="">跟随服务端当前 Provider</option><option value="classroom-fixture">classroom-fixture（明示演示）</option><option value="deepseek">DeepSeek</option><option value="coze">Coze</option></select></label>
            <details className="controls"><summary>能力与故障注入</summary>
              <p>Skills</p><div className="check-grid">{skillOptions.map((id) => <label key={id}><input type="checkbox" checked={enabledSkills.includes(id)} onChange={() => toggle(id, enabledSkills, setEnabledSkills)} />{id}</label>)}</div>
              <p>Tools</p><div className="check-grid">{toolOptions.map((id) => <label key={id}><input type="checkbox" checked={enabledTools.includes(id)} onChange={() => toggle(id, enabledTools, setEnabledTools)} />{id}</label>)}</div>
              <label className="field-label">故障注入<select value={simulateFailure} onChange={(e) => setSimulateFailure(e.target.value)}><option value="">不注入</option>{toolOptions.map((id) => <option key={id} value={id}>{id} 返回错误</option>)}</select></label>
            </details>
            <button className="run-button" disabled={busy || !question.trim()}>{busy ? "Agent 执行中…" : "运行 Agent  →"}</button>
          </form>
        </section>
        <section className="panel trace-panel">
          <div className="panel-title"><span>02</span><div><h2>实时 Trace</h2><p>{run ? `${run.provider} · ${run.model}` : "等待运行"}</p></div>{run && <b className={`status ${run.status.toLowerCase()}`}>{run.status}</b>}</div>
          {!run && <div className="empty-state"><strong>尚未运行</strong><p>选择示例或输入问题，这里会逐步出现 Planner、Skill、Tool 与风险检查。</p></div>}
          {run && <>
            <div className="plan-card"><small>PLAN</small><p>{run.plan?.reasoning ?? "Planner 生成中…"}</p>{run.plan && <div className="chips">{[...run.plan.selectedSkills, ...run.plan.selectedTools].map((id) => <span key={id}>{id}</span>)}</div>}</div>
            <div className="timeline">{run.steps.map((step, index) => <article key={step.stepId} className={step.status.toLowerCase()}><div className="step-dot">{index + 1}</div><div><h3>{step.capabilityId ?? step.type}<em>{step.status}</em></h3><p>{step.type} · {step.durationMs}ms</p>{step.error && <code>{step.error}</code>}</div></article>)}</div>
            {run.error && <div className="error-box"><strong>运行失败</strong><p>{run.error}</p></div>}
            {run.finalReply && <div className="reply-card"><small>FINAL REPLY</small><p>{run.finalReply}</p><div className={`risk-strip ${run.riskResult?.level ?? "low"}`}>风险复核：{run.riskResult?.message ?? "等待中"}</div></div>}
          </>}
        </section>
      </div>
    </main>
  );
}
