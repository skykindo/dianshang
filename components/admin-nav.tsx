export default function AdminNav({ active }: { active: string }) {
  const links = [["demo", "聊天 Demo"], ["home", "Agent 控制台"], ["catalog", "商品数据"], ["skills", "Skills"], ["tools", "Tools"], ["planner", "Planner"], ["models", "模型管理"], ["ops", "运营中心"], ["eval", "评测中心"]];
  return <header className="admin-topbar">
    <a className="wordmark" href="/"><span>SN</span> SnackOps</a>
    <nav>{links.map(([href, label]) => <a className={active === href ? "active" : ""} href={href === "home" ? "/" : `/${href}`} key={href}>{label}</a>)}</nav>
  </header>;
}
