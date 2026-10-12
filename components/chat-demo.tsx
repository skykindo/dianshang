"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";
import AdminNav from "@/components/admin-nav";
import RichReply from "@/components/rich-reply";
import type { AgentEvent, ConversationMessage, ProviderName } from "@/lib/agent/types";

type ChatMessage = ConversationMessage & { id: string; pending?: boolean; error?: boolean; runId?: string };

const examples = [
  "推荐一款低糖的下午茶零食",
  "20 元内有哪些好吃的饼干？",
  "我的订单物流到哪了？",
  "客服说我中奖了，要先转保证金",
];

function responseError(value: unknown, status: number) {
  if (value && typeof value === "object") {
    const candidate = value as { error?: string | { message?: string } };
    if (typeof candidate.error === "string") return candidate.error;
    if (candidate.error?.message) return candidate.error.message;
  }
  return `无法建立聊天连接（${status}）。`;
}

export default function ChatDemo() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [provider, setProvider] = useState<ProviderName | "">("");
  const [busy, setBusy] = useState(false);
  const conversationId = useRef("");

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const question = input.trim();
    if (!question || busy) return;
    conversationId.current ||= crypto.randomUUID();
    const history = messages.filter((item) => !item.pending && !item.error).map(({ role, content }) => ({ role, content }));
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: question };
    const assistantId = crypto.randomUUID();
    setMessages((current) => [...current, userMessage, { id: assistantId, role: "assistant", content: "Agent 正在处理…", pending: true }]);
    setInput("");
    setBusy(true);
    try {
      const response = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userInput: question, conversationHistory: history, conversationId: conversationId.current, source: "demo", provider: provider || undefined }),
      });
      if (!response.ok || !response.body) {
        let body: unknown = null;
        try { body = await response.json(); } catch { /* Use the HTTP status fallback. */ }
        throw new Error(responseError(body, response.status));
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let runId = "";
      let finalReply = "";
      let runError = "";
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() ?? "";
        for (const block of blocks) {
          const raw = block.split(/\r?\n/).find((line) => line.startsWith("data: "))?.slice(6);
          if (!raw) continue;
          const agentEvent = JSON.parse(raw) as AgentEvent;
          if (agentEvent.type === "run") runId = agentEvent.run.id;
          if (agentEvent.type === "final") finalReply = agentEvent.reply;
          if (agentEvent.type === "error") runError = agentEvent.error;
        }
        if (done) break;
      }
      if (!finalReply) throw new Error(runError || "Agent 未返回最终回复。");
      setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, content: finalReply, pending: false, runId } : item));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, content: `未能返回回复：${message}`, pending: false, error: true } : item));
    } finally {
      setBusy(false);
    }
  }

  function resetConversation() {
    setMessages([]);
    setInput("");
    conversationId.current = "";
  }

  return <main className="admin-shell chat-shell">
    <AdminNav active="demo" />
    <section className="chat-heading">
      <div><p className="eyebrow">CUSTOMER CHAT DEMO</p><h1>聊天 Demo</h1><p>面向客服对话验证；每条消息仍会经过完整 Agent 链路。如需查看 Planner、Tool 和 Trace，请进入 Agent 控制台。</p></div>
      <div className="chat-heading-actions"><Link href="/eval">打开评测用例集 ↗</Link><button type="button" onClick={resetConversation} disabled={!messages.length || busy}>新对话</button></div>
    </section>
    <section className="chat-window" aria-label="客服聊天窗口">
      <div className="chat-stream" aria-live="polite">
        {!messages.length && <div className="chat-welcome"><span>SN</span><h2>想咨询什么？</h2><p>可以询问商品、价格、订单、物流或安全风险。</p><div className="chat-suggestions">{examples.map((item) => <button key={item} type="button" onClick={() => setInput(item)}>{item}</button>)}</div></div>}
        {messages.map((message) => <article key={message.id} className={`chat-message ${message.role} ${message.error ? "error" : ""}`}>
          <div className="chat-avatar">{message.role === "user" ? "我" : "SN"}</div>
          <div><RichReply text={message.content}/>{message.runId && <Link href={`/runs/${message.runId}`}>查看本次 Trace ↗</Link>}</div>
        </article>)}
      </div>
      <form className="chat-composer" onSubmit={submit}>
        <textarea rows={3} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(); } }} placeholder="输入消息，Enter 发送，Shift + Enter 换行" aria-label="聊天消息" />
        <div className="chat-composer-bar"><label>Provider <select value={provider} onChange={(event) => setProvider(event.target.value as ProviderName | "")}><option value="">跟随服务端</option><option value="classroom-fixture">classroom-fixture</option><option value="deepseek">DeepSeek</option><option value="coze">Coze</option></select></label><button disabled={busy || !input.trim()}>{busy ? "回复中…" : "发送 ↑"}</button></div>
      </form>
    </section>
  </main>;
}
