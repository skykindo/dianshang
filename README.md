# SnackOps Agent Workbench

SnackOps 将 Planner、Plan Validator、Skill、Tool、LLM 回复生成和最终风险复核串成一条可观测链路。项目现已迁移为标准 Next.js 应用，可部署到 Vercel；线上持久化使用 PostgreSQL。

## 技术栈

- Next.js 16 App Router
- React 19
- PostgreSQL + Drizzle ORM
- Vercel Functions（包含 SSE 流式回复和后台评测任务）
- DeepSeek、Coze 或无需外部密钥的课堂 fixture

## 本地运行

要求 Node.js `>=22.13.0` 和 pnpm。

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

打开 `http://localhost:3000`。本地未配置 `DATABASE_URL` 时，应用使用进程内存数据，重启后重置；如需验证持久化，请配置一个 PostgreSQL 连接串。

主要页面：

- `/`：Agent 工作台
- `/demo`：客服聊天页
- `/runs/[runId]`：运行详情
- `/ops`：运营闭环
- `/eval`：评测中心
- `/catalog`：商品数据
- `/skills`、`/tools`、`/planner`、`/models`：管理页面

## 环境变量

公开演示建议使用：

```env
LLM_PROVIDER=classroom-fixture
LLM_PROVIDER_TIMEOUT_MS=30000
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
```

使用 DeepSeek：

```env
LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-flash
```

使用 Coze：

```env
LLM_PROVIDER=coze
COZE_API_TOKEN=your_coze_personal_access_token
LLM_MODEL=your_coze_model
COZE_INTEGRATION_BASE_URL=https://api.coze.cn
COZE_INTEGRATION_MODEL_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
```

密钥只配置在 `.env.local` 或 Vercel Environment Variables，不要提交到 Git。

## PostgreSQL

推荐在 Vercel Marketplace 创建 Neon 或 Supabase 数据库，它们会自动注入连接信息。应用兼容标准 `DATABASE_URL`。

应用第一次访问数据库功能时会自动创建缺失表并写入默认课堂数据。也可以显式执行版本化迁移：

```bash
pnpm db:migrate
```

修改 [`db/schema.ts`](./db/schema.ts) 后生成新迁移：

```bash
pnpm db:generate
```

PostgreSQL 迁移文件位于 `drizzle/postgres/`。根目录原有的 SQLite SQL 仅保留为历史和兼容测试资料。

## 部署到 Vercel

1. 将仓库推送到 GitHub，并在 Vercel 中创建一个新项目。
2. Framework Preset 选择 `Next.js`；构建命令使用默认的 `pnpm build`。
3. 在 Vercel Marketplace 创建并连接 PostgreSQL，确认项目环境中存在 `DATABASE_URL`。
4. 在 Production 环境配置模型相关变量。公开作品集建议先使用 `LLM_PROVIDER=classroom-fixture`。
5. 部署成功后，在项目 `Settings → Domains` 添加 `kefu.leon-zuopinji.cn`。
6. 按 Vercel 显示的记录，在腾讯云 DNSPod 新增 `kefu` 的 CNAME；不要修改现有 `@` 或 `www` 记录。

`vercel.json` 将函数区域设置为新加坡 `sin1`，以改善亚洲访问延迟。

## 验证

```bash
pnpm typecheck
pnpm build
pnpm test
```

`pnpm test` 会额外构建一次旧 Worker 兼容测试入口，以复用项目现有的端到端测试；Vercel 生产构建只执行标准 `next build`。

## 上线安全提醒

当前作品集模式允许匿名访问页面和 API，管理接口也尚未区分管理员。若使用真实模型 Provider，公开上线前应增加管理员鉴权、请求限流和调用配额；否则建议保持 `classroom-fixture`，避免访客产生真实模型费用或修改管理数据。
