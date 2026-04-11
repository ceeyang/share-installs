# share-installs – Architecture Overview

## 职责边界

share-installs 只做两件事：

1. **Web 端收集指纹**：用户点击邀请链接时，落地页调用 `POST /v1/clicks`，上报浏览器指纹 + 你系统中的邀请码。
2. **移动端匹配指纹**：App 首次启动时，移动 SDK 调用 `POST /v1/resolutions`，上报设备指纹，后端匹配后返回对应的邀请码。

**不在我们职责范围内：**
- 邀请码的生成、存储、校验、过期管理（由你的系统负责）
- 跳转 App Store / Google Play
- 邀请使用次数统计、邀请关系链

---

## 核心流程（延迟深度链接）

```
用户 A 在你的 App 中生成邀请码（你的系统）
        │
        ▼
落地页 yourdomain.com/invite/ABC123
        │
        ├─ Web SDK 调用 POST /v1/clicks
        │    { inviteCode: "ABC123", customData: {...}, fingerprint: {...} }
        │    ← 我们存储指纹，返回 { eventId }
        │
        ├─ 你的页面决定跳转到哪个商店（我们不管）
        │
        ▼
用户 B 安装并首次打开 App
        │
        ▼
移动 SDK（iOS/Android）
        │
        ├─ 收集设备指纹信号
        ├─ 调用 POST /v1/resolutions { channel, fingerprint }
        │
        ▼
后端匹配策略（按优先级）：
  1. Clipboard（Android 专属，置信度 1.0）
  2. 精确哈希匹配（Redis 快速路径，置信度 1.0）
  3. 模糊相似度匹配（DB 扫描，置信度 ≥ 阈值）
        │
        ← { matched: true, inviteCode: "ABC123", customData: {...}, meta: { confidence, channel } }
        │
        ▼
你的 App 拿到邀请码，走自己的业务逻辑（填码、发奖励等）
```

---

## 部署模式

### 自部署（MULTI_TENANT=false）

用户自己部署整套服务，传入自有域名，无需 API key。

```
你的落地页 → POST https://your-backend.com/v1/clicks
你的移动 SDK → POST https://your-backend.com/v1/resolutions
```

### SaaS（MULTI_TENANT=true）

使用我们的托管服务，每个项目需要 API key。

```
你的落地页 → POST https://api.share-installs.com/v1/clicks
             Authorization: Bearer sk_live_xxx
你的移动 SDK → POST https://api.share-installs.com/v1/resolutions
              Authorization: Bearer sk_live_xxx
```

---

## API 端点

| Method | Path | 调用方 | 说明 |
|--------|------|--------|------|
| `POST` | `/v1/clicks` | Web SDK（落地页） | 采集浏览器指纹 |
| `POST` | `/v1/resolutions` | 移动 SDK（App） | 匹配指纹，返回邀请码 |
| `GET` | `/health` | 监控 | 健康检查 |
| `POST` | `/v1/projects` | 超级管理员 | SaaS：创建项目 |
| `POST` | `/v1/projects/:id/api-keys` | 超级管理员 | SaaS：颁发 API key |

---

## 指纹匹配策略

多信号加权评分：

| 信号 | 权重 | 说明 |
|------|------|------|
| IP 子网 /24 | 30% | 最可靠，容忍 DHCP 变化 |
| User Agent | 25% | 提取 OS + 版本，非完整 UA |
| Timezone | 15% | 高区分度，稳定 |
| Language | 10% | 稳定的设备偏好 |
| Screen Size | 10% | 区分设备型号 |
| OS Version | 5% | 稳定 |
| Device Model | 5% | 稳定 |

**匹配阈值**：默认 ≥ 0.75（可通过 `FINGERPRINT_MATCH_THRESHOLD` 调整）

---

## 数据模型

```
Project（SaaS 模式）
  └── ApiKey

ClickEvent（核心）
  ├── inviteCode   string  你系统中的邀请码，原样存储
  ├── customData   JSON    落地页传入的任意数据，匹配成功后返回
  ├── fingerprint  string  指纹哈希（用于精确匹配）
  └── 各类信号字段（UA、屏幕、时区等）

Conversion（匹配记录）
  ├── inviteCode   string  匹配到的邀请码
  ├── matchChannel string  clipboard | exact | fuzzy
  └── confidence   float   匹配置信度
```

---

## 组件架构

```
┌──────────────────────────────────────────────────────┐
│                   你的系统                            │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │   落地页     │  │   iOS App    │  │ Android App │ │
│  │  (Web SDK)  │  │  (Swift SDK) │  │(Kotlin SDK) │ │
│  └──────┬──────┘  └──────┬───────┘  └──────┬──────┘ │
└─────────┼────────────────┼─────────────────┼─────────┘
          │ POST /v1/clicks │ POST /v1/resolutions
          └────────────────┴─────────────────┘
                           │
          ┌────────────────▼────────────────┐
          │        share-installs           │
          │       Backend (Express)         │
          ├───────────────┬─────────────────┤
          │  PostgreSQL   │     Redis        │
          │ (ClickEvents) │ (指纹缓存/限流)  │
          └───────────────┴─────────────────┘
```

---

## 安全

- SaaS 模式：所有核心端点需要 `Authorization: Bearer sk_live_xxx`
- API key 以 SHA-256 哈希存储，明文只在创建时返回一次
- 管理端点（项目管理）由 `ADMIN_SECRET` 保护
- 自部署模式：公开端点无需鉴权（适合私有网络）
- Redis 和 DB 限流防止暴力攻击（`/v1/resolutions` 单独限流：10次/分钟）
- 指纹哈希不可逆（SHA-256）
- 容器以非 root 用户运行
