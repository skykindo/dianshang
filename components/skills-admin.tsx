"use client";

import { useEffect, useMemo, useState } from "react";
import type { SkillConfig, SkillVersion, ToolConfig } from "@/lib/admin/types";

type LoadState = "loading" | "ready" | "error";

function configDiff(current?: SkillVersion, previous?: SkillVersion) {
  if (!current) return [];
  const before = previous ? JSON.stringify(previous.snapshot, null, 2).split("\n") : [];
  const after = JSON.stringify(current.snapshot, null, 2).split("\n");
  const beforeSet = new Set(before); const afterSet = new Set(after);
  return [...before.filter((line) => !afterSet.has(line)).map((line) => `- ${line}`), ...after.map((line) => `${beforeSet.has(line) ? "  " : "+ "}${line}`)];
}

export default function SkillsAdmin() {
  const [state, setState] = useState<LoadState>("loading");
  const [skills, setSkills] = useState<SkillConfig[]>([]);
  const [tools, setTools] = useState<ToolConfig[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<SkillConfig | null>(null);
  const [filter, setFilter] = useState<"all" | "enabled" | "disabled">("all");
  const [versions, setVersions] = useState<SkillVersion[]>([]);
  const [versionIndex, setVersionIndex] = useState(0);
  const [changeNote, setChangeNote] = useState("");
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async <T,>(path: string): Promise<T> => {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`${path} 加载失败（${response.status}）。`);
      return await response.json() as T;
    };
    void Promise.all([load<{ skills?: SkillConfig[] }>("/api/skills"), load<{ tools?: ToolConfig[] }>("/api/tools")]).then(([skillData, toolData]) => {
      if (!active) return;
      const loaded = (skillData as { skills?: SkillConfig[] }).skills ?? [];
      setSkills(loaded); setTools((toolData as { tools?: ToolConfig[] }).tools ?? []);
      setSelectedId(loaded[0]?.id ?? ""); setDraft(loaded[0] ? structuredClone(loaded[0]) : null); setState("ready");
      if (loaded[0]) void fetch(`/api/skills/${loaded[0].id}/versions`).then(async (response) => {
        if (!response.ok) throw new Error(`版本列表加载失败（${response.status}）。`);
        return await response.json() as { versions?: SkillVersion[] };
      }).then((data) => {
        if (active) { setVersions(data.versions ?? []); setVersionIndex(0); }
      }).catch(() => { if (active) setMessage({ type: "error", text: "版本列表加载失败，请点击刷新重试。" }); });
    }).catch(() => { if (active) setState("error"); });
    return () => { active = false; };
  }, []);

  async function loadVersions(id: string) {
    const response = await fetch(`/api/skills/${id}/versions`);
    if (!response.ok) throw new Error(`版本列表加载失败（${response.status}）。`);
    const data = await response.json() as { versions?: SkillVersion[] };
    setVersions(data.versions ?? []); setVersionIndex(0);
  }
  function selectSkill(skill: SkillConfig) {
    setSelectedId(skill.id); setDraft(structuredClone(skill)); setMessage(null);
    void loadVersions(skill.id).catch((error) => setMessage({ type: "error", text: error instanceof Error ? error.message : String(error) }));
  }
  async function save() {
    if (!draft || !changeNote.trim()) { setMessage({ type: "error", text: "请填写 changeNote 后再保存。" }); return; }
    setSaving(true); setMessage(null);
    try {
      const response = await fetch("/api/skills", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: draft.id, skill: draft, changeNote }) });
      const data = await response.json() as { skill?: SkillConfig; message?: string; error?: { message?: string; oldVersionPreserved?: boolean } };
      if (!response.ok || !data.skill) throw new Error(`${data.error?.message ?? "保存失败"}${data.error?.oldVersionPreserved ? "（旧版本已保留）" : ""}`);
      setSkills((items) => items.map((item) => item.id === data.skill!.id ? data.skill! : item)); setDraft(data.skill); setChangeNote("");
      setMessage({ type: "success", text: data.message ?? "保存成功。" }); await loadVersions(data.skill.id);
    } catch (error) { setMessage({ type: "error", text: error instanceof Error ? error.message : String(error) }); }
    finally { setSaving(false); }
  }

  const visible = skills.filter((item) => filter === "all" || (filter === "enabled" ? item.enabled : !item.enabled));
  const selectedVersion = versions[versionIndex];
  const diff = useMemo(() => configDiff(selectedVersion, versions[versionIndex + 1]), [selectedVersion, versions, versionIndex]);
  if (state === "loading") return <div className="admin-state">Skill 配置加载中…</div>;
  if (state === "error") return <div className="admin-state error-box">无法读取 Skill 配置，请刷新重试。</div>;
  return <>
    <section className="admin-hero"><div><p className="eyebrow">CAPABILITY REGISTRY</p><h1>Skill 管理</h1><p>编辑真实执行配置，每次保存前自动快照旧版本。</p></div><div className="segmented">{(["all", "enabled", "disabled"] as const).map((item) => <button className={filter === item ? "active" : ""} onClick={() => setFilter(item)} key={item}>{item}</button>)}</div></section>
    <div className="admin-grid skills-layout"><aside className="admin-panel admin-list"><div className="admin-panel-head"><h2>Skills</h2><span>{visible.length}</span></div>{visible.length ? visible.map((skill) => <button key={skill.id} className={selectedId === skill.id ? "selected" : ""} onClick={() => selectSkill(skill)}><i className={skill.enabled ? "on" : "off"} /><span><b>{skill.name}</b><small>{skill.id} · v{skill.version}</small></span></button>) : <div className="empty-mini">当前筛选无 Skill</div>}</aside>
      <section className="admin-panel editor-panel">{draft ? <><div className="admin-panel-head"><div><h2>{draft.name}</h2><p>{draft.id} · v{draft.version}</p></div><label className="switch"><em className="sr-only">启用 {draft.name}</em><input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} /><span /></label></div>
        <div className="form-grid"><label>名称<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label><label>模型<input value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })} /></label><label>温度<input type="number" min="0" max="2" step="0.1" value={draft.temperature} onChange={(e) => setDraft({ ...draft, temperature: Number(e.target.value) })} /></label><label>Token 上限<input type="number" min="64" value={draft.maxTokens} onChange={(e) => setDraft({ ...draft, maxTokens: Number(e.target.value) })} /></label></div>
        <label className="full-field">描述<textarea rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
        <fieldset><legend>依赖 Tool</legend><div className="check-grid">{tools.map((tool) => <label key={tool.id}><input type="checkbox" checked={draft.dependencyTools.includes(tool.id)} onChange={() => setDraft({ ...draft, dependencyTools: draft.dependencyTools.includes(tool.id) ? draft.dependencyTools.filter((id) => id !== tool.id) : [...draft.dependencyTools, tool.id] })} />{tool.id}</label>)}</div></fieldset>
        <label className="full-field">Prompt 正文<textarea className="code-input" rows={9} value={draft.prompt} onChange={(e) => setDraft({ ...draft, prompt: e.target.value })} /></label>
        <label className="full-field">changeNote<input placeholder="说明这次修改…" value={changeNote} onChange={(e) => setChangeNote(e.target.value)} /></label>{message && <div className={`inline-message ${message.type}`}>{message.text}</div>}<button className="primary-action" disabled={saving} onClick={() => void save()}>{saving ? "保存中…" : "创建快照并保存"}</button>
      </> : <div className="empty-mini">请选择 Skill</div>}</section>
      <aside className="admin-panel version-panel"><div className="admin-panel-head"><h2>版本</h2><button disabled={!selectedId} onClick={() => void loadVersions(selectedId).catch((error) => setMessage({ type: "error", text: error instanceof Error ? error.message : String(error) }))}>刷新</button></div>{versions.length ? <><div className="version-tabs">{versions.map((version, index) => <button className={index === versionIndex ? "active" : ""} onClick={() => setVersionIndex(index)} key={`${version.skillId}-${version.version}`}>v{version.version}{version.current ? " 当前" : ""}</button>)}</div><p className="change-note">{selectedVersion?.changeNote}</p><details open><summary>Prompt 正文</summary><pre>{selectedVersion?.snapshot.prompt}</pre></details><details><summary>配置 diff</summary><pre className="diff-view">{diff.join("\n")}</pre></details></> : <div className="empty-mini">选择 Skill 后查看版本</div>}</aside>
    </div>
  </>;
}
