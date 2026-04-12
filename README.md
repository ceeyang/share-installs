# share-installs

[中文](README.zh.md) | English

Open-source, self-hosted **invite & deferred deep link attribution** system.

When a user clicks an invite link and installs your app, the invite code is automatically resolved on first launch — even if the app wasn't installed when the link was clicked.

---

## How It Works

```
User A shares invite link
        │
        ▼
User B clicks link → Landing page (your site)
        │  JS SDK uploads browser fingerprint to backend
        ▼
Redirect to App Store / Play Store
        │
        ▼
User B installs & opens app → Mobile SDK (iOS/Android)
        │  sends device fingerprint to backend
        ▼
Backend matches fingerprints → returns invite code
        │
        ▼
App auto-fills invite code ✓
```

---

## Project Structure

```
share-installs/
├── backend/          # Express + Prisma + Redis REST API
├── sdk/
│   ├── ios/          # Swift SDK (SPM + CocoaPods)
│   ├── android/      # Kotlin SDK
│   └── js/           # TypeScript Web SDK (npm)
├── landing/          # Next.js invite landing page (optional)
├── docs/             # Architecture & integration guides
├── infrastructure/
│   ├── k8s/          # Kubernetes manifests
│   └── terraform/    # AWS infrastructure (EKS + RDS + ElastiCache)
├── test/             # Local test server & test page
├── docker-compose.yml
└── docker-compose.dev.yml
```

---

## Quick Start — Docker

The fastest way to run the full backend locally.

**Prerequisites:** Docker Desktop installed and running.

```bash
# 1. Clone the repo
git clone https://github.com/ceeyang/share-installs.git
cd share-installs

# 2. (Optional) configure environment variables
#    All have sensible defaults for local testing
cp backend/.env.example backend/.env
# Edit backend/.env as needed

# 3. Start all services (backend + PostgreSQL + Redis)
docker compose up --build

# Backend is now available at http://localhost:3000
# PostgreSQL at localhost:5432
# Redis at localhost:6379
```

**Verify it's running:**
```bash
curl http://localhost:3000/health
# {"status":"ok","version":"1.0.0","timestamp":"..."}
```

**Stop:**
```bash
docker compose down           # stop containers (data preserved)
docker compose down -v        # stop + delete all data volumes
```

---

## Deployment Modes

### 1. Docker (Recommended for testing & self-hosting)

See [Quick Start](#quick-start--docker) above.

Environment variables can be set directly in `docker-compose.yml` or via a `.env` file in the project root:

```env
# .env (project root, loaded by docker compose automatically)
ADMIN_SECRET=your-secret-here   # protects /v1/projects endpoints; leave empty for open access
CORS_ORIGINS=https://yourapp.com
```

All other variables have sensible defaults. See [Environment Variables Reference](#environment-variables-reference) for the full list.

### 2. Development Mode (Hot-reload)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Source files are mounted into the container. Changes to `backend/src/` trigger automatic restart via `ts-node-dev`.

### 3. 本地调试（推荐：Docker 基础设施 + 本地代码）

最适合日常开发调试：PostgreSQL 和 Redis 跑在 Docker，代码在本机直接运行，享受完整断点调试体验。

**前提：** Docker Desktop 已安装。

```bash
# Step 1：只启动基础设施（数据库 + 缓存）
docker compose up db redis -d

# 验证服务已就绪（看到 "healthy" 后继续）
docker compose ps
```

```bash
# Step 2：配置环境变量
cd backend
cp .env.example .env
# .env 默认值已适配本地调试，无需修改即可运行
```

```bash
# Step 3：安装依赖（首次）
npm install

# Step 4：初始化数据库（首次，或 schema 变更后）
npm run db:generate   # 生成 Prisma client
npx prisma migrate dev --name init
```

```bash
# Step 5：启动后端（热重载）
npm run dev
# 服务运行在 http://localhost:6066
```

**验证：**
```bash
curl http://localhost:6066/health
# {"status":"ok","version":"1.0.0","timestamp":"..."}
```

**停止：**
```bash
# Ctrl+C 停止后端
docker compose down        # 停止基础设施（数据保留）
docker compose down -v     # 停止 + 清除所有数据
```

**常见报错：**

| 错误 | 原因 | 解决 |
|------|------|------|
| `ECONNREFUSED ::1:6379` | Redis 未启动 | `docker compose up redis -d` |
| `Can't reach database server at localhost:5432` | PostgreSQL 未启动 | `docker compose up db -d` |
| `PrismaClientInitializationError` | 未执行迁移 | `npx prisma migrate dev --name init` |
| `Cannot find module '@prisma/client'` | 未生成 client | `npm run db:generate` |

---

### 4. Bare Metal (Node.js + Homebrew)

Requires: Node.js 20+, PostgreSQL 14+, Redis 7+（全部本地安装，无 Docker）。

```bash
# 安装系统依赖（macOS）
brew install postgresql@16 redis
brew services start postgresql@16
brew services start redis

# 创建数据库
createdb share_installs
```

```bash
cd backend
npm install
cp .env.example .env

npm run db:generate
npx prisma migrate dev --name init

# 开发模式（热重载）
npm run dev

# 生产构建
npm run build
npm start
```

### 5. Kubernetes (Production)

Full AWS infrastructure via Terraform + Kubernetes:

```bash
# Provision AWS infrastructure
cd infrastructure/terraform
terraform init
terraform apply \
  -var="environment=production" \
  -var="domain_name=api.yourapp.com" \
  -var="db_password=<secure-password>"

# Deploy via GitHub Actions (push to main triggers CD pipeline)
git push origin main
```

See [`docs/deployment-k8s.md`](docs/deployment-k8s.md) for detailed steps.

---

## Backend API

> **职责边界**：share-installs 只负责指纹收集和匹配。邀请码由你的系统生成和管理，你传给我们，我们存储并在匹配成功时原样返回。跳转商店、邀请码校验、使用次数统计等逻辑由你的系统处理。

All endpoints are prefixed with `/v1`.

### Core Endpoints

| Mode | Auth | Method | Path | Description |
|------|------|--------|------|-------------|
| 自部署 | 无 | `POST` | `/v1/clicks` | Web SDK：提交浏览器指纹 |
| 自部署 | 无 | `POST` | `/v1/resolutions` | 移动 SDK：匹配指纹，返回邀请码 |
| SaaS | `Bearer <api_key>` | `POST` | `/v1/clicks` | 同上，需要 API key |
| SaaS | `Bearer <api_key>` | `POST` | `/v1/resolutions` | 同上，需要 API key |
| 两种 | — | `GET` | `/health` | 健康检查 |

### SaaS 项目管理（需要 `ADMIN_SECRET`）

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/projects` | 创建项目 |
| `GET` | `/v1/projects` | 列出所有项目 |
| `POST` | `/v1/projects/:id/api-keys` | 为项目创建 API key |
| `GET` | `/v1/projects/:id/api-keys` | 列出项目的 API keys |
| `DELETE` | `/v1/projects/:id/api-keys/:keyId` | 撤销 API key |

### POST /v1/clicks — Web SDK 提交指纹

用户点击邀请链接后，由你的落地页调用，记录浏览器指纹。`inviteCode` 是你系统中的邀请码，我们原样存储。

```bash
curl -X POST http://localhost:6066/v1/clicks \
  -H "Content-Type: application/json" \
  -d '{
    "inviteCode": "ABC12345",
    "customData": { "campaign": "summer2024", "inviterId": "user_123" },
    "fingerprint": {
      "timezone": "Asia/Shanghai",
      "languages": ["zh-CN", "zh"],
      "screen": { "w": 390, "h": 844, "dpr": 3 },
      "hardware": { "cores": 6 },
      "ua": "Mozilla/5.0 ..."
    }
  }'
```

Response:
```json
{ "eventId": "clx..." }
```

### POST /v1/resolutions — 移动 SDK 匹配指纹

App 首次启动时调用，匹配成功后返回对应的邀请码。

```bash
curl -X POST http://localhost:6066/v1/resolutions \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "ios",
    "fingerprint": {
      "timezone": "Asia/Shanghai",
      "languages": ["zh-CN"],
      "screen": { "w": 390, "h": 844, "scale": 3 },
      "osVersion": "17.2"
    }
  }'
```

Response（匹配成功）：
```json
{
  "matched": true,
  "inviteCode": "ABC12345",
  "customData": { "campaign": "summer2024", "inviterId": "user_123" },
  "meta": { "confidence": 0.97, "channel": "exact" }
}
```

Response（未匹配）：
```json
{ "matched": false }
```

---

## SDK Integration

> **分工说明**：SDK 只负责指纹收集和提交。跳转商店、展示邀请码等后续逻辑由你的业务代码处理。

### Web / JavaScript

在邀请落地页引入 SDK，用户访问时自动采集浏览器指纹并上报：

```typescript
import { ShareInstallsSDK } from '@share-installs/js-sdk';

const sdk = new ShareInstallsSDK({
  apiBaseUrl: 'https://api.yourapp.com',  // 自部署填写自己的域名
  // apiKey: 'sk_live_...',               // SaaS 模式填写 API key
});

// 从 URL 中提取你系统中的邀请码（你自己生成和管理）
const inviteCode = location.pathname.split('/').pop()!;

// 上报指纹。customData 会在移动端匹配成功时原样返回。
await sdk.trackClick(inviteCode, {
  customData: { campaign: 'summer2024' },
});

// 跳转商店由你的业务代码决定（不在 SDK 职责范围内）
```

### iOS

**Swift Package Manager** (Xcode → Add Package Dependencies):
```
https://github.com/ceeyang/share-installs
```

Initialize in `AppDelegate` or `@main App`:
```swift
import ShareInstallsSDK

ShareInstallsSDK.configure(with: ShareInstallsConfiguration(
    apiBaseURL: URL(string: "https://api.yourapp.com")!
    // apiKey: "sk_live_..."  // SaaS 模式
))
```

App 首次启动（注册完成后）调用 resolve，获取邀请码：
```swift
if let result = try await ShareInstallsSDK.shared.resolveDeferred() {
    // result.inviteCode  — 你系统中的邀请码
    // result.customData  — 落地页传入的自定义数据
    applyInviteCode(result.inviteCode)
}
```

See [`docs/integration/ios.md`](docs/integration/ios.md) for full setup.

### Android

Add dependency:
```kotlin
implementation("com.share-installs:share-installs-sdk-android:1.0.0")
```

Initialize in `Application.onCreate()`:
```kotlin
ShareInstallsSDK.configure(
    context = applicationContext,
    configuration = ShareInstallsConfiguration(
        apiBaseUrl = "https://api.yourapp.com"
        // apiKey = "sk_live_..."  // SaaS 模式
    )
)
```

App 首次启动后调用 resolve：
```kotlin
val result = ShareInstallsSDK.instance.resolveDeferred()
if (result != null) {
    // result.inviteCode  — 你系统中的邀请码
    // result.customData  — 落地页传入的自定义数据
    applyInviteCode(result.inviteCode)
}
```

See [`docs/integration/android.md`](docs/integration/android.md) for full setup.

---

## SDK Testing

Each SDK contains its own unit and integration test suite.

### JavaScript (Web)
```bash
cd sdk/js
npm test
```

### Android
Requires JUnit + Robolectric.
```bash
cd sdk/android
./gradlew test
```

### iOS
Requires XCTest.
```bash
cd sdk/ios
swift test
```

### Cross-Platform Validation
A specialized script is available to verify fingerprint consistency across signals from different platforms:
```bash
npx ts-node scripts/validate_signals.ts
```

---

## Local Testing

A lightweight in-memory test server (no PostgreSQL/Redis required) and a test page are included in `test/`:

```bash
# Start the test server
node test/server.mjs
# Listening on http://localhost:3000

# Open the test page in your browser
open test/test.html
```

The test page lets you upload a browser fingerprint, inspect the result, and simulate a mobile SDK resolve.

---

## Environment Variables Reference

All variables with defaults are optional.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✓ | — | PostgreSQL connection string |
| `REDIS_URL` | ✓ | — | Redis connection string |
| `MULTI_TENANT` | — | `false` | `false` = 自部署模式；`true` = SaaS 模式（需要 API key） |
| `ADMIN_SECRET` | — | _(open)_ | 项目管理端点保护密钥，为空则不鉴权 |
| `PORT` | — | `3000` | HTTP port |
| `HOST` | — | `0.0.0.0` | HTTP bind address |
| `CORS_ORIGINS` | — | `*` | Comma-separated allowed origins |
| `LOG_LEVEL` | — | `info` | `fatal`/`error`/`warn`/`info`/`debug`/`trace` |
| `FINGERPRINT_MATCH_THRESHOLD` | — | `0.75` | 模糊匹配最低置信度阈值（0–1） |
| `FINGERPRINT_MATCH_TTL_HOURS` | — | `72` | Click event 可被匹配的时间窗口（小时） |
| `REDIS_KEY_PREFIX` | — | `si:` | Redis key 前缀 |
| `RATE_LIMIT_WINDOW_MS` | — | `900000` | 限流窗口（毫秒） |
| `RATE_LIMIT_MAX_REQUESTS` | — | `100` | 限流窗口内最大请求数 |

---

## License

Apache 2.0 — see [LICENSE](LICENSE).
