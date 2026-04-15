# 项目管理接口

管理应用（App）和 API Key 的接口。分两套：

| 接口集 | 认证方式 | 适用场景 |
|--------|----------|----------|
| **控制台接口** `/dashboard/*` | JWT Session Cookie（GitHub OAuth 登录后） | 普通用户通过 Web 控制台管理 |
| **管理员接口** `/v1/projects/*` | `ADMIN_SECRET` | 服务端脚本、CI/CD 自动化 |

---

## 控制台接口（推荐）

通过 Web 控制台 ([console.share-installs.com](https://console.share-installs.com)) 管理，登录后自动认证，无需手动处理 Token。

### GET /dashboard/me

获取当前登录用户信息和方案。

```bash
curl https://console.share-installs.com/api/dashboard/me \
  -H "Cookie: session=<jwt_token>"
```

**响应：**

```json
{
  "id": "clxyz...",
  "githubLogin": "your-username",
  "email": "you@example.com",
  "avatarUrl": "https://avatars.githubusercontent.com/...",
  "plan": "FREE",
  "planExpiresAt": null
}
```

---

### GET /dashboard/quota

查询当前账号的用量配额。

**响应：**

```json
{
  "plan": "PRO",
  "resolves": {
    "used": 1240,
    "limit": 10000,
    "resetAt": "2026-05-01T00:00:00.000Z"
  }
}
```

---

### GET /dashboard/apps

列出当前用户的所有 App。

**响应：**

```json
{
  "apps": [
    {
      "id": "clxyz...",
      "name": "MyApp iOS",
      "createdAt": "2026-04-01T10:00:00.000Z"
    }
  ]
}
```

---

### POST /dashboard/apps

创建一个新 App。

**请求体：**

```json
{ "name": "MyApp iOS" }
```

**响应：**

```json
{
  "id": "clxyz...",
  "name": "MyApp iOS",
  "createdAt": "2026-04-15T10:00:00.000Z"
}
```

---

### DELETE /dashboard/apps/:appId

删除指定 App 及其所有数据（不可恢复）。

```bash
curl -X DELETE https://console.share-installs.com/api/dashboard/apps/clxyz... \
  -H "Cookie: session=<jwt_token>"
```

---

### GET /dashboard/apps/:appId/keys

列出指定 App 的所有 API Key（显示 prefix，不显示完整密钥）。

**响应：**

```json
{
  "keys": [
    {
      "id": "clkey...",
      "name": "生产环境",
      "prefix": "sk_live_abcd",
      "createdAt": "2026-04-01T10:00:00.000Z",
      "revokedAt": null
    }
  ]
}
```

---

### POST /dashboard/apps/:appId/keys

创建一个新 API Key。**完整密钥仅在此响应中显示一次，请立即保存。**

**请求体：**

```json
{ "name": "生产环境" }
```

**响应：**

```json
{
  "id": "clkey...",
  "name": "生产环境",
  "key": "sk_live_abcdef123456...",  // 仅此一次，请立即保存
  "prefix": "sk_live_abcd",
  "createdAt": "2026-04-15T10:00:00.000Z"
}
```

---

### GET /dashboard/apps/:appId/keys/:keyId/reveal

重新查看已创建的 API Key（AES-256-GCM 加密存储，可重复查看）。

**响应：**

```json
{
  "key": "sk_live_abcdef123456..."
}
```

---

### DELETE /dashboard/apps/:appId/keys/:keyId

撤销指定 API Key。撤销后立即失效，无法恢复。

---

### GET /dashboard/apps/:appId/stats

查看 App 的归因统计数据。

**响应：**

```json
{
  "totalClicks": 1523,
  "totalConversions": 342,
  "conversionRate": 0.224,
  "byChannel": {
    "exact": 180,
    "fuzzy": 152,
    "clipboard": 10
  }
}
```

---

## 管理员接口

仅供服务管理员使用（需设置 `ADMIN_SECRET` 环境变量）。

### 认证

所有管理员接口需在请求头中携带：

```
Authorization: Bearer <ADMIN_SECRET>
```

---

### POST /v1/projects

创建一个新项目（应用）。

```bash
curl -X POST https://console.share-installs.com/api/v1/projects \
  -H "Authorization: Bearer <ADMIN_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"name": "MyApp"}'
```

**响应：**

```json
{
  "id": "clxyz...",
  "name": "MyApp",
  "createdAt": "2026-04-15T10:00:00.000Z"
}
```

---

### GET /v1/projects

列出所有项目。

---

### POST /v1/projects/:projectId/api-keys

为指定项目创建 API Key。

```bash
curl -X POST https://console.share-installs.com/api/v1/projects/clxyz.../api-keys \
  -H "Authorization: Bearer <ADMIN_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"name": "生产环境"}'
```

**响应（完整密钥仅此一次）：**

```json
{
  "id": "clkey...",
  "name": "生产环境",
  "key": "sk_live_abcdef123456...",
  "prefix": "sk_live_abcd"
}
```

---

### GET /v1/projects/:projectId/api-keys

列出指定项目的所有 API Key。

---

### DELETE /v1/projects/:projectId/api-keys/:keyId

撤销指定 API Key，立即失效。
