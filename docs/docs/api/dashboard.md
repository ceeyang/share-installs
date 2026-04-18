# 控制台 API (Dashboard API)

控制台 API 供前端管理后台使用，涉及应用管理、密钥管理、个人中心及数据统计。

## 认证与授权

所有接口均受 **JWT 会话 Cookie** 保护。登录成功后，浏览器会自动在后续请求中携带会话信息。

---

## 1. 个人中心与配额

### 获取个人信息
- **Method**: `GET`
- **Path**: `/api/dashboard/me`

### 更新个人信息
- **Method**: `PATCH`
- **Path**: `/api/dashboard/me`
- **Body**: `{ "displayName": string, "avatarUrl": string, "currentPassword": string?, "newPassword": string? }`

### 获取使用量配额
- **Method**: `GET`
- **Path**: `/api/dashboard/quota`

---

## 2. 应用管理 (Apps)

### 列出所有应用
- **Method**: `GET`
- **Path**: `/api/dashboard/apps`

### 创建应用
- **Method**: `POST`
- **Path**: `/api/dashboard/apps`
- **Body**: `{ "name": "My App" }`
- **Response**: 返回新应用对象及其默认 API Key。

### 删除应用
- **Method**: `DELETE`
- **Path**: `/api/dashboard/apps/:appId`

---

## 3. API 密钥管理

### 列出应用的密钥
- **Method**: `GET`
- **Path**: `/api/dashboard/apps/:appId/keys`

### 创建新密钥
- **Method**: `POST`
- **Path**: `/api/dashboard/apps/:appId/keys`
- **Body**: `{ "name": "Marketing Key" }`

### 揭示密钥原文
- **Method**: `GET`
- **Path**: `/api/dashboard/apps/:appId/keys/:keyId/reveal`
- **Description**: 获取加密存储的密钥原文。

### 撤销密钥
- **Method**: `DELETE`
- **Path**: `/api/dashboard/apps/:appId/keys/:keyId`

---

## 4. 数据统计 (Analytics)

### 获取应用统计数据
- **Method**: `GET`
- **Path**: `/api/dashboard/apps/:appId/stats`
- **Response**:
```json
{
  "totalClicks": 1250,
  "totalInstalls": 89,
  "byChannel": {
    "exact": 45,
    "fuzzy": 30,
    "clipboard": 14
  },
  "byPlatform": {
    "ios": 40,
    "android": 49
  }
}
```
