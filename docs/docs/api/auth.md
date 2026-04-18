# 认证 (Authentication)

share-installs 控制台支持两种认证方式：**GitHub OAuth** 和 **邮箱/密码登录**。

---

## 1. 认证机制 (Session)

认证成功后，服务端会下发一个名为 `session` 的 HttpOnly Cookie。该 Cookie 包含一个 7 天有效期的 JWT，用于后续访问 `/api/dashboard/*` 接口。

- **Cookie 名称**: `session`
- **有效期**: 7 天
- **安全性**: `HttpOnly`, `Secure` (仅 HTTPS), `SameSite: Lax/None`

---

## 2. GitHub OAuth (推荐)

最快速的登录方式。

### Step 1: 发起登录
- **Method**: `GET`
- **Path**: `/api/auth/github`
- **说明**: 浏览器重定向到此地址，系统会自动引导跳转至 GitHub 授权页。

### Step 2: 退出登录
- **Method**: `GET`
- **Path**: `/api/auth/logout`
- **说明**: 清除会话 Cookie 并重定向至首页。

---

## 3. 邮箱与密码认证 (Email Auth)

如果你不想使用 GitHub，可以使用邮箱注册并登录。

### 用户注册
- **Method**: `POST`
- **Path**: `/api/auth/register`
- **请求体 (JSON)**:
  ```json
  {
    "email": "user@example.com",
    "password": "strongpassword123",
    "displayName": "My Name"
  }
  ```
- **验证要求**:
  - `password`: 至少 8 位。
  - `email`: 必须是合法的邮箱格式。

### 用户登录
- **Method**: `POST`
- **Path**: `/api/auth/login`
- **请求体 (JSON)**:
  ```json
  {
    "email": "user@example.com",
    "password": "strongpassword123"
  }
  ```
- **响应**: 成功后会写入 `session` Cookie。

---

## 4. 获取当前会话状态

### 获取当前用户信息
- **Method**: `GET`
- **Path**: `/api/dashboard/me`
- **认证**: 需要有效 Session Cookie。
- **响应 (JSON)**:
  ```json
  {
    "id": "clxyz...",
    "githubLogin": "someone",
    "displayName": "My Name",
    "email": "user@example.com",
    "avatarUrl": "...",
    "hasPassword": true
  }
  ```
