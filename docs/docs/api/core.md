# 核心 API (Core API)

核心 API 负责指纹的采集和归因识别，主要由 Web SDK 和 移动端 SDK 调用。

## 调用模式

### 自部署模式 (Self-hosted)
无需认证。直接调用 `/api/v1/clicks` 和 `/api/v1/resolutions`。

### SaaS 模式
所有请求必须包含 `Authorization` 头部：
`Authorization: Bearer sk_live_your_api_key_here`

---

## 1. 采集 Web 指纹 (Track Click)

用户点击邀请链接进入落地页时，Web SDK 调用此接口上报浏览器指纹。

### 接口信息
- **Method**: `POST`
- **Path**: `/api/v1/clicks`

### 请求体 (JSON)
| 参数 | 类型 | 必选 | 说明 |
| :--- | :--- | :--- | :--- |
| `inviteCode` | string | 是 | 你系统中的邀请码。我们会原样存储并在移动端匹配成功时返回。 |
| `customData` | object | 否 | 随邀请码透传的自定义 json 数据（如渠道、活动 ID 等）。 |
| `fingerprint` | object | 是 | 浏览器信号对象。包含 `languages`, `timezone`, `screen`, `ua`, `canvas`, `webgl` 等。 |
| `referrer` | string | 否 | 页面来源来源 URL。 |

### 响应 (JSON)
```json
{
  "eventId": "clx1234567890abcdef"
}
```

---

## 2. 识别邀请归因 (Resolve Invite)

App 首次启动时，由移动端 SDK 调用，尝试匹配之前的 Web 点击事件。

### 接口信息
- **Method**: `POST`
- **Path**: `/api/v1/resolutions`

### 请求体 (JSON)
| 参数 | 类型 | 必选 | 说明 |
| :--- | :--- | :--- | :--- |
| `channel` | string | 是 | 平台标识：`ios` 或 `android`。 |
| `fingerprint` | object | 是 | 移动端采集的信号对象。 |
| `clipboardCode` | string | 否 | (仅限 Android) 从剪贴板读取到的标记。 |

### 响应 (JSON - 匹配成功)
```json
{
  "matched": true,
  "inviteCode": "ABC123",
  "customData": { "campaign": "summer_deal" },
  "meta": {
    "confidence": 0.98,
    "channel": "fuzzy"
  }
}
```

### 响应 (JSON - 未匹配)
```json
{
  "matched": false
}
```

---

## 3. 调试接口 (Debug Clicks)

> [!NOTE]
> 该接口仅在非 `production` 环境下可用。

查看指定邀请码最近的采集信号。

### 接口信息
- **Method**: `GET`
- **Path**: `/api/v1/debug/clicks/:inviteCode`
