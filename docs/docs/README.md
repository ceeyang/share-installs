# share-installs 文档

**延迟深度链接邀请归因系统** — 开源、自托管、无供应商锁定。

---

## 什么是 share-installs？

用户点击邀请链接并安装 App 后，邀请码在首次启动时自动识别回填。

- 无需用户授权剪贴板 (Android 提供兜底支持)
- 无需用户登录
- 无需第三方 SDK 绑定
- 数据完全由你掌控

## 工作原理

```
[用户 A 分享链接]
       ↓
[用户 B 点击落地页] → JS SDK 采集浏览器指纹 → POST /v1/clicks
       ↓
[用户 B 安装 App]
       ↓
[App 首次启动] → 移动 SDK 采集设备信号 → POST /v1/resolutions
       ↓
[返回邀请码 + 自定义数据，置信度 0.94]
```

## 三级归因通道

| 优先级 | 通道 | 方式 | 适用场景 |
|--------|------|------|----------|
| 1 | Redis 精确匹配 | 指纹哈希完全一致 | 同一设备、同一浏览器 |
| 2 | PostgreSQL 模糊匹配 | 多维特征加权评分 | 浏览器版本更新、字体变化 |
| 3 | Android 剪贴板 | 读取剪贴板兜底 | 指纹匹配失败时的兜底 |

## 快速导航

- [快速开始](guide/quickstart.md) — 5 分钟内跑起来
- [部署指南](guide/deployment.md) — Docker、环境变量、HTTPS
- [Web SDK](sdk/web.md) — 落地页接入
- [iOS SDK](sdk/ios.md) — Swift 接入
- [Android SDK](sdk/android.md) — Kotlin 接入
- [核心归因 API](api/core.md) — `/v1/clicks` 和 `/api/v1/resolutions`
- [控制台 API](api/dashboard.md) — 应用管理、密钥管理与统计
- [认证与安全](api/auth.md) — GitHub OAuth 与 API Key

## Postman 接口文件

为了方便调试，我们提供了两种格式的接口文件：

1.  👉 **[下载原生 Postman Collection (推荐)](share-installs-collection.json)** — 包含预设变量、文件夹分类及请求示例，支持直接导入 Postman。
2.  👉 **[下载 OpenAPI 3.0 Spec](share-installs-api.json)** — 标准 OpenAPI 规范文件。

---

**开源地址**: [GitHub/ceeyang/share-installs](https://github.com/ceeyang/share-installs)
