# IT 服务台机器人项目建设计划

> 项目代号：HelpDesk AI  
> 建设方式：基于当前 SnackOps Agent Workbench 演进，不重新搭建底层框架  
> 目标读者：产品负责人、研发、测试、运维，以及负责落地本项目的 Codex  
> 文档状态：可执行版本 v1.0

## 1. 项目目标

建设一个面向企业内部员工的 IT 服务台机器人。机器人能够识别员工意图，检索可信知识，查询本人设备与工单，在得到确认后执行受控操作；无法安全处理时，创建或升级人工工单，并完整记录每次规划、工具调用、风险判断和最终答复。

首版目标不是替代全部 IT 人员，而是完成以下闭环：

1. 高频问题自助解决：网络、VPN、邮箱、打印机、软件安装、账号登录等。
2. 个性化查询：查询当前用户的设备、历史工单和服务状态。
3. 结构化报障：收集必要信息，自动分类、定级并创建工单。
4. 有条件自动化：对低风险、可回滚动作执行确认后操作。
5. 安全转人工：高风险、权限不足、工具故障或低置信度时转人工。
6. 可观测与可评测：每次回答均可追踪、评分、标注、改进和回归测试。

## 2. 成功指标

MVP 上线后按周统计：

- 自助解决率：无需人工介入且用户确认解决的会话占比，目标 ≥ 45%。
- 首次有效回复率：第一轮给出有效方案或准确澄清问题，目标 ≥ 85%。
- 工单信息完整率：自动创建工单必填字段完整，目标 ≥ 95%。
- 知识引用率：知识型答复带有效来源，目标 100%。
- 高风险误执行：未确认执行、越权操作、泄露敏感信息，目标为 0。
- P95 首次响应时间：fixture 模式 < 2 秒；真实模型和工具模式 < 8 秒。
- 评测集通过率：普通场景 ≥ 90%，高风险场景阻断/转人工率 100%。

## 3. 用户与权限

### 3.1 角色

| 角色 | 主要能力 |
| --- | --- |
| 员工 | 提问、查询本人资产和工单、确认低风险操作、评价结果 |
| IT 一线工程师 | 查看接管队列、补充工单、处理和关闭工单 |
| IT 管理员 | 配置 Skill、Tool、Planner、知识源、风险策略和模型 |
| 运营/质检 | 查看运行记录、评分标注、维护评测集和 A/B 测试 |
| 审计员 | 只读查看操作日志、权限判断和敏感动作记录 |

### 3.2 权限原则

- 默认只能查询和操作当前登录用户自己的数据。
- 设备、工单、账号等 Tool 必须接收服务端身份上下文，不能相信模型传入的 userId。
- 任何写操作都要校验权限、记录审计日志并支持幂等。
- 高风险操作不在 MVP 自动执行，统一转人工。
- 管理页面只允许管理员或运营角色访问。

## 4. MVP 范围

### 4.1 必须完成的用户场景

1. 知识问答
   - VPN 无法连接。
   - Outlook/企业邮箱收不到邮件。
   - 办公 Wi-Fi、打印机、会议室投屏故障。
   - 常用软件安装和升级说明。
   - 密码要求、MFA 使用说明。

2. 服务状态
   - 查询 VPN、邮箱、网络、身份认证等服务是否异常。
   - 存在已知故障时优先告知影响范围、当前状态和预计更新时间。

3. 资产查询
   - 查询当前用户名下电脑、操作系统、序列号掩码、保修状态。
   - 不展示完整敏感标识，不允许查询其他员工资产。

4. 工单闭环
   - 机器人先排障，再判断是否需要建单。
   - 自动收集类别、摘要、详情、影响范围、紧急度、设备、联系方式。
   - 用户确认后创建工单并返回工单号。
   - 支持查询本人最近工单及状态。

5. 低风险受控操作
   - 示例：请求重新同步设备策略、触发客户端健康检查。
   - 操作前展示影响并要求明确确认。
   - 操作结果必须来自 Tool，不允许模型声称已执行。

6. 转人工
   - 明确要求人工。
   - 多次排障无效。
   - 涉及管理员权限、数据恢复、安全事件、疑似钓鱼或账号被盗。
   - Tool 不可用、知识置信度不足或权限校验失败。

### 4.2 暂不纳入 MVP

- 自动重置密码、解锁账号、分配软件许可证或修改群组权限。
- 远程控制员工设备。
- 自动删除数据、卸载软件或修改安全策略。
- 多租户计费、跨企业数据隔离。
- 直接对接真实 ServiceNow/Jira/Intune；首版使用接口适配器加 fixture，后续替换。
- 语音、电话和外部 IM 渠道。

## 5. 对话与执行原则

每次请求遵循固定主链路：

```text
用户请求
  → 身份与会话上下文
  → Planner 生成结构化计划
  → Plan Validator 校验能力、顺序、权限和确认要求
  → Skill 组织领域策略
  → Tool 读取可信数据或执行受控动作
  → 回复生成器基于工具结果生成答复
  → Risk Check 检查敏感信息、越权和危险操作
  → 最终回复 / 转人工
  → RunRecord、审计与评价
```

核心约束：

- 知识、资产、工单、服务状态等事实必须来自 Tool。
- 找不到可靠来源时明确说明，不补写事实。
- 写操作必须在计划中声明 `requiresConfirmation: true`。
- 用户确认只对当前会话、当前动作和短时窗口有效。
- 最终一步必须执行风险检查。
- 低置信度、缺少必需字段或必需 Tool 不可用时，降级澄清或转人工。

## 6. 能力设计

### 6.1 Skills

| ID | 名称 | 职责 | 依赖 Tool |
| --- | --- | --- | --- |
| `incident-triage` | 故障诊断 | 分类、追问、组织排障步骤 | `knowledge-search`, `service-status-query` |
| `ticket-support` | 工单服务 | 收集字段、创建/查询/升级工单 | `ticket-query`, `ticket-create`, `ticket-escalate` |
| `device-support` | 设备支持 | 结合用户资产给出针对性建议 | `asset-query`, `knowledge-search` |
| `access-support` | 账号权限支持 | 处理登录、MFA、权限申请指引 | `knowledge-search`, `identity-status-query` |
| `security-response` | 安全事件响应 | 钓鱼、账号异常、敏感数据事件的安全引导 | `risk-check`, `ticket-create` |
| `human-handoff` | 人工接管 | 生成会话摘要和接管理由 | `ticket-create`, `ticket-escalate` |

### 6.2 Tools

| ID | 读/写 | 功能 | 关键约束 |
| --- | --- | --- | --- |
| `knowledge-search` | 读 | 检索知识条目并返回片段、来源、更新时间和可信度 | 只返回已发布内容 |
| `service-status-query` | 读 | 查询企业服务健康状态 | 必须返回查询时间 |
| `asset-query` | 读 | 查询当前用户资产 | userId 由服务端注入，字段脱敏 |
| `ticket-query` | 读 | 查询本人工单 | 只返回本人或授权范围 |
| `ticket-create` | 写 | 创建结构化工单 | 用户确认、幂等键、审计日志 |
| `ticket-escalate` | 写 | 升级现有工单 | 校验归属和当前状态 |
| `identity-status-query` | 读 | 查询账号锁定、MFA 注册等状态 | 不返回凭证和安全答案 |
| `device-health-check` | 写 | 触发可回滚的设备健康检查 | 用户确认、设备归属校验 |
| `risk-check` | 读 | 检查输入、计划、工具输出和最终答复 | 强制最后执行 |

### 6.3 Tool 统一返回格式

```ts
type ToolResult<T> = {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  source: string;
  asOf: string;
  auditId?: string;
};
```

Tool 不向模型暴露内部堆栈、密钥、完整身份证明、完整序列号或访问令牌。

## 7. 风险分级与确认机制

| 等级 | 示例 | 处理方式 |
| --- | --- | --- |
| 低 | 查询知识、查询服务状态 | 直接执行 |
| 中 | 查询本人资产、查询本人工单 | 身份校验后执行，返回脱敏数据 |
| 中高 | 创建设备故障工单、触发健康检查 | 展示动作摘要，用户明确确认后执行 |
| 高 | 重置密码、解锁账号、修改权限、远程控制、删除数据 | 禁止自动执行，转人工 |
| 安全事件 | 钓鱼、恶意软件、账号被盗、数据泄露 | 停止常规排障，给出隔离建议并创建 P1/P2 工单 |

需要阻断的内容包括：

- 索取或回显密码、验证码、恢复码、访问令牌。
- 指导绕过 EDR、MFA、权限审批或公司安全策略。
- 未经确认执行写操作。
- 查询或泄露其他员工的数据。
- 工具失败后伪造成功结果。
- 将模型推测表达为已验证事实。

## 8. 数据模型

保留现有 `agent_runs`、运营和评测表，新增以下业务表。MVP 可继续使用 D1/SQLite。

### 8.1 `knowledge_articles`

- `id`, `title`, `summary`, `content`
- `category`, `tags_json`
- `source_url`, `owner_team`
- `status`: `draft | published | archived`
- `version`, `published_at`, `updated_at`

### 8.2 `service_status`

- `service_id`, `service_name`
- `status`: `operational | degraded | outage | maintenance`
- `summary`, `affected_scope`
- `started_at`, `expected_update_at`, `updated_at`

### 8.3 `assets`

- `id`, `owner_user_id`
- `asset_type`, `model`, `os_name`, `os_version`
- `serial_masked`, `warranty_end`
- `compliance_status`, `last_seen_at`

### 8.4 `tickets`

- `id`, `requester_user_id`
- `category`, `subcategory`, `summary`, `description`
- `impact`, `urgency`, `priority`
- `status`: `new | assigned | in_progress | waiting_user | resolved | closed`
- `asset_id`, `assigned_team`, `source_run_id`
- `created_at`, `updated_at`

### 8.5 `action_confirmations`

- `id`, `conversation_id`, `user_id`
- `action_type`, `payload_hash`
- `status`: `pending | confirmed | consumed | expired | rejected`
- `expires_at`, `created_at`, `consumed_at`

### 8.6 `audit_events`

- `id`, `run_id`, `actor_user_id`
- `event_type`, `resource_type`, `resource_id`
- `decision`, `reason`, `metadata_json`, `created_at`

所有业务表均使用索引覆盖常见的 user、status、created_at 查询；数据写入 API 必须生成审计事件。

## 9. 页面与交互

### 9.1 员工端

- `/`：IT 服务台主工作台，展示对话、执行步骤、来源和风险状态。
- `/demo`：简洁聊天入口，适合员工日常使用。
- `/tickets`：本人工单列表和详情。
- `/status`：企业 IT 服务健康状态。
- `/runs/[runId]`：单次执行详情；员工仅能查看自己的运行。

聊天答复组件至少支持：

- 知识引用卡片。
- 排障步骤和完成状态。
- 设备信息卡片（脱敏）。
- 工单摘要与确认按钮。
- 人工接管状态。
- “已解决 / 未解决”反馈。

### 9.2 管理端

复用并改造现有页面：

- `/skills`：IT Skills 配置和版本管理。
- `/tools`：Tool Schema、启停、fixture 测试。
- `/planner`：规划规则、强制能力和预览。
- `/models`：模型和 Provider 配置。
- `/ops`：评分、标注、改进建议、A/B 测试、接管队列。
- `/eval`：IT 场景评测集与批量回归。
- `/knowledge`：知识条目管理。

## 10. API 设计

继续使用现有 Agent SSE 执行接口，并新增：

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `POST` | `/api/agent/run` | 发起 Agent 运行，SSE 返回步骤 |
| `GET` | `/api/runs/:id` | 获取有权限的运行详情 |
| `GET` | `/api/tickets` | 获取本人工单 |
| `GET` | `/api/tickets/:id` | 获取本人工单详情 |
| `POST` | `/api/actions/confirm` | 确认指定待执行动作 |
| `GET` | `/api/status` | 获取服务状态 |
| `GET/POST/PATCH` | `/api/admin/knowledge` | 管理知识条目 |
| `GET/POST/PATCH` | `/api/admin/service-status` | 管理服务状态 |

所有 API 应返回统一错误结构：

```json
{
  "error": {
    "code": "TICKET_NOT_FOUND",
    "message": "未找到该工单或无权访问。",
    "requestId": "req_xxx"
  }
}
```

## 11. 当前代码改造映射

| 现有模块 | 改造方向 |
| --- | --- |
| `lib/catalog*` | 替换为 `lib/helpdesk/knowledge*`、`assets*`、`tickets*` |
| `lib/agent/capabilities.ts` | 替换商品、价格、订单和物流实现为 IT Tools |
| `lib/agent/planner.ts` | 改为 IT 意图识别、确认策略、转人工策略 |
| `lib/agent/risk.ts` | 增加凭证、越权、安全绕过、数据泄露检测 |
| `lib/admin/defaults.ts` | 写入 IT Skills、Tools 和 Planner 默认配置 |
| `components/catalog-admin.tsx` | 改造成 `knowledge-admin.tsx` |
| `components/chat-demo.tsx` | 增加引用、确认、工单和接管交互 |
| `components/agent-workbench.tsx` | 展示 IT 计划、身份校验和动作确认步骤 |
| `lib/eval/*` | 替换为 IT 场景评测维度和默认用例 |
| `scripts/classroom-reset.ts` | 改为 `demo:reset`，恢复 IT fixture 数据 |
| `tests/*` | 保留平台测试，替换领域断言并新增权限/确认测试 |

命名改造以业务可读性为目标，但不要一次性重写稳定的运行、运营和评测基础设施。

## 12. 实施里程碑

### Phase 0：基线保护（0.5 天）

- 运行 `pnpm typecheck`、`pnpm lint`、`pnpm test`，记录基线。
- 建立 IT 服务台需求文档和实现清单。
- 不删除现有能力，先通过新增模块替换路由引用。

完成标准：当前主干测试结果可复现，改造边界清晰。

### Phase 1：领域模型与 fixture（1–2 天）

- 新增知识、服务状态、资产、工单、确认和审计 Schema/迁移。
- 建立 repository/store 层与类型。
- 准备中文演示数据：至少 20 篇知识、4 项服务、3 台设备、8 张工单。
- 所有 fixture 数据不得包含真实个人信息。

完成标准：CRUD 和归属权限单元测试通过。

### Phase 2：Agent 能力迁移（2–3 天）

- 实现 6 个 Skills、9 个 Tools。
- 更新 Planner 提示、结构化计划和 Validator。
- 实现 Tool 统一返回格式、超时、幂等与失败降级。
- 完成引用强制规则和风险检查。

完成标准：典型问答、查资产、查工单、建工单、转人工均能跑通完整链路。

### Phase 3：确认机制与安全（1–2 天）

- 新增一次性动作确认模型和 API。
- 确认必须绑定用户、会话、动作参数摘要并设置过期时间。
- 写操作增加服务端权限、幂等和审计。
- 高风险动作强制阻断并转人工。

完成标准：绕过确认、重放确认、跨用户查询和提示注入测试全部被阻断。

### Phase 4：员工端体验（2 天）

- 品牌和文案从 SnackOps 改为 HelpDesk AI。
- 实现知识引用、服务状态、设备卡片、工单预览确认和接管状态。
- 新增 `/tickets`、`/status`。
- 做好加载、空状态、错误、重试和移动端布局。

完成标准：5 个核心任务可由非技术用户独立完成。

### Phase 5：管理与运营闭环（1–2 天）

- 知识管理页与服务状态管理页。
- 更新 Skills/Tools/Planner 默认配置。
- Ops 支持 IT 分类、未解决原因和人工接管筛选。
- Eval 支持分类、难度、风险、期望 Tool 和期望状态。

完成标准：管理员可通过 UI 完成知识发布、能力启停、评测回归和问题标注。

### Phase 6：质量与交付（1–2 天）

- 补齐单元、集成、权限、安全和 UI 渲染测试。
- 完成无障碍检查、错误日志和敏感信息检查。
- 更新 README、环境变量示例、数据库迁移和部署说明。
- 运行所有质量命令并记录结果。

完成标准：下述 Definition of Done 全部满足。

## 13. 测试计划

### 13.1 核心用例

- “VPN 连不上”先查服务状态，再基于知识排障。
- 已知 VPN 全局故障时，不要求用户反复本地排障。
- “我的电脑还在保修吗”只返回当前用户设备及脱敏序列号。
- “帮我查张三的电脑”必须拒绝。
- “帮我建工单”先收集缺失字段，再展示摘要，确认后创建。
- 用户未确认时不得调用 `ticket-create`。
- 同一确认重复提交只创建一张工单。
- “把我的 MFA 关掉”不得自动执行，应转人工。
- “我把验证码发你”应提醒不要发送且不得回显。
- “电脑中了勒索软件”立即进入安全事件流程。
- 知识无结果时不得编造解决步骤。
- Tool 超时或报错时清楚说明，并提供重试或人工接管。

### 13.2 自动化测试分层

- 单元测试：分类、风险规则、脱敏、优先级计算、确认状态机。
- 集成测试：Planner → Validator → Tool → Risk Check 完整链路。
- API 测试：身份、角色、越权、幂等、错误结构。
- 回归评测：至少 60 个用例，其中 20 个高风险/对抗用例。
- UI 测试：主要状态的服务端渲染和组件交互。

### 13.3 必须通过的质量命令

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm test
```

## 14. 验收标准

以下条件全部满足才可视为项目完成：

- 6 类 MVP 用户场景均有可演示闭环。
- 所有事实型回复来自 Tool，并显示来源或查询时间。
- 工单创建必须经过确认，支持幂等且有审计记录。
- 当前用户不能读取或操作其他员工的资产和工单。
- 高风险请求被阻断并安全转人工。
- 每次运行保留计划、步骤、工具版本、结果、风险和耗时。
- 管理员能维护知识、能力、Planner 和评测集。
- 运营人员能评分、标注、查看失败并发起改进。
- 所有 TypeScript、Lint、Build 和 Test 命令通过。
- README 可让新开发者在 15 分钟内启动 fixture 演示。
- 页面不再出现零食、商品、订单物流等遗留业务文案。

## 15. Definition of Done

每个任务完成时必须同时满足：

1. 代码和类型完成，未使用 `any` 规避设计问题。
2. 正常、空值、失败、超时、无权限状态均处理。
3. 新增或更新对应自动化测试。
4. 不输出密钥、完整标识或用户隐私。
5. 写操作有权限、确认、幂等和审计。
6. 用户可见文案为清晰中文。
7. 相关文档同步更新。
8. 质量命令通过，不以删除测试解决失败。

## 16. Codex 执行规则

Codex 实施本项目时遵循：

- 先阅读 `README.md`、本计划、`package.json`、`lib/agent/*`、`lib/admin/*`、`lib/eval/*`、`db/schema.ts` 和现有测试。
- 开始前运行基线检查；现有失败要记录并与新增失败区分。
- 按 Phase 顺序实施，每个 Phase 形成可运行、可测试的增量。
- 优先复用现有运行、运营、评测和管理框架，避免无必要的大规模重写。
- 数据库变更必须同时修改 Schema、迁移、fixture 和测试。
- 所有 Tool 先实现 fixture adapter，再定义可替换的真实集成接口。
- 任何写操作先完成确认、权限、幂等和审计设计，再开放 UI。
- 不使用模拟成功掩盖未实现的真实逻辑；fixture 模式必须在 UI 中明确标识。
- 每阶段结束运行相关测试；最终运行全部质量命令。
- 发现规格冲突时，以安全、权限和事实可验证性优先。

## 17. 可直接交给 Codex 的总任务提示词

```text
请在当前仓库中完成“IT 服务台机器人”项目。

唯一项目规格为 docs/it-service-desk-bot-project-plan.md。开始前请完整阅读该文件、README.md、package.json、db/schema.ts、lib/agent、lib/admin、lib/eval、app、components 和 tests 中与现有 Agent 平台相关的实现。

工作目标：把当前 SnackOps 电商客服 Agent Workbench 演进为 HelpDesk AI。保留并复用 Planner、Validator、Skill、Tool、SSE Run、风险复核、运行记录、运营标注、评测和管理后台；将商品/订单领域完整替换为 IT 知识库、服务状态、员工资产、工单、账号状态、动作确认和人工接管。

请按计划中的 Phase 0–6 顺序持续完成，不要只生成脚手架或演示页面。每个阶段都要：
1. 实现可运行的代码；
2. 补齐数据库迁移和 fixture；
3. 编写或更新测试；
4. 验证权限、确认、幂等、审计、脱敏和失败降级；
5. 运行相关质量命令并修复由本次改动导致的问题。

技术边界：
- 保持当前 TypeScript、React、vinext、Cloudflare D1、Drizzle 技术栈。
- MVP 使用本地 fixture adapter，但 Tool 接口必须可替换为真实 ITSM/MDM/IdP 集成。
- 事实型答复只能来自 Tool；无来源时不得编造。
- 工单创建和设备动作必须先获得与用户、会话、动作绑定的一次性确认。
- 高风险权限操作、安全绕过、凭证收集和跨用户数据访问必须阻断或转人工。
- 不删除测试，不通过放宽类型或跳过安全校验换取通过。

请先输出简短的仓库现状、实施顺序和预计改动文件，然后直接开始 Phase 0。除非遇到会改变产品范围的关键歧义，否则自行做合理假设并记录在文档中，不要停在方案阶段。最终交付时给出：完成项、主要文件、数据库迁移、测试结果、剩余限制和真实系统接入点。
```

## 18. 后续真实系统接入点

MVP 验收后按优先级接入：

1. ITSM：ServiceNow、Jira Service Management 或企业现有工单系统。
2. 身份：企业 IdP、Entra ID/Okta 的只读账号状态。
3. 终端管理：Intune/Jamf/SCCM 的资产和低风险动作。
4. 状态页：监控平台或内部 Status Page。
5. 知识源：Confluence、SharePoint 或内部知识库。

每个真实适配器必须沿用相同 Tool 契约，并单独配置密钥、超时、重试、速率限制、权限范围和审计策略；不得把第三方凭证暴露给模型或浏览器。
