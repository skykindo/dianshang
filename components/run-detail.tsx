"use client";

import { useEffect, useState } from "react";
import type { RunRecord } from "@/lib/agent/types";
import RichReply from "@/components/rich-reply";

export default function RunDetail({ runId }: { runId: string }) {
  const [run, setRun] = useState<RunRecord | null>(null);
  const [annotation, setAnnotation] = useState("");
  const [explanation, setExplanation] = useState("");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(3);
  const [ratingFeedback, setRatingFeedback] = useState("");
  useEffect(() => {
    let active = true;
    void fetch(`/api/runs/${runId}`).then(async (response) => {
      if (!active) return;
      if (!response.ok) { setMessage("运行记录不存在。"); return; }
      const next = await response.json() as RunRecord;
      if (active) { setRun(next); setAnnotation(next.annotation ?? ""); }
    });
    return () => { active = false; };
  }, [runId]);

  async function action(path: string, body: unknown = {}) {
    setMessage("处理中…");
    const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json() as RunRecord & { explanation?: string; error?: { message?: string } };
    if (!response.ok) { setMessage(data.error?.message ?? "操作失败。"); return; }
    if (data.explanation) setExplanation(data.explanation);
    else if (path === "/api/run/retry") window.location.href = `/runs/${data.id}`;
    else setRun(data);
    setMessage("已保存。");
  }
  async function saveRating() {
    setMessage("保存评分中…");
    const response = await fetch("/api/ratings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ runId: run?.id, score: rating, issueType: rating <= 2 ? "correctness" : "other", feedback: ratingFeedback }) });
    const data = await response.json() as { error?: { message?: string } };
    setMessage(response.ok ? (rating <= 2 ? "评分已保存，并进入改进建议。" : "评分已保存。") : data.error?.message ?? "评分保存失败。");
  }

  if (!run) return <main className="detail-shell"><a href="/">← 返回工作台</a><p>{message || "加载 RunRecord…"}</p></main>;
  return <main className="detail-shell">
    <div className="detail-head"><div><a href="/">← 返回工作台</a><p className="eyebrow">RUN RECORD</p><h1>{run.id}</h1><p>{run.createdAt} · {run.durationMs}ms · {run.provider}/{run.model}</p></div><b className={`status ${run.status.toLowerCase()}`}>{run.status}</b></div>
    <section className="record-grid"><article className="panel"><small>QUESTION</small><h2>{run.question}</h2><small>FINAL REPLY</small><RichReply className="final-text" text={run.finalReply || "无"}/><small>RISK RESULT</small><pre>{JSON.stringify(run.riskResult, null, 2)}</pre></article>
      <article className="panel"><small>PLAN</small><pre>{JSON.stringify(run.plan, null, 2)}</pre><small>VERSION SNAPSHOT</small><pre>{JSON.stringify({ skills: run.skillVersions, tools: run.toolVersions }, null, 2)}</pre></article></section>
    <section className="panel detail-trace"><div className="panel-title"><span>Σ</span><div><h2>完整 Trace</h2><p>{run.steps.length} 个步骤，错误不会被伪装为成功</p></div></div>
      {run.steps.map((step, index) => <details key={step.stepId} open={step.status === "ERROR"}><summary><b>{String(index + 1).padStart(2, "0")} · {step.capabilityId ?? step.type}</b><span>{step.status} · {step.durationMs}ms</span></summary><pre>{JSON.stringify(step, null, 2)}</pre></details>)}</section>
    <section className="panel actions-panel"><button onClick={() => void action("/api/run/retry", { runId: run.id })}>重试运行</button><button onClick={() => void action(`/api/runs/${run.id}/handoff`)}>标记人工接管</button><button onClick={() => void action("/api/explain", { runId: run.id, focus: "risk" })}>解释风险判断</button>
      <textarea value={annotation} onChange={(e) => setAnnotation(e.target.value)} placeholder="添加标注…" /><button onClick={() => void action(`/api/runs/${run.id}/annotate`, { annotation })}>保存标注</button>{message && <p>{message}</p>}{explanation && <div className="explanation">{explanation}</div>}</section>
    <section className="panel run-rating"><div><small>SERVICE RATING</small><h2>这次回复解决问题了吗？</h2></div><label>评分<select value={rating} onChange={(e) => setRating(Number(e.target.value))}>{[1,2,3,4,5].map((value) => <option value={value} key={value}>{value} 分</option>)}</select></label><label>反馈<input value={ratingFeedback} onChange={(e) => setRatingFeedback(e.target.value)} placeholder="可选：说明原因" /></label><button className="primary-action" onClick={() => void saveRating()}>保存评分</button><a href="/ops">前往运营中心 ↗</a></section>
  </main>;
}
