"use client";

import { useEffect, useMemo, useState } from "react";
import type { LlmConfig, PlannerConfig, SkillConfig, ToolConfig } from "@/lib/admin/types";
import type { AgentPlan, PlanValidation } from "@/lib/agent/types";

type PlannerTab = "prompt" | "mandatory" | "tools" | "model" | "preview";
type PlannerPreview = {
  provider: string;
  model: string;
  plan: AgentPlan;
  validation: PlanValidation;
  workspace: {
    availableSkills: { id: string; name: string }[];
    availableTools: { id: string; name: string }[];
    mandatoryCapabilities: string[];
    riskEnabled: boolean;
    systemPrompt: string;
  };
};

const tabs: { id: PlannerTab; label: string }[] = [
  { id: "prompt", label: "System Prompt" },
  { id: "mandatory", label: "必经 Skill" },
  { id: "tools", label: "Tool 分组" },
  { id: "model", label: "模型参数" },
  { id: "preview", label: "执行空间预览" },
];

function unique(values: string[]) { return [...new Set(values)]; }

export default function PlannerAdmin() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [activeTab, setActiveTab] = useState<PlannerTab>("prompt");
  const [planner, setPlanner] = useState<PlannerConfig | null>(null);
  const [skills, setSkills] = useState<SkillConfig[]>([]);
  const [tools, setTools] = useState<ToolConfig[]>([]);
  const [llm, setLlm] = useState<Pick<LlmConfig, "provider" | "defaultModel" | "models"> | null>(null);
  const [question, setQuestion] = useState("我想买点办公室零食，预算 30 元，要麻辣口味");
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [preview, setPreview] = useState<PlannerPreview | null>(null);

  useEffect(() => {
    let active = true;
    void fetch("/api/planner").then(async (response) => {
      if (!response.ok) throw new Error("无法读取 Planner。");
      const data = await response.json() as { planner: PlannerConfig; skills: SkillConfig[]; tools: ToolConfig[]; llm: Pick<LlmConfig, "provider" | "defaultModel" | "models"> };
      if (active) { setPlanner(data.planner); setSkills(data.skills); setTools(data.tools); setLlm(data.llm); setLoading(false); }
    }).catch((error) => {
      if (active) { setMessage({ type: "error", text: error instanceof Error ? error.message : String(error) }); setLoading(false); }
    });
    return () => { active = false; };
  }, []);

  const enabledSkills = useMemo(() => skills.filter((item) => item.enabled && planner?.enabledSkills.includes(item.id)), [skills, planner]);
  const enabledTools = useMemo(() => tools.filter((item) => item.enabled && planner?.enabledTools.includes(item.id)), [tools, planner]);
  const mandatoryOptions = useMemo(() => [
    ...skills.map((item) => ({ id: item.id, name: item.name, enabled: item.enabled })),
    ...tools.filter((item) => item.id === "risk-check").map((item) => ({ id: item.id, name: item.name, enabled: item.enabled })),
  ], [skills, tools]);
  const modelOptions = useMemo(() => {
    if (!llm) return [];
    return unique([llm.defaultModel, ...(llm.models[llm.provider] ?? [])].filter(Boolean));
  }, [llm]);

  function toggleSkill(id: string) {
    setPlanner((current) => current ? { ...current, enabledSkills: current.enabledSkills.includes(id) ? current.enabledSkills.filter((item) => item !== id) : [...current.enabledSkills, id] } : current);
  }

  function toggleMandatory(id: string) {
    if (id === "risk-check") return;
    setPlanner((current) => current ? { ...current, mandatoryCapabilities: current.mandatoryCapabilities.includes(id) ? current.mandatoryCapabilities.filter((item) => item !== id) : [...current.mandatoryCapabilities, id] } : current);
  }

  function toggleToolGroup(group: "base" | "pricing", id: string) {
    setPlanner((current) => {
      if (!current || id === "risk-check") return current;
      const nextGroup = current.toolGroups[group].includes(id) ? current.toolGroups[group].filter((item) => item !== id) : [...current.toolGroups[group], id];
      const toolGroups = { ...current.toolGroups, [group]: nextGroup };
      const enabledTools = unique([...toolGroups.base, ...toolGroups.pricing, "risk-check"]);
      return { ...current, toolGroups, enabledTools };
    });
  }

  async function save(showSuccess = true) {
    if (!planner) return false;
    setSaving(true); setMessage(null);
    try {
      const response = await fetch("/api/planner", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(planner) });
      const data = await response.json() as { planner?: PlannerConfig; message?: string; error?: { message?: string } };
      if (!response.ok || !data.planner) throw new Error(data.error?.message ?? "Planner 保存失败。");
      setPlanner(data.planner);
      if (showSuccess) setMessage({ type: "success", text: data.message ?? "保存成功。" });
      return true;
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : String(error) });
      return false;
    } finally { setSaving(false); }
  }

  async function runPreview() {
    setPreviewing(true); setPreview(null);
    const saved = await save(false);
    if (!saved) { setPreviewing(false); return; }
    try {
      const response = await fetch("/api/planner/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) });
      const data = await response.json() as Partial<PlannerPreview> & { error?: { message?: string } };
      if (!response.ok || !data.plan || !data.validation || !data.workspace) throw new Error(data.error?.message ?? "预览失败。");
      setPreview(data as PlannerPreview);
      setMessage({ type: data.validation.valid ? "success" : "error", text: data.validation.valid ? "执行空间已生成，计划校验通过。" : "执行空间已生成，但计划校验未通过。" });
    } catch (error) { setMessage({ type: "error", text: error instanceof Error ? error.message : String(error) }); }
    finally { setPreviewing(false); }
  }

  if (loading) return <div className="admin-state">Planner 配置加载中…</div>;
  if (!planner) return <div className="admin-state error-box">Planner 配置不可用。</div>;

  return <>
    <section className="admin-hero compact-admin-hero planner-hero">
      <div><p className="eyebrow">DECISION ENGINE · V{planner.version}</p><h1>Planner 管理</h1><p>配置 Planner 的 System Prompt、必经 Skill、基础 Tool 与价格 Tool 集合。Planner 只能调用已启用的能力。</p></div>
      <button className="primary-action planner-save" disabled={saving} onClick={() => void save()}><span aria-hidden="true">▣</span>{saving ? "保存中…" : "保存配置"}</button>
    </section>
    {message && <div className={`inline-message ${message.type}`}>{message.text}</div>}

    <nav className="planner-tabs" aria-label="Planner 配置页签">
      {tabs.map((tab) => <button key={tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}
    </nav>

    {activeTab === "prompt" && <section className="admin-panel planner-tab-panel prompt-tab-panel">
      <div className="admin-panel-head"><div><h2>System Prompt</h2><p>定义 Planner 的能力边界、强制规则和 JSON 输出要求。</p></div><span>v{planner.version}</span></div>
      <textarea className="code-input planner-prompt-input" rows={24} value={planner.prompt} onChange={(event) => setPlanner({ ...planner, prompt: event.target.value })} />
    </section>}

    {activeTab === "mandatory" && <section className="admin-panel planner-tab-panel">
      <div className="planner-section-copy"><h2>必经能力（任何场景都要执行）</h2><p>勾选后 Planner 必须安排这些能力，即使 LLM 认为不需要也会强制补上。最终风险检查 Tool 必须强制。</p></div>
      <div className="mandatory-skill-grid">
        {mandatoryOptions.map((item) => {
          const forced = item.id === "risk-check";
          const checked = forced || planner.mandatoryCapabilities.includes(item.id);
          return <label className={!item.enabled ? "muted" : ""} key={item.id}>
            <span><b>{item.name}</b>{forced && <em>强制</em>}<small>{item.id}</small></span>
            <span className="switch"><input type="checkbox" disabled={forced || !item.enabled} checked={checked} onChange={() => toggleMandatory(item.id)} /><i /></span>
          </label>;
        })}
      </div>
      <div className="planner-secondary-config"><h3>可用 Skill</h3><p>只有启用的 Skill 会出现在 Planner 的可选能力列表中。</p><div className="skill-enable-row">{skills.map((item) => <label key={item.id} className={!item.enabled ? "muted" : ""}><input type="checkbox" disabled={!item.enabled} checked={planner.enabledSkills.includes(item.id)} onChange={() => toggleSkill(item.id)} />{item.name}</label>)}</div></div>
    </section>}

    {activeTab === "tools" && <section className="planner-tool-sections">
      <ToolGroup title="基础 Tool（用户请求商品时默认调用）" description="通常包含商品查询。LLM 会在判定为非购买意图时跳过。" group="base" planner={planner} tools={tools} onToggle={toggleToolGroup} />
      <ToolGroup title="价格相关 Tool（有推荐商品时必调）" description="最终价格必须经由这些 Tool 链计算，LLM 不得自行编造。" group="pricing" planner={planner} tools={tools} onToggle={toggleToolGroup} />
    </section>}

    {activeTab === "model" && <section className="admin-panel planner-tab-panel model-parameter-panel">
      <div className="planner-section-copy"><h2>模型参数</h2><p>这些参数仅影响 Planner 生成执行计划，不会改变最终客服回复模型。</p></div>
      <label className="planner-model-field">模型<select value={planner.model} onChange={(event) => setPlanner({ ...planner, model: event.target.value })}><option value="inherit">继承全局模型{llm ? `（${llm.defaultModel}）` : ""}</option>{modelOptions.map((model) => <option key={model} value={model}>{model}</option>)}</select></label>
      <p className="planner-model-hint">推荐使用轻量模型快速规划，复杂路由或严格推理场景可选更强模型。</p>
      <div className="runtime-model-note">ⓘ 实际运行模型： <b>{planner.model === "inherit" ? llm?.defaultModel ?? "未配置" : planner.model}</b><span>{llm?.provider ?? "unknown provider"}</span></div>
      <label className="planner-range-field"><span>temperature: {planner.temperature.toFixed(2)}</span><input type="range" min="0" max="2" step="0.05" value={planner.temperature} onChange={(event) => setPlanner({ ...planner, temperature: Number(event.target.value) })} /></label>
      <label className="planner-token-field">maxTokens<input type="number" min="100" max="32768" step="100" value={planner.maxTokens} onChange={(event) => setPlanner({ ...planner, maxTokens: Number(event.target.value) })} /></label>
    </section>}

    {activeTab === "preview" && <section className="admin-panel planner-tab-panel execution-preview-panel">
      <div className="planner-section-copy with-icon"><span aria-hidden="true">◉</span><div><h2>执行空间预览</h2><p>输入一个示例问题，可以查看 Planner 实际收到的 Skills/Tools 列表和完整 System Prompt。</p></div></div>
      <div className="workspace-preview-form"><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="输入示例问题" /><button className="primary-action" disabled={previewing || !question.trim()} onClick={() => void runPreview()}><span aria-hidden="true">▷</span>{previewing ? "预览中…" : "预览"}</button></div>
      <div className="workspace-metrics"><Metric label="可用 Skill" value={preview?.workspace.availableSkills.length ?? enabledSkills.length} /><Metric label="可用 Tool" value={preview?.workspace.availableTools.length ?? enabledTools.length} /><Metric label="必经能力" value={preview?.workspace.mandatoryCapabilities.length ?? unique(["risk-check", ...planner.mandatoryCapabilities]).length} /><Metric label="风控启用" value={(preview?.workspace.riskEnabled ?? planner.enabledTools.includes("risk-check")) ? "是" : "否"} /></div>
      <PreviewCapabilityList label="可用 Skills" items={preview?.workspace.availableSkills ?? enabledSkills.map(({ id, name }) => ({ id, name }))} />
      <PreviewCapabilityList label="可用 Tools" items={preview?.workspace.availableTools ?? enabledTools.map(({ id, name }) => ({ id, name }))} />
      {preview ? <>
        <h3 className="compiled-prompt-title">System Prompt（含用户问题）</h3><pre className="compiled-prompt">{preview.workspace.systemPrompt}</pre>
        <div className={`preview-validation ${preview.validation.valid ? "valid" : "invalid"}`}><b>{preview.validation.valid ? "✓ 计划校验通过" : "✕ 计划校验未通过"}</b><span>{preview.provider} · {preview.model}</span>{preview.validation.errors.map((item) => <p key={item}>{item}</p>)}</div>
      </> : <div className="workspace-empty">点击“预览”后显示服务端组装的完整 Prompt 与真实计划校验结果。</div>}
    </section>}
  </>;
}

function ToolGroup({ title, description, group, planner, tools, onToggle }: { title: string; description: string; group: "base" | "pricing"; planner: PlannerConfig; tools: ToolConfig[]; onToggle: (group: "base" | "pricing", id: string) => void }) {
  return <section className="admin-panel planner-tab-panel tool-group-panel"><div className="planner-section-copy"><h2>{title}</h2><p>{description}</p></div><div className="tool-group-grid">{tools.filter((tool) => tool.id !== "risk-check").map((tool) => {
    return <label className={!tool.enabled ? "muted" : ""} key={tool.id}><input type="checkbox" disabled={!tool.enabled} checked={planner.toolGroups[group].includes(tool.id)} onChange={() => onToggle(group, tool.id)} /><span><b>{tool.name}</b><small>{tool.id}</small></span></label>;
  })}</div></section>;
}

function Metric({ label, value }: { label: string; value: string | number }) { return <div><span>{label}</span><b>{value}</b></div>; }

function PreviewCapabilityList({ label, items }: { label: string; items: { id: string; name: string }[] }) {
  return <div className="preview-capability-list"><b>{label}</b><div>{items.length ? items.map((item) => <span key={item.id} title={item.id}>{item.name}</span>) : <em>无</em>}</div></div>;
}
