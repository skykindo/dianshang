# SnackOps Agent Workbench

SnackOps 将 Planner、Plan Validator、Skill、Tool、LLM 回复生成和最终风险复核串成同一条可观测主链路。运行通过 SSE 逐步返回，并以 RunRecord 写入 D1。

## Provider 配置

- `LLM_PROVIDER=coze`：需要 `COZE_API_TOKEN` 和 `LLM_MODEL`，通过 `coze-coding-dev-sdk` 调用。
- `LLM_PROVIDER=deepseek`：需要 `DEEPSEEK_API_KEY`；默认使用官方 `https://api.deepseek.com` 和 `deepseek-flash`，也可通过 `DEEPSEEK_BASE_URL`、`DEEPSEEK_MODEL` 覆盖。
- `LLM_PROVIDER=classroom-fixture`：无外部密钥的确定性课堂演示。fixture 仍经过 Planner、Validator、Skill/Tool、回复生成与 risk-check。

显式设置的 `LLM_PROVIDER` / `LLM_MODEL` 优先于管理页中的持久化配置；环境变量生效时，管理页切换会提示当前 Provider 仍被环境锁定。

真实 Provider 缺失配置时会返回结构化中文错误，不会自动降级到 fixture。复制 `.env.example` 后按需填写。
模型调用默认在 30 秒后超时，可通过 `LLM_PROVIDER_TIMEOUT_MS` 调整（允许 100–120000 毫秒）。

## 公开作品集模式

线上页面与 API 均允许匿名访问，工作台、演示页、运营中心、评测中心和配置页面可以直接作为作品集展示。公开部署建议设置 `LLM_PROVIDER=classroom-fixture`，避免访客消耗真实模型额度；如需接入真实 Provider，应先增加限流、配额和滥用防护。

## 开发与验证

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm lint
pnpm build
pnpm test
```

工作台为 `/`，简化聊天页为 `/demo`，运行详情为 `/runs/[runId]`，运营闭环位于 `/ops`，真实 Agent 评测位于 `/eval`，课堂商品与订单基础数据位于 `/catalog`。管理后台包含 `/skills`、`/tools`、`/planner` 和 `/models`；所有保存、测试、预览和 Provider 切换都通过服务端 API 完成。

## 课堂重置

```bash
pnpm classroom:reset
```

该命令只针对项目本地 Wrangler D1，用单个 SQLite `BEGIN IMMEDIATE/COMMIT` 事务恢复默认评测集、Skill、Tool、Planner 和 fixture Provider，并清空 Skill 版本、批次、评分、标注、改进与 A/B 数据。商品、订单和 `agent_runs` 保留。命令会拒绝 `NODE_ENV=production` 或 `CF_PAGES=1` 环境，项目不提供浏览器 reset API。自定义本地测试库可使用：

```bash
pnpm classroom:reset -- --db /absolute/path/to/local.sqlite
```

首次访问相关 API 时会在 D1 自动创建 `agent_runs`、`admin_config` 和 `skill_versions` 表，同时保留 `drizzle/0000_agent_runs.sql` 与 `drizzle/0001_admin_config.sql` 供正式迁移使用。模型配置 API 只返回密钥是否就绪，不会返回密钥原文。

## Starter 说明

A clean full-stack starter running on
[vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and
Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

This starter does not use `wrangler.jsonc`.

## Included Shape

- edit site code under `app/`
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/schema.ts` starts intentionally empty
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

Signed-in visitors receive both `oai-authenticated-user-id` and `oai-authenticated-user-email`. Private Sites require every visitor to sign in; public Sites may also have anonymous visitors, for whom neither header is present.

The user ID is stable for the same user on the same Site and different across Sites. Email and name are intended for display or contact purposes.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the vinext build output
- `npm test`: build the starter and verify its rendered loading skeleton
- `npm run db:generate`: generate Drizzle migrations after schema changes

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
