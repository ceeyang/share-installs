# Invite Attribution SDK — 完整技术方案

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个商业级、可开源、可自部署的邀请归因 SDK 系统，用户点击邀请链接并下载 App 后，自动完成邀请码回传，无需用户手动操作。

**Architecture:** 服务端基于 Go 实现多租户 REST API，通过设备指纹概率匹配将 Web 侧点击事件与 App 首次启动事件关联，Android 额外支持剪切板直读通道。Web SDK 以 CDN script 标签优先交付，Native SDK 分别以 Swift Package Manager 和 Gradle 发布。

**Tech Stack:** Go / Gin · SQLite(开发) + PostgreSQL(生产) · Redis(可选缓存) · TypeScript + Rollup(Web SDK) · Swift 5.9+(iOS SDK) · Kotlin(Android SDK) · Docker Compose / Helm Chart(部署)

---

## 一、仓库结构（Monorepo）

```
invite-sdk/
├── server/                        # Go 后端服务
│   ├── cmd/server/main.go
│   ├── internal/
│   │   ├── api/                   # HTTP 路由与 Handler
│   │   │   ├── v1/
│   │   │   │   ├── projects.go
│   │   │   │   ├── api_keys.go
│   │   │   │   ├── invites.go
│   │   │   │   └── fingerprints.go
│   │   │   └── middleware/
│   │   │       ├── auth.go        # API Key 鉴权
│   │   │       ├── ratelimit.go
│   │   │       └── cors.go
│   │   ├── service/               # 业务逻辑
│   │   │   ├── fingerprint.go     # 指纹采集与匹配
│   │   │   ├── invite.go          # 邀请码管理
│   │   │   └── tenant.go          # 多租户管理
│   │   ├── store/                 # 数据库抽象层
│   │   │   ├── interface.go       # Store 接口定义
│   │   │   ├── sqlite/
│   │   │   └── postgres/
│   │   └── config/
│   │       └── config.go
│   ├── migrations/                # SQL 迁移文件
│   └── Dockerfile
│
├── sdk/
│   ├── web/                       # TypeScript Web SDK
│   │   ├── src/
│   │   │   ├── index.ts           # 主入口，暴露 InviteSDK 类
│   │   │   ├── fingerprint.ts     # 指纹采集逻辑
│   │   │   └── transport.ts       # HTTP 上报
│   │   ├── dist/                  # 构建输出
│   │   │   ├── invite-sdk.min.js  # CDN 版本
│   │   │   └── invite-sdk.esm.js  # ESM 版本
│   │   ├── package.json
│   │   └── rollup.config.ts
│   │
│   ├── ios/                       # Swift iOS SDK
│   │   ├── Sources/InviteSDK/
│   │   │   ├── InviteSDK.swift    # 主入口，公开 API
│   │   │   ├── Fingerprint.swift  # 设备指纹采集
│   │   │   ├── Transport.swift    # HTTP 上报
│   │   │   └── Keychain.swift     # Keychain UUID 管理
│   │   ├── Tests/
│   │   └── Package.swift
│   │
│   └── android/                   # Kotlin Android SDK
│       ├── invitesdk/
│       │   └── src/main/kotlin/com/invitesdk/
│       │       ├── InviteSDK.kt   # 主入口，公开 API
│       │       ├── Fingerprint.kt # 设备指纹采集
│       │       ├── Clipboard.kt   # 剪切板读取
│       │       └── Transport.kt   # HTTP 上报
│       └── build.gradle
│
├── examples/
│   ├── landing-page/              # 落地页 Demo（HTML + Web SDK）
│   ├── ios-app/                   # iOS 接入示例
│   └── android-app/               # Android 接入示例
│
├── docs/
│   ├── api-reference.md
│   ├── web-sdk.md
│   ├── ios-sdk.md
│   ├── android-sdk.md
│   └── self-hosting.md
│
├── deploy/
│   ├── docker-compose.yml         # 简单自部署
│   ├── docker-compose.prod.yml    # 生产自部署（含 PostgreSQL + Redis）
│   └── helm/                      # Kubernetes Helm Chart
│
└── Makefile                       # 统一构建命令
```

---

## 二、数据库 Schema

### projects（租户/项目）
```sql
CREATE TABLE projects (
    id          TEXT PRIMARY KEY,          -- proj_xxxxxxxx
    name        TEXT NOT NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### api_keys
```sql
CREATE TABLE api_keys (
    id          TEXT PRIMARY KEY,          -- key_xxxxxxxx
    project_id  TEXT NOT NULL REFERENCES projects(id),
    name        TEXT NOT NULL,
    key_hash    TEXT NOT NULL UNIQUE,      -- SHA-256，明文仅展示一次
    prefix      TEXT NOT NULL,             -- 前8位明文，用于显示 "sk_live_abcd..."
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at  DATETIME                   -- NULL 表示有效
);
```

### invites（邀请码）
```sql
CREATE TABLE invites (
    id          TEXT PRIMARY KEY,          -- inv_xxxxxxxx
    project_id  TEXT NOT NULL REFERENCES projects(id),
    code        TEXT NOT NULL,             -- 接入方传入或我方生成
    meta        TEXT,                      -- JSON，接入方自定义数据
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expire_at   DATETIME,                  -- NULL 表示不过期
    UNIQUE(project_id, code)
);
```

### fingerprint_events（指纹事件）
```sql
CREATE TABLE fingerprint_events (
    id              TEXT PRIMARY KEY,      -- fpe_xxxxxxxx
    project_id      TEXT NOT NULL REFERENCES projects(id),
    invite_id       TEXT REFERENCES invites(id),
    channel         TEXT NOT NULL,         -- 'web' | 'ios' | 'android'
    ip              TEXT,
    ua              TEXT,
    canvas_hash     TEXT,
    webgl_hash      TEXT,
    audio_hash      TEXT,
    screen          TEXT,                  -- JSON: {w, h, dpr, depth}
    hardware        TEXT,                  -- JSON: {cores, memory}
    languages       TEXT,                  -- JSON array
    timezone        TEXT,
    touch_points    INTEGER,
    connection      TEXT,
    -- Native 专有
    os_version      TEXT,
    device_class    TEXT,
    android_id      TEXT,
    keychain_uuid   TEXT,
    network_type    TEXT,
    disk_bucket     TEXT,                  -- "16GB" | "32GB" | "64GB" ...
    build_fp        TEXT,                  -- Android Build.FINGERPRINT
    -- 状态
    matched_at      DATETIME,
    matched_event_id TEXT,                 -- 指向匹配的另一条记录
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expire_at       DATETIME NOT NULL      -- TTL，默认 72h 后清理
);

CREATE INDEX idx_fpe_project_ip ON fingerprint_events(project_id, ip);
CREATE INDEX idx_fpe_expire ON fingerprint_events(expire_at);
```

---

## 三、API 设计（Google API Design Guide）

### 鉴权

所有请求需携带：
```
Authorization: Bearer {api_key}
```

### 资源结构

```
/v1/projects
/v1/projects/{project_id}
/v1/projects/{project_id}/api-keys
/v1/projects/{project_id}/api-keys/{key_id}
/v1/projects/{project_id}/invites
/v1/projects/{project_id}/invites/{invite_id}
/v1/fingerprints:collect
/v1/fingerprints:resolve
```

---

### 3.1 项目管理

#### 创建项目
```
POST /v1/projects

Request:
{
  "name": "My App"
}

Response 201:
{
  "name": "projects/proj_a1b2c3d4",
  "displayName": "My App",
  "createTime": "2026-04-04T10:00:00Z"
}
```

#### 列出项目
```
GET /v1/projects?pageSize=20&pageToken={token}

Response 200:
{
  "projects": [...],
  "nextPageToken": "xxx"
}
```

---

### 3.2 API Key 管理

#### 创建 API Key
```
POST /v1/projects/{project_id}/api-keys

Request:
{
  "displayName": "Production Key"
}

Response 201:
{
  "name": "projects/proj_a1b2/apiKeys/key_c3d4e5",
  "displayName": "Production Key",
  "key": "sk_live_abcd1234xxxxxxxx",   // 仅此一次返回明文
  "keyPrefix": "sk_live_abcd",
  "createTime": "2026-04-04T10:00:00Z"
}
```

#### 撤销 API Key
```
DELETE /v1/projects/{project_id}/api-keys/{key_id}

Response 200:
{}
```

---

### 3.3 邀请码管理

#### 创建邀请码
```
POST /v1/projects/{project_id}/invites

Request:
{
  "code": "FRIEND2024",       // 可选，不传则自动生成
  "ttl": "259200s",           // 可选，默认 72h
  "meta": {                   // 可选，接入方自定义
    "inviterId": "user_123",
    "channel": "wechat"
  }
}

Response 201:
{
  "name": "projects/proj_a1b2/invites/inv_f6g7h8",
  "code": "FRIEND2024",
  "meta": { "inviterId": "user_123", "channel": "wechat" },
  "createTime": "2026-04-04T10:00:00Z",
  "expireTime": "2026-04-07T10:00:00Z"
}
```

#### 查询邀请码
```
GET /v1/projects/{project_id}/invites/{invite_id}

Response 200:
{
  "name": "projects/proj_a1b2/invites/inv_f6g7h8",
  "code": "FRIEND2024",
  "meta": {...},
  "createTime": "...",
  "expireTime": "..."
}
```

#### 列出邀请码
```
GET /v1/projects/{project_id}/invites?pageSize=20&pageToken={token}

Response 200:
{
  "invites": [...],
  "nextPageToken": "xxx"
}
```

---

### 3.4 指纹核心接口

#### Web SDK 上报（点击邀请链接时调用）
```
POST /v1/fingerprints:collect

Headers:
  Authorization: Bearer {api_key}
  X-Forwarded-For: {client_ip}   // 由反向代理注入

Request:
{
  "inviteCode": "FRIEND2024",
  "fingerprint": {
    "canvas":      "a3f8c2...",   // SHA-256
    "webgl":       "b7e1d4...",
    "audio":       "c9a2f5...",
    "screen":      { "w": 390, "h": 844, "dpr": 3, "depth": 24 },
    "hardware":    { "cores": 8, "memory": 4 },
    "languages":   ["zh-CN", "zh", "en"],
    "timezone":    "Asia/Shanghai",
    "touchPoints": 5,
    "ua":          "Mozilla/5.0 ...",
    "connection":  { "type": "wifi", "effective": "4g" }
  }
}

Response 200:
{
  "eventId": "fpe_i9j0k1l2"
}
```

#### Native SDK 解析（App 首次启动时调用）
```
POST /v1/fingerprints:resolve

Headers:
  Authorization: Bearer {api_key}

Request（iOS）:
{
  "channel": "ios",
  "fingerprint": {
    "osVersion":    "18.2",
    "screen":       { "w": 390, "h": 844, "scale": 3 },
    "languages":    ["zh-Hans-CN"],
    "timezone":     "Asia/Shanghai",
    "networkType":  "wifi",
    "diskBucket":   "256GB",
    "keychainUuid": "550e8400-e29b-41d4-a716-446655440000"
  }
}

Request（Android）:
{
  "channel": "android",
  "clipboardCode": "INVITE:FRIEND2024",  // 可选，剪切板读取结果
  "fingerprint": {
    "androidId":    "e7a32f1b9c4d5e6f",
    "osVersion":    "14",
    "apiLevel":     34,
    "screen":       { "w": 1080, "h": 2400, "density": 3 },
    "languages":    ["zh-CN"],
    "timezone":     "Asia/Shanghai",
    "networkType":  "mobile",
    "brand":        "Xiaomi",
    "model":        "2211133C",
    "buildFp":      "Xiaomi/..."
  }
}

Response 200（匹配成功）:
{
  "matched": true,
  "invite": {
    "name": "projects/proj_a1b2/invites/inv_f6g7h8",
    "code": "FRIEND2024",
    "meta": { "inviterId": "user_123" }
  },
  "confidence": 0.92,
  "channel": "fingerprint"   // "fingerprint" | "clipboard"
}

Response 200（无匹配）:
{
  "matched": false
}
```

---

### 3.5 标准错误格式

```json
{
  "error": {
    "code": 401,
    "status": "UNAUTHENTICATED",
    "message": "API key is invalid or revoked."
  }
}
```

| HTTP 状态 | status 值 |
|-----------|-----------|
| 400 | INVALID_ARGUMENT |
| 401 | UNAUTHENTICATED |
| 403 | PERMISSION_DENIED |
| 404 | NOT_FOUND |
| 409 | ALREADY_EXISTS |
| 429 | RESOURCE_EXHAUSTED |
| 500 | INTERNAL |

---

## 四、指纹匹配算法

### 匹配流程

```
Android 收到 :resolve 请求
  └── clipboardCode 存在？
        ├── 是 → 直接查 invites 表，返回（channel: clipboard，confidence: 1.0）
        └── 否 → 走指纹匹配流程

指纹匹配流程：
  1. 从 fingerprint_events 中筛选：
     - 同 project_id
     - channel = 'web'
     - expire_at > NOW()
     - 未被匹配过（matched_at IS NULL）
     - IP 相同（可选，作为初筛）
  2. 对每条候选记录计算得分
  3. 取最高分，≥75 则命中，更新 matched_at
```

### 评分权重

| 字段 | 条件 | 得分 |
|------|------|------|
| IP 地址 | 精确相同 | +40 |
| Keychain UUID / Android ID | 相同（需 web+native 均有记录） | +30 |
| Canvas 指纹 | 相同 | +20 |
| WebGL 指纹 | 相同 | +15 |
| 音频指纹 | 相同 | +10 |
| 屏幕分辨率 | w/h/dpr 全部相同 | +10 |
| OS 版本 | 相同 | +8 |
| 语言列表 | 第一项相同 | +5 |
| 时区 | 相同 | +5 |
| 硬件档位 | cores + memory 相同 | +5 |
| Touch Points | 相同 | +3 |
| 网络类型 | 相同 | +3 |

**命中阈值：≥75 分**
**时间窗口：默认 72h（可配置）**

---

## 五、Web SDK 接口设计

### 接入方用法

```html
<!-- CDN 引入 -->
<script src="https://cdn.yourdomain.com/invite-sdk/v1/invite-sdk.min.js"></script>
<script>
  const sdk = new InviteSDK({
    apiKey: 'sk_live_xxxxxxxx',
    endpoint: 'https://api.yourdomain.com'  // 可选，自部署时覆盖
  });

  // 落地页加载时，传入当前邀请码（从 URL 参数中解析）
  sdk.collect('FRIEND2024').then(({ eventId }) => {
    console.log('上报成功', eventId);
  });
</script>
```

### 内部采集流程

```
InviteSDK.collect(inviteCode)
  → FingerprintCollector.collect()
      ├── 采集 Navigator 属性（同步）
      ├── 计算 Canvas 指纹（同步）
      ├── 计算 WebGL 指纹（同步）
      ├── 计算 Audio 指纹（异步，AudioContext）
      └── 组装 payload → Transport.send('/v1/fingerprints:collect')
```

---

## 六、iOS SDK 接口设计

### 接入方用法

```swift
// AppDelegate 或 @main App struct
import InviteSDK

@main
struct MyApp: App {
    init() {
        InviteSDK.shared.configure(
            apiKey: "sk_live_xxxxxxxx",
            endpoint: "https://api.yourdomain.com"  // 可选
        )
        
        // 首次启动时调用，后续自动跳过（内部标记）
        InviteSDK.shared.resolve { result in
            switch result {
            case .matched(let invite):
                print("邀请码：\(invite.code)")
                print("自定义数据：\(invite.meta)")
            case .notMatched:
                print("无匹配")
            case .failure(let error):
                print("错误：\(error)")
            }
        }
    }
}
```

### 内部采集字段

```swift
struct iOSFingerprint: Encodable {
    let osVersion:    String    // UIDevice.current.systemVersion
    let screen:       Screen    // UIScreen.main.bounds + scale
    let languages:    [String]  // Locale.preferredLanguages
    let timezone:     String    // TimeZone.current.identifier
    let networkType:  String    // Reachability（无需授权）
    let diskBucket:   String    // FileManager 总容量取档位
    let keychainUuid: String    // 首次生成并持久化到 Keychain
}
```

---

## 七、Android SDK 接口设计

### 接入方用法

```kotlin
// Application.onCreate()
import com.invitesdk.InviteSDK

class MyApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        InviteSDK.init(
            context = this,
            apiKey = "sk_live_xxxxxxxx",
            endpoint = "https://api.yourdomain.com"  // 可选
        )
    }
}

// 在首个 Activity.onResume() 中调用
InviteSDK.resolve(this) { result ->
    when (result) {
        is InviteResult.Matched -> {
            println("邀请码：${result.invite.code}")
            println("渠道：${result.channel}") // "clipboard" | "fingerprint"
        }
        is InviteResult.NotMatched -> println("无匹配")
        is InviteResult.Failure -> println("错误：${result.error}")
    }
}
```

### 剪切板格式约定

接入方落地页写入剪切板时，**必须使用以下格式**（SDK 仅识别此前缀，避免误读用户剪切板）：

```
INVITESDK:{projectId}:{inviteCode}
示例：INVITESDK:proj_a1b2:FRIEND2024
```

### 内部采集字段

```kotlin
data class AndroidFingerprint(
    val androidId:   String,   // Settings.Secure.ANDROID_ID
    val osVersion:   String,   // Build.VERSION.RELEASE
    val apiLevel:    Int,      // Build.VERSION.SDK_INT
    val screen:      Screen,   // DisplayMetrics
    val languages:   List<String>,
    val timezone:    String,
    val networkType: String,   // ConnectivityManager，READ_NETWORK_STATE
    val brand:       String,   // Build.BRAND
    val model:       String,   // Build.MODEL
    val buildFp:     String    // Build.FINGERPRINT
)
```

**所需权限**（仅普通权限，无需用户授权弹窗）：
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

---

## 八、部署方案

### 8.1 Docker Compose（简单自部署）

```yaml
# docker-compose.yml
services:
  server:
    image: ghcr.io/yourorg/invite-sdk-server:latest
    ports:
      - "8080:8080"
    environment:
      DATABASE_URL: "sqlite:///data/invite-sdk.db"
      SECRET_KEY: "your-secret-key"
    volumes:
      - ./data:/data
```

启动命令：
```bash
docker compose up -d
```

### 8.2 生产环境（PostgreSQL + Redis）

```yaml
# docker-compose.prod.yml
services:
  server:
    image: ghcr.io/yourorg/invite-sdk-server:latest
    environment:
      DATABASE_URL: "postgres://user:pass@postgres:5432/invitesdk"
      REDIS_URL: "redis://redis:6379"
      SECRET_KEY: "${SECRET_KEY}"
    depends_on: [postgres, redis]

  postgres:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru

volumes:
  pgdata:
```

### 8.3 Kubernetes（Helm Chart）

```bash
helm install invite-sdk ./deploy/helm \
  --set server.replicaCount=3 \
  --set postgresql.enabled=true \
  --set redis.enabled=true \
  --set ingress.host=api.yourdomain.com
```

### 8.4 环境变量配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DATABASE_URL` | `sqlite:///./invite-sdk.db` | 数据库连接串 |
| `REDIS_URL` | 空（禁用） | Redis 连接串，空则用内存 |
| `SECRET_KEY` | 必填 | 用于 API Key 签名 |
| `PORT` | `8080` | 监听端口 |
| `FINGERPRINT_TTL` | `259200` | 指纹 TTL（秒），默认 72h |
| `MATCH_THRESHOLD` | `75` | 匹配得分阈值 |
| `LOG_LEVEL` | `info` | 日志级别 |
| `ALLOWED_ORIGINS` | `*` | CORS 允许来源 |

---

## 九、多租户与 API Key 设计

### API Key 格式
```
sk_live_{32位随机字符串}
sk_test_{32位随机字符串}   // 测试环境 Key，数据隔离
```

### 鉴权流程
```
请求到达 → 提取 Bearer Token
  → 取前缀（prefix = token[:12]）
  → 按 prefix 查 api_keys 表（prefix 加索引）
  → 比对 SHA-256(token) == key_hash
  → 注入 project_id 到请求上下文
  → 所有数据库操作自动附加 WHERE project_id = ?
```

### Rate Limiting
```
默认：1000 req/min per API Key
超限响应：HTTP 429，Retry-After header
```

---

## 十、开源发布计划

| 内容 | 说明 |
|------|------|
| 许可证 | Apache 2.0（商业友好，允许私有部署和二次开发） |
| SDK 发布 | Web SDK → npm · iOS → Swift Package Index · Android → Maven Central |
| 服务端镜像 | GitHub Container Registry（ghcr.io） |
| 文档 | docs/ 目录，GitHub Pages 发布 |
| 示例 | examples/ 目录，含最小可运行 Demo |

---

## 待实现任务列表

### Task 1: 项目骨架与配置
- [ ] 初始化 Go 模块，建立 monorepo 目录结构
- [ ] 实现配置加载（环境变量 + 默认值）
- [ ] 建立 Store 接口抽象（支持 SQLite / PostgreSQL）
- [ ] 实现数据库迁移机制

### Task 2: 多租户 API Key 系统
- [ ] 实现 projects CRUD
- [ ] 实现 API Key 生成、哈希存储、鉴权中间件
- [ ] 实现 Rate Limiting 中间件

### Task 3: 邀请码管理
- [ ] 实现 invites CRUD（含自动生成 code 逻辑）
- [ ] 实现 TTL 过期清理

### Task 4: 指纹采集与匹配服务
- [ ] 实现 `POST /v1/fingerprints:collect`
- [ ] 实现匹配算法（评分 + 阈值）
- [ ] 实现 `POST /v1/fingerprints:resolve`（含剪切板优先通道）
- [ ] 实现 TTL 过期清理定时任务

### Task 5: Web SDK
- [ ] 实现 Canvas / WebGL / Audio 指纹采集
- [ ] 实现 Navigator 属性采集
- [ ] 实现上报 Transport
- [ ] 构建 CDN 版本和 ESM 版本

### Task 6: iOS SDK
- [ ] 实现设备指纹采集
- [ ] 实现 Keychain UUID 持久化
- [ ] 实现网络上报与回调接口

### Task 7: Android SDK
- [ ] 实现设备指纹采集
- [ ] 实现剪切板读取（格式验证）
- [ ] 实现网络上报与回调接口

### Task 8: 部署配置
- [ ] 编写 Dockerfile（多阶段构建，最终镜像 < 20MB）
- [ ] 编写 docker-compose.yml 和 docker-compose.prod.yml
- [ ] 编写 Helm Chart
- [ ] 编写 self-hosting 文档
