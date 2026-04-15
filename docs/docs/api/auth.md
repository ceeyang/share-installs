# 认证

share-installs 控制台使用 GitHub OAuth 认证。核心 API（`/v1/clicks`、`/v1/resolutions`）的认证使用 API Key，与登录无关。

---

## 控制台登录流程

```
用户 → GET /auth/github → 跳转 GitHub OAuth 授权页
                               ↓ 用户点击授权
GitHub → GET /auth/github/callback?code=xxx → 服务端换取 access_token
                               ↓
                        写入 Session Cookie（HTTP Only）
                               ↓
                        重定向到控制台首页
```

---

## 接口列表

### GET /auth/github

发起 GitHub OAuth 授权。浏览器访问此地址会跳转到 GitHub 授权页。

```
https://console.share-installs.com/api/auth/github
```

---

### GET /auth/github/callback

GitHub 授权完成后的回调地址（在 GitHub OAuth App 中配置）。

```
https://console.share-installs.com/api/auth/github/callback
```

处理成功后重定向到控制台首页，同时设置 Session Cookie。

---

### GET /auth/me

获取当前登录用户信息（需要有效 Session Cookie）。

```bash
curl https://console.share-installs.com/api/auth/me \
  -H "Cookie: session=<jwt_token>"
```

**响应：**

```json
{
  "id": "clxyz...",
  "githubLogin": "your-username",
  "email": "you@example.com",
  "avatarUrl": "https://avatars.githubusercontent.com/u/...",
  "plan": "FREE"
}
```

**未登录时返回 `401`：**

```json
{ "error": "UNAUTHORIZED", "message": "Not authenticated." }
```

---

### POST /auth/logout

退出登录，清除 Session Cookie。

```bash
curl -X POST https://console.share-installs.com/api/auth/logout \
  -H "Cookie: session=<jwt_token>"
```

**响应：**

```json
{ "ok": true }
```

---

## Session Cookie

登录成功后，服务端设置一个 HTTP Only 的 `session` Cookie：

| 属性 | 值 |
|------|-----|
| 名称 | `session` |
| 类型 | JWT（`HS256`，`JWT_SECRET` 签名） |
| 有效期 | 7 天 |
| `HttpOnly` | 是（JS 无法读取） |
| `Secure` | 是（HTTPS 环境下） |
| `SameSite` | `None`（HTTPS）或 `Lax`（HTTP） |

---

## 自建部署配置 GitHub OAuth

**1. 创建 GitHub OAuth App**

前往 [github.com/settings/developers](https://github.com/settings/developers) → **New OAuth App**：

| 字段 | 填写内容 |
|------|----------|
| Application name | 随意（如 `My Share Installs`） |
| Homepage URL | `https://your-domain.com` |
| Authorization callback URL | `https://your-domain.com/api/auth/github/callback` |

**2. 复制 Client ID 和 Client Secret**

**3. 填写 `.env`**

```env
GITHUB_CLIENT_ID=Ov23li...
GITHUB_CLIENT_SECRET=abc123def456...
JWT_SECRET=<64字符随机字符串>
ENCRYPTION_KEY=<64位十六进制字符串>
FRONTEND_URL=https://your-domain.com
```

---

## API Key 认证

核心 API 使用 API Key 而非 Session Cookie 认证。

```bash
# SaaS 模式（必须携带 API Key）
curl -X POST https://console.share-installs.com/api/v1/clicks \
  -H "Authorization: Bearer sk_live_xxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '...'

# 自建模式（无需认证）
curl -X POST https://your-domain.com/api/v1/clicks \
  -H "Content-Type: application/json" \
  -d '...'
```

API Key 以 `sk_live_` 为前缀，通过控制台或管理员接口创建。详见[项目管理](projects.md)。
