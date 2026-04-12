# share-installs

[English](README.md) | 中文

开源、自托管的**邀请码 & 延迟深度链接归因**系统。

用户点击邀请链接并安装 App 后，首次启动时邀请码会自动识别并回填——即使点击时 App 尚未安装。

---

## 工作原理

```
用户 A 分享邀请链接
        │
        ▼
用户 B 点击链接 → 落地页（你的网站）
        │  JS SDK 上报浏览器指纹到后端
        ▼
跳转 App Store / Play Store
        │
        ▼
用户 B 安装并打开 App → 移动端 SDK（iOS/Android）
        │  上报设备指纹到后端
        ▼
后端匹配指纹 → 返回邀请码
        │
        ▼
App 自动填入邀请码 ✓
```

---

## 项目结构

```
share-installs/
├── backend/          # Express + Prisma + Redis REST API
├── sdk/
│   ├── ios/          # Swift SDK（SPM + CocoaPods）
│   ├── android/      # Kotlin SDK
│   └── js/           # TypeScript Web SDK（npm）
├── landing/          # Next.js 邀请落地页（可选）
├── docs/             # 架构说明 & 集成指南
├── infrastructure/
│   ├── k8s/          # Kubernetes 配置
│   └── terraform/    # AWS 基础设施（EKS + RDS + ElastiCache）
├── test/             # 本地测试服务器 & 测试页面
├── docker-compose.yml
└── docker-compose.dev.yml
```

---

## 快速启动 — Docker

最快的本地运行方式。

**前提：** 已安装并启动 Docker Desktop。

```bash
# 1. 克隆仓库
git clone https://github.com/ceeyang/share-installs.git
cd share-installs

# 2.（可选）配置环境变量，所有变量都有本地测试默认值
cp backend/.env.example backend/.env
# 按需编辑 backend/.env

# 3. 启动所有服务（后端 + PostgreSQL + Redis）
docker compose up --build

# 后端地址：http://localhost:3000
# PostgreSQL：localhost:5432
# Redis：localhost:6379
```

**验证服务正常：**
```bash
curl http://localhost:3000/health
# {"status":"ok","version":"1.0.0","timestamp":"..."}
```

**停止：**
```bash
docker compose down        # 停止容器（数据保留）
docker compose down -v     # 停止 + 删除所有数据卷
```

---

## 部署方式

### 1. Docker（推荐用于测试 & 自部署）

参见上方[快速启动](#快速启动--docker)。

环境变量可直接写在 `docker-compose.yml`，或在项目根目录创建 `.env` 文件（docker compose 自动加载）：

```env
# .env（项目根目录）
ADMIN_SECRET=your-secret-here   # 保护 /v1/projects 端点；留空则不鉴权
CORS_ORIGINS=https://yourapp.com
```

其他变量均有默认值，完整列表见[环境变量说明](#环境变量说明)。

### 2. 开发模式（热重载）

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

源文件以 volume 方式挂载到容器，`backend/src/` 下的改动通过 `ts-node-dev` 自动重启。

### 3. 本地调试（推荐：Docker 基础设施 + 本地代码）

最适合日常开发调试：PostgreSQL 和 Redis 跑在 Docker，代码在本机直接运行，支持完整断点调试。

**前提：** 已安装 Docker Desktop。

```bash
# Step 1：只启动基础设施（数据库 + 缓存）
docker compose up db redis -d

# 确认服务就绪（状态显示 "healthy" 后继续）
docker compose ps
```

```bash
# Step 2：配置环境变量
cd backend
cp .env.example .env
# 默认值已适配本地调试，无需修改即可运行
```

```bash
# Step 3：安装依赖（首次）
npm install

# Step 4：初始化数据库（首次，或 schema 变更后）
npm run db:generate        # 生成 Prisma client
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

### 4. 裸机部署（Node.js + Homebrew）

需要：Node.js 20+、PostgreSQL 14+、Redis 7+（全部本地安装，无 Docker）。

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

### 5. Kubernetes（生产环境）

通过 Terraform + Kubernetes 部署完整 AWS 基础设施：

```bash
# 初始化 AWS 基础设施
cd infrastructure/terraform
terraform init
terraform apply \
  -var="environment=production" \
  -var="domain_name=api.yourapp.com" \
  -var="db_password=<secure-password>"

# 通过 GitHub Actions 部署（push 到 main 自动触发 CD）
git push origin main
```

详细步骤见 [`docs/deployment.md`](docs/deployment.md)。

---

## 后端 API

> **职责边界**：share-installs 只负责指纹收集和匹配。邀请码由你的系统生成和管理，你传给我们，我们存储并在匹配成功时原样返回。跳转商店、邀请码校验、使用次数统计等逻辑由你的系统处理。

所有端点均以 `/v1` 为前缀。

### 核心端点

| 模式 | 鉴权 | 方法 | 路径 | 说明 |
|------|------|------|------|------|
| 自部署 | 无 | `POST` | `/v1/clicks` | Web SDK：提交浏览器指纹 |
| 自部署 | 无 | `POST` | `/v1/resolutions` | 移动 SDK：匹配指纹，返回邀请码 |
| SaaS | `Bearer <api_key>` | `POST` | `/v1/clicks` | 同上，需要 API key |
| SaaS | `Bearer <api_key>` | `POST` | `/v1/resolutions` | 同上，需要 API key |
| 两种 | — | `GET` | `/health` | 健康检查 |

### SaaS 项目管理（需要 `ADMIN_SECRET`）

| 方法 | 路径 | 说明 |
|------|------|------|
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

返回：
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

匹配成功：
```json
{
  "matched": true,
  "inviteCode": "ABC12345",
  "customData": { "campaign": "summer2024", "inviterId": "user_123" },
  "meta": { "confidence": 0.97, "channel": "exact" }
}
```

未匹配：
```json
{ "matched": false }
```

---

## SDK 集成

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

// 上报指纹，customData 会在移动端匹配成功时原样返回
await sdk.trackClick(inviteCode, {
  customData: { campaign: 'summer2024' },
});

// 跳转商店由你的业务代码决定（不在 SDK 职责范围内）
```

### iOS

**Swift Package Manager**（Xcode → Add Package Dependencies）：
```
https://github.com/ceeyang/share-installs
```

在 `AppDelegate` 或 `@main App` 中初始化：
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

完整集成步骤见 [`docs/integration/ios.md`](docs/integration/ios.md)。

### Android

添加依赖：
```kotlin
implementation("com.share-installs:sdk-android:1.0.0")
```

在 `Application.onCreate()` 中初始化：
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

完整集成步骤见 [`docs/integration/android.md`](docs/integration/android.md)。

---

## SDK 测试

每个 SDK 均包含独立的单元测试和集成测试套件。

### JavaScript（Web）
```bash
cd sdk/js
npm test
```

### Android
依赖 JUnit + Robolectric。
```bash
cd sdk/android
./gradlew test
```

### iOS
依赖 XCTest。
```bash
cd sdk/ios
swift test
```

### 跨平台信号验证
验证不同平台指纹信号一致性的专用脚本：
```bash
npx ts-node scripts/validate_signals.ts
```

---

## 本地测试

`test/` 目录包含一个轻量内存测试服务器（无需 PostgreSQL/Redis）和测试页面：

```bash
# 启动测试服务器
node test/server.mjs
# 监听在 http://localhost:3000

# 在浏览器中打开测试页面
open test/test.html
```

测试页面支持上传浏览器指纹、查看响应，以及模拟移动端 SDK resolve 流程。

---

## 环境变量说明

有默认值的变量均为可选。

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `DATABASE_URL` | ✓ | — | PostgreSQL 连接字符串 |
| `REDIS_URL` | ✓ | — | Redis 连接字符串 |
| `MULTI_TENANT` | — | `false` | `false` = 自部署模式；`true` = SaaS 模式（需要 API key） |
| `ADMIN_SECRET` | — | _(不鉴权)_ | 项目管理端点保护密钥，为空则完全开放 |
| `PORT` | — | `3000` | HTTP 监听端口 |
| `HOST` | — | `0.0.0.0` | HTTP 绑定地址 |
| `CORS_ORIGINS` | — | `*` | 允许的来源，多个用逗号分隔 |
| `LOG_LEVEL` | — | `info` | `fatal`/`error`/`warn`/`info`/`debug`/`trace` |
| `FINGERPRINT_MATCH_THRESHOLD` | — | `0.75` | 模糊匹配最低置信度阈值（0–1） |
| `FINGERPRINT_MATCH_TTL_HOURS` | — | `72` | Click event 可被匹配的时间窗口（小时） |
| `REDIS_KEY_PREFIX` | — | `si:` | Redis key 前缀 |
| `RATE_LIMIT_WINDOW_MS` | — | `900000` | 限流窗口（毫秒） |
| `RATE_LIMIT_MAX_REQUESTS` | — | `100` | 限流窗口内最大请求数 |

---

## 许可证

Apache 2.0 — 详见 [LICENSE](LICENSE)。
