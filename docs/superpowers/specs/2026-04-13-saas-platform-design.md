# SaaS Platform Design — share-installs Cloud

**Date**: 2026-04-13  
**Updated**: 2026-04-13  
**Status**: Approved  
**Author**: Claude + ceeyang

---

## 1. 目标与范围

将 share-installs 从纯开源工具扩展为**开源 + 云托管双轨**产品：

- **自部署**：代码完全开源（Apache 2.0），任何人免费 self-host，无 API Key，无限制
- **云托管**：平台运营者托管服务，用户自助注册、创建 App、获取 API Key，按月订阅计费

本 Spec 仅涵盖**云托管侧的新增内容**，不修改现有 SDK API 的核心逻辑。

---

## 2. 订阅计划

### 2.1 三档方案

| | Free | Pro | Unlimited |
|--|------|-----|-----------|
| **月费** | $0 | $19/月 | $99/月 |
| **有效安装量/月** | ≤ 500 | ≤ 10,000 | 无限制 |
| **有效安装量/天** | ≤ 20 | 不限 | 不限 |
| **App 数量** | 1 | 5 | 无限制 |
| **API Key 数量/App** | 2 | 10 | 无限制 |
| **数据保留** | 7 天 | 90 天 | 1 年 |
| **适合场景** | 开发测试 | 上线产品 | 大规模商业 |

> **Free 同时受日限和月限约束**：月内某天超过 20 次有效安装，当天后续请求返回 429，次日重置。月累计超过 500 次，当月剩余时间全部 429，次月重置。

### 2.2 限流设计

限流基于 **有效安装（Conversion）** 计数，点击（Click）不计入限额。

**计数存储**：Redis，Key 设计：

```
si:quota:{appId}:daily:{YYYY-MM-DD}   → 当日安装数，TTL 48h
si:quota:{appId}:monthly:{YYYY-MM}    → 当月安装数，TTL 35d
```

**执行时机**：在 `fingerprintService.recordConversion()` 写入 DB **之前**检查配额，超额返回错误，SDK 收到 `402 Payment Required`。

**配额响应**：

```json
HTTP 402
{
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "Monthly install quota exceeded. Upgrade to Pro.",
    "plan": "free",
    "limit": 500,
    "used": 500,
    "resetAt": "2026-05-01T00:00:00Z"
  }
}
```

> 注：402 对 SDK 来说是静默失败（不影响用户体验），App 不返回邀请码，视为未匹配。

### 2.3 计划数据模型

```prisma
enum Plan {
  FREE
  PRO
  UNLIMITED
}

model User {
  // ...现有字段...
  plan           Plan      @default(FREE)
  planExpiresAt  DateTime? @map("plan_expires_at")  // null = 永久（Unlimited）
  // 月订阅场景：每次付款成功后更新为下月同日
}
```

计划附在 **User** 上（一个用户下所有 App 共享同一套配额），未来可升级为 App 级别独立计划。

### 2.4 配额常量（可配置）

```typescript
export const PLAN_LIMITS = {
  FREE: {
    dailyInstalls: 20,
    monthlyInstalls: 500,
    maxApps: 1,
    maxKeysPerApp: 2,
    dataRetentionDays: 7,
  },
  PRO: {
    dailyInstalls: Infinity,
    monthlyInstalls: 10_000,
    maxApps: 5,
    maxKeysPerApp: 10,
    dataRetentionDays: 90,
  },
  UNLIMITED: {
    dailyInstalls: Infinity,
    monthlyInstalls: Infinity,
    maxApps: Infinity,
    maxKeysPerApp: Infinity,
    dataRetentionDays: 365,
  },
} as const;
```

---

## 3. 系统架构

```
┌─────────────────────────────────────────────────────┐
│  Cloudflare Pages（免费）                            │
│  静态管理前端 dashboard/                             │
│  - GitHub OAuth 登录                                 │
│  - App 创建 / API Key 管理                           │
│  - 用量统计看板                                       │
└────────────────────┬────────────────────────────────┘
                     │ HTTPS API
┌────────────────────▼────────────────────────────────┐
│  VPS（Hetzner CX22, ~€4/月）                         │
│  Docker Compose                                      │
│                                                      │
│  ┌──────────────┐  ┌──────────┐  ┌───────────────┐  │
│  │  Backend     │  │ Postgres │  │     Redis     │  │
│  │  Node.js     │  │   :5432  │  │     :6379     │  │
│  │  :3000       │  └──────────┘  └───────────────┘  │
│  │              │                                    │
│  │  SDK API     │  ← 现有，不动                      │
│  │  Dashboard   │  ← 新增                           │
│  │  API         │                                    │
│  └──────────────┘                                    │
│                                                      │
│  Caddy（自动 SSL + 反向代理）                         │
└─────────────────────────────────────────────────────┘
```

---

## 3. 数据模型变更

### 3.1 新增表

**User**（平台用户）

```prisma
model User {
  id          String   @id @default(cuid())
  githubId    String   @unique @map("github_id")
  githubLogin String   @map("github_login")
  email       String?
  avatarUrl   String?  @map("avatar_url")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  apps        App[]

  @@map("users")
}
```

### 3.2 Project → App 重命名

现有 `Project` 模型**重命名为 `App`**，语义更贴合用户心智，同时新增 `userId` 外键。

```prisma
model App {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  name      String
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  user        User         @relation(fields: [userId], references: [id])
  apiKeys     ApiKey[]
  clickEvents ClickEvent[]
  conversions Conversion[]

  @@map("apps")
}
```

**迁移说明**：
- 数据库层面 `projects` 表重命名为 `apps`
- 所有外键 `project_id` 列名**保持不变**（避免大规模 migration）
- Prisma model 名从 `Project` → `App`，代码层引用同步更新
- 现有 `projectId` 字段语义不变，仅 model 名变化

### 3.3 ApiKey 变更

现有 `ApiKey` 无需结构变更，`projectId` → `appId`（仅 Prisma 层命名）。

---

## 4. 认证体系

### 4.1 GitHub OAuth 流程

```
用户点击"Login with GitHub"
  → GET /auth/github
  → 302 → github.com/login/oauth/authorize?client_id=...&scope=read:user,user:email
  → 用户授权
  → GET /auth/github/callback?code=xxx
  → 后端用 code 换 access_token
  → 调用 GitHub API 获取用户信息（id, login, email, avatar_url）
  → upsert User 记录
  → 生成 JWT（有效期 7 天）
  → Set-Cookie: session=<jwt>; HttpOnly; Secure; SameSite=Lax
  → 302 → /dashboard
```

### 4.2 JWT Payload

```typescript
{
  sub: string,      // User.id (cuid)
  githubLogin: string,
  iat: number,
  exp: number       // 7天
}
```

### 4.3 Dashboard 中间件

所有 `/dashboard/*` 路由使用 `requireSession` 中间件：

```typescript
// 从 cookie 验证 JWT，注入 req.userId
function requireSession(req, res, next): void
```

---

## 5. Dashboard API 端点

**Base path**: `/dashboard`  
**Auth**: 全部需要 `requireSession` cookie

### 5.1 用户

```
GET /dashboard/me
→ { id, githubLogin, email, avatarUrl, createdAt }
```

### 5.2 App 管理

```
GET /dashboard/apps
→ App[]（仅当前用户的）

POST /dashboard/apps
Body: { name: string }
→ App

DELETE /dashboard/apps/:appId
→ 204（同时软删除相关 ApiKey）
```

### 5.3 API Key 管理

```
GET /dashboard/apps/:appId/keys
→ ApiKeyInfo[]（id/name/prefix/createdAt/revokedAt）

GET /dashboard/apps/:appId/keys/:keyId/reveal
→ { key: "sk_live_xxx" }  ← 解密后返回，可多次调用

POST /dashboard/apps/:appId/keys
Body: { name: string }
→ { id, name, prefix, key: "sk_live_xxx" }

DELETE /dashboard/apps/:appId/keys/:keyId
→ 204（设置 revokedAt，软删除）
```

**存储方式**：API Key 同时存储 Hash（用于鉴权查找）和 AES-256-GCM 加密值（用于展示）。

```prisma
model ApiKey {
  id           String    @id @default(cuid())
  appId        String    @map("app_id")      // 对应 App.id
  name         String
  keyHash      String    @unique @map("key_hash")      // SHA-256，用于鉴权
  keyEncrypted String    @map("key_encrypted")          // AES-256-GCM，用于展示
  prefix       String                                   // 前12字符，用于 DB 索引
  createdAt    DateTime  @default(now())
  revokedAt    DateTime? @map("revoked_at")

  @@index([prefix])
}
```

加密使用服务器端 `ENCRYPTION_KEY` 环境变量（32字节随机 hex），密钥和 DB 需同时泄露才能还原明文。

### 5.4 用量统计

```
GET /dashboard/apps/:appId/stats?from=ISO8601&to=ISO8601
→ {
    totalClicks: number,          // 点击次数
    totalInstalls: number,        // 有效安装（Conversion 数）
    byChannel: {
      exact: number,
      fuzzy: number,
      clipboard: number
    },
    byPlatform: {
      ios: number,
      android: number
    },
    dailySeries: [
      { date: "2026-04-01", clicks: n, installs: n }
    ]
  }
```

### 5.5 配额状态

```
GET /dashboard/me/quota
→ {
    plan: "free" | "pro" | "unlimited",
    planExpiresAt: string | null,
    monthly: {
      limit: number,          // 500 / 10000 / null
      used: number,
      resetAt: string         // 下月1日 00:00 UTC
    },
    daily: {
      limit: number | null,   // 20 / null / null
      used: number,
      resetAt: string         // 明日 00:00 UTC
    }
  }
```

---

## 6. 前端管理界面

**部署**：Cloudflare Pages（免费，静态托管）  
**框架**：Vue 3 + Vite（或纯 HTML/JS，按开发者喜好）  
**目录**：`dashboard/`（独立于现有 `backend/` 和 `sdk/`）

### 页面结构

```
/                   → 登录页（GitHub OAuth 按钮）
/dashboard          → App 列表
/dashboard/apps/new → 创建 App
/dashboard/apps/:id → App 详情
  └─ Keys 标签页    → API Key 列表 + 生成
  └─ Stats 标签页   → 用量图表
```

### 关键 UI 原则

- API Key 明文**只在生成时显示一次**，附带复制按钮和警告文案
- Stats 默认显示最近 30 天数据
- 响应式设计，移动端可用

---

## 7. 模块划分（供协作开发）

以下模块相互独立，可并行开发：

### Module 1 — 数据库 Migration
**文件**: `backend/prisma/`  
**内容**:
- 新增 `User` 表（含 `plan`、`planExpiresAt` 字段）
- `projects` → `apps` 重命名（保留 `project_id` 列名）
- 新增 `Plan` enum（FREE / PRO / UNLIMITED）
- Prisma schema 更新，生成 migration 文件

**依赖**: 无  
**输出**: 可运行的 `prisma migrate dev`

---

### Module 2 — GitHub OAuth + Session
**文件**: `backend/src/auth/`  
**内容**:
- `GET /auth/github` → redirect to GitHub
- `GET /auth/github/callback` → code 换 token → upsert User → set JWT cookie
- `GET /auth/logout` → clear cookie
- `requireSession` 中间件（注入 `req.userId`）
- JWT 签发/验证工具函数

**依赖**: Module 1（User 表）  
**环境变量**:
```
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
JWT_SECRET=
FRONTEND_URL=https://dashboard.yourdomain.com
```

---

### Module 3 — 配额执行（Quota Guard）
**文件**: `backend/src/services/quotaService.ts`  
**内容**:
- `checkAndIncrementQuota(appId, userId)` — 检查日/月限额，超额返回错误
- Redis 计数器读写（`si:quota:{appId}:daily:*` / `si:quota:{appId}:monthly:*`）
- `PLAN_LIMITS` 常量定义
- 集成到 `fingerprintService.recordConversion()` 调用前

**依赖**: Module 1（plan 字段）  
**注意**: 此模块影响核心 SDK 流程，需单独测试

---

### Module 4 — Dashboard API
**文件**: `backend/src/controllers/dashboardController.ts`  
**内容**:
- `GET /dashboard/me`
- `GET /dashboard/me/quota` — 配额状态
- `/dashboard/apps` CRUD（含 App 数量上限校验）
- `/dashboard/apps/:id/keys` CRUD（含 Key 数量上限校验）
- `GET /dashboard/apps/:id/stats`

**依赖**: Module 1 + Module 2 + Module 3  
**注意**: 所有查询必须过滤 `userId`，防止越权访问

---

### Module 5 — 前端管理界面
**文件**: `dashboard/`（独立目录）  
**内容**:
- GitHub 登录页
- App 列表 + 创建
- API Key 管理（明文仅显示一次）
- 用量看板：已用 / 上限进度条、日系列图表
- 计划标识 + 升级入口（升级逻辑本期不实现，仅展示）

**依赖**: Module 4 API 可用  
**部署**: Cloudflare Pages，`VITE_API_BASE_URL` 指向后端

---

### Module 6 — 路由注册 + 集成
**文件**: `backend/src/routes/index.ts`  
**内容**:
- 注册 `/auth/*` 路由
- 注册 `/dashboard/*` 路由（带 `requireSession`）
- CORS 配置：允许 Cloudflare Pages 域名
- 更新 `MULTI_TENANT` 模式说明

**依赖**: Module 2 + Module 4

---

## 8. 环境变量汇总

```bash
# 现有
DATABASE_URL=
REDIS_URL=
MULTI_TENANT=true
ADMIN_SECRET=
FINGERPRINT_MATCH_TTL_HOURS=72

# 新增
JWT_SECRET=              # Dashboard session 签名，32字节随机字符串
ENCRYPTION_KEY=          # API Key 加密存储，32字节随机 hex（openssl rand -hex 32）
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
FRONTEND_URL=https://dashboard.yourdomain.com
```

---

## 9. 部署方案

### Docker Compose（完整）

```yaml
version: "3.9"
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: shareinstalls
      POSTGRES_USER: si
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data

  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql://si:${POSTGRES_PASSWORD}@postgres:5432/shareinstalls
      REDIS_URL: redis://redis:6379
      MULTI_TENANT: "true"
      JWT_SECRET: ${JWT_SECRET}
      GITHUB_CLIENT_ID: ${GITHUB_CLIENT_ID}
      GITHUB_CLIENT_SECRET: ${GITHUB_CLIENT_SECRET}
      FRONTEND_URL: ${FRONTEND_URL}
    depends_on: [postgres, redis]

  caddy:
    image: caddy:2-alpine
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data

volumes:
  pgdata:
  redisdata:
  caddy_data:
```

### Caddyfile

```
api.yourdomain.com {
  reverse_proxy backend:3000
}
```

---

## 10. 未来考虑（不在本期范围）

- 计量计费集成（Stripe / 按安装量出账单）
- 邮箱 + 密码登录
- 团队/多成员共享 App
- Webhook 通知（安装事件推送）
- 用量告警（超出免费额度通知）

---

## 11. 协作分工建议

| 模块 | 推荐分配 | 备注 |
|------|---------|------|
| Module 1（DB Migration） | Gemini | 纯 Prisma，无业务逻辑 |
| Module 2（GitHub OAuth） | Claude | 涉及安全细节，需精确 |
| Module 3（Quota Guard） | Claude | 影响核心 SDK 流程，需精确 |
| Module 4（Dashboard API） | Gemini | CRUD 为主，参照现有 controller 风格 |
| Module 5（前端） | Gemini | 独立目录，不影响后端 |
| Module 6（路由集成） | Claude | 需了解现有路由结构 |

**开发顺序**：Module 1 → Module 2 + Module 3（可并行）→ Module 4 → Module 5 + Module 6（可并行）
