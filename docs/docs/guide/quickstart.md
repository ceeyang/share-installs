# 快速开始

两种接入方式，选一种：

| 方式 | 适合谁 |
|------|--------|
| **本地 / 自建** | 数据完全自控，开发调试，私有部署 |
| **托管服务** | 不想运维服务器，直接用 |

---

## 方式一：本地 / 自建（推荐先跑通）

### 前置要求

- Docker + Docker Compose

域名和 HTTPS 证书**不是必须的**，本地开发完全不需要。部署到公网时才需要，详见[生产部署](deployment.md#生产部署带-https)。

### 第 1 步：克隆仓库

```bash
git clone https://github.com/ceeyang/share-installs.git
cd share-installs
```

### 第 2 步：配置环境变量

```bash
cp backend/.env.example backend/.env
```

本地开发默认值已够用，`.env` 不需要改动即可启动。

### 第 3 步：启动（跳过 Traefik）

本地开发不需要 Traefik，直接启动核心服务：

```bash
# 只跑后端 + 数据库 + 缓存
docker compose up backend db redis --build

# 同时跑前端控制台
docker compose up backend db redis dashboard --build
```

启动后访问地址：

| 服务 | 地址 |
|------|------|
| 后端 API | `http://localhost:6066` |
| 前端控制台 | `http://localhost:80` |

### 第 4 步：验证

```bash
curl http://localhost:6066/health
# {"status":"ok","mode":"self-hosted","version":"1.0.0","timestamp":"..."}
```

### 第 5 步：接入落地页（Web SDK）

```html
<script src="https://cdn.jsdelivr.net/npm/@share-installs/js-sdk/dist/share-installs-sdk.min.js"></script>
<script>
  // 本地开发直接指向 localhost
  const sdk = new ShareInstallsSDK({
    apiBaseUrl: 'http://localhost:6066',  // 部署后改为 https://你的域名/api
  });

  const inviteCode = new URL(location.href).searchParams.get('code');
  if (inviteCode) {
    await sdk.trackClick(inviteCode, {
      customData: { campaign: 'test' },
    });
  }
</script>
```

### 第 6 步：接入移动端

- [iOS 接入](../sdk/ios.md)
- [Android 接入](../sdk/android.md)

> **部署到公网？** 阅读[部署指南](deployment.md)了解域名配置和 HTTPS 证书（可选）。

---

## 方式二：使用托管服务

### 第 1 步：注册账号

访问 [console.share-installs.com](https://console.share-installs.com) 用 GitHub 账号登录。

### 第 2 步：创建应用，获取 API Key

登录后创建一个 App，复制 API Key（格式：`sk_live_xxxxxxxx`）。

### 第 3 步：接入落地页（Web SDK）

```html
<script src="https://cdn.jsdelivr.net/npm/@share-installs/js-sdk/dist/share-installs-sdk.min.js"></script>
<script>
  // 只需填写 apiKey，后端地址自动使用托管服务
  const sdk = new ShareInstallsSDK({
    apiKey: 'sk_live_xxxxxxxx',
  });

  const inviteCode = new URL(location.href).searchParams.get('code');
  if (inviteCode) {
    await sdk.trackClick(inviteCode, {
      customData: { campaign: 'summer2025' },
    });
  }
</script>
```

### 第 4 步：接入移动端

- [iOS 接入](../sdk/ios.md)
- [Android 接入](../sdk/android.md)
