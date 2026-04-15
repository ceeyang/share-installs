# 归因接口

核心 API，共两个端点：

| 端点 | 调用方 | 说明 |
|------|--------|------|
| `POST /v1/clicks` | Web SDK（落地页） | 上报浏览器指纹 |
| `POST /v1/resolutions` | 移动 SDK（App 启动） | 解析邀请码 |

---

## Base URL

**托管服务：**
```
https://console.share-installs.com/api
```

**自建部署：**
```
https://你的域名/api
```

---

## 认证

| 部署模式 | 认证方式 |
|----------|----------|
| 自建（`MULTI_TENANT=false`） | 无需认证 |
| 托管（`MULTI_TENANT=true`） | `Authorization: Bearer sk_live_xxxxxxxx` |

---

## GET /health

服务健康检查。

```bash
curl https://console.share-installs.com/api/health
```

**响应：**

```json
{
  "status": "ok",
  "mode": "saas",
  "version": "1.0.0",
  "timestamp": "2026-04-15T10:00:00.000Z"
}
```

| 字段 | 说明 |
|------|------|
| `mode` | `"saas"` 或 `"self-hosted"` |

---

## POST /v1/clicks

**调用方：** 落地页 Web SDK（用户点击邀请链接时）

上报浏览器指纹，供后续 App 安装时匹配使用。

### 请求头

```
Content-Type: application/json
Authorization: Bearer sk_live_xxxxxxxx  # SaaS 模式必须
```

### 请求体

```json
{
  "inviteCode": "ABC12345",
  "customData": {
    "campaign": "summer2025",
    "channel": "wechat"
  },
  "fingerprint": {
    "canvas": "a3f2b1c4...",
    "webgl": "d5e6f7a8...",
    "audio": "b9c0d1e2...",
    "screen": { "w": 390, "h": 844, "dpr": 3, "depth": 24 },
    "hardware": { "cores": 6, "memory": 4 },
    "languages": ["zh-CN", "zh", "en"],
    "timezone": "Asia/Shanghai",
    "touchPoints": 5,
    "ua": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 ...)",
    "connection": { "type": "wifi", "effective": "4g" }
  },
  "referrer": "https://twitter.com/..."
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `inviteCode` | `string` | 是 | 你系统中的邀请码，原样存储、原样返回 |
| `customData` | `object` | 否 | 任意 JSON，序列化后不超过 10 KB |
| `fingerprint` | `object` | 是 | 浏览器指纹信号（见下表） |
| `referrer` | `string` | 否 | 来源页面 URL |

**fingerprint 字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `canvas` | `string?` | Canvas 渲染差异 SHA-256 哈希 |
| `webgl` | `string?` | WebGL 渲染特征 SHA-256 哈希 |
| `audio` | `string?` | AudioContext 处理差异 SHA-256 哈希 |
| `screen.w` / `.h` | `number?` | 屏幕宽高（像素） |
| `screen.dpr` | `number?` | 设备像素比 |
| `screen.depth` | `number?` | 色深 |
| `hardware.cores` | `number?` | CPU 核数 |
| `hardware.memory` | `number?` | 设备内存（GB，近似值） |
| `languages` | `string[]` | `navigator.languages` |
| `timezone` | `string?` | IANA 时区标识符 |
| `touchPoints` | `number?` | `navigator.maxTouchPoints` |
| `ua` | `string?` | User-Agent 字符串 |
| `connection.type` | `string?` | 连接类型 |
| `connection.effective` | `string?` | 有效网络类型（4g / 3g 等） |

### 成功响应 `200`

```json
{
  "eventId": "clxyz1234567890"
}
```

### 错误响应

| 状态码 | 错误码 | 说明 |
|--------|--------|------|
| `400` | `INVALID_ARGUMENT` | 请求体格式错误 |
| `401` | `UNAUTHORIZED` | API Key 缺失或无效（SaaS 模式） |
| `429` | `RATE_LIMIT_EXCEEDED` | 请求过于频繁 |

---

## POST /v1/resolutions

**调用方：** 移动 SDK（App 首次启动后）

发送设备信号，匹配之前的点击记录，返回邀请码。

### 请求头

```
Content-Type: application/json
Authorization: Bearer sk_live_xxxxxxxx  # SaaS 模式必须
```

### 请求体

```json
{
  "channel": "ios",
  "fingerprint": {
    "osVersion": "18.0",
    "screen": { "w": 390, "h": 844, "scale": 3 },
    "languages": ["zh-CN", "zh"],
    "timezone": "Asia/Shanghai",
    "networkType": "wifi",
    "diskBucket": "256GB",
    "keychainUuid": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**Android 示例：**

```json
{
  "channel": "android",
  "clipboardCode": "SHAREINSTALLS:ABC12345",
  "fingerprint": {
    "osVersion": "14",
    "androidId": "a1b2c3d4e5f6a7b8",
    "apiLevel": 34,
    "brand": "Samsung",
    "model": "Galaxy S24",
    "buildFingerprint": "samsung/SM-S9260/...",
    "screen": { "w": 1080, "h": 2340, "density": 3 },
    "languages": ["zh-CN"],
    "timezone": "Asia/Shanghai",
    "networkType": "wifi"
  }
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `channel` | `"ios"` \| `"android"` | 是 | 设备平台 |
| `clipboardCode` | `string?` | 否 | Android 从剪贴板读取的值（含 `SHAREINSTALLS:` 前缀） |
| `fingerprint` | `object` | 是 | 设备信号 |

**iOS fingerprint 字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `osVersion` | `string?` | iOS 版本号，如 `"18.0"` |
| `screen.w` / `.h` | `number?` | 屏幕尺寸（逻辑点） |
| `screen.scale` | `number?` | 像素密度倍数（2 或 3） |
| `languages` | `string[]?` | 系统语言列表 |
| `timezone` | `string?` | IANA 时区标识符 |
| `networkType` | `string?` | `wifi` / `cellular` / `none` |
| `diskBucket` | `string?` | 磁盘容量档位（如 `"256GB"`） |
| `keychainUuid` | `string?` | Keychain 存储的设备 UUID |

**Android fingerprint 字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `androidId` | `string?` | Android 设备唯一 ID |
| `apiLevel` | `number?` | Android API Level |
| `brand` | `string?` | 品牌（如 `Samsung`） |
| `model` | `string?` | 型号（如 `Galaxy S24`） |
| `buildFingerprint` | `string?` | 系统构建指纹 |
| `screen.w` / `.h` | `number?` | 屏幕分辨率（像素） |
| `screen.density` | `number?` | 像素密度倍数 |

### 成功响应 `200`（匹配成功）

```json
{
  "matched": true,
  "inviteCode": "ABC12345",
  "customData": {
    "campaign": "summer2025",
    "channel": "wechat"
  },
  "meta": {
    "confidence": 0.94,
    "channel": "fuzzy"
  }
}
```

### 成功响应 `200`（未匹配）

```json
{
  "matched": false
}
```

未匹配原因可能是：用户不是通过邀请链接安装、超过 TTL 时限（默认 72 小时），或设备信号差异过大（置信度低于阈值 0.75）。

### meta 字段说明

| 字段 | 说明 |
|------|------|
| `confidence` | 置信度，范围 0.0–1.0 |
| `channel` | `"exact"` = Redis 精确匹配；`"fuzzy"` = 模糊匹配；`"clipboard"` = 剪贴板兜底 |

### 错误响应

| 状态码 | 错误码 | 说明 |
|--------|--------|------|
| `400` | `INVALID_ARGUMENT` | 请求体格式错误 |
| `401` | `UNAUTHORIZED` | API Key 无效（SaaS 模式） |
| `429` | `RATE_LIMIT_EXCEEDED` | 请求过于频繁（附带 `Retry-After` 头） |

**429 响应体（SaaS 模式）：**

```json
{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Too many resolve requests.",
  "plan": "FREE",
  "limit": 10,
  "retryAfterSeconds": 42
}
```

---

## 限流说明

### 通用限流

所有接口共享：窗口 15 分钟，最多 100 次请求（可通过环境变量调整）。

### `/v1/resolutions` 专用限流

| 方案 | 每分钟限制 |
|------|-----------|
| 自建（无方案限制） | 由 `RATE_LIMIT_RESOLVE_MAX` 控制，默认 10 |
| Free | 10 次/分钟 |
| Pro | 60 次/分钟 |
| Unlimited | 无实际限制 |

限流响应包含 `Retry-After` 响应头（秒数）。
