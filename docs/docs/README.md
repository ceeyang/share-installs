# share-installs 文档

**延迟深度链接邀请归因系统** — 开源、自托管、无供应商锁定。

---

## 什么是 share-installs？

用户点击邀请链接并安装 App 后，邀请码在首次启动时自动识别回填。

- 无需用户授权剪贴板
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
- [归因接口](api/resolutions.md) — `/v1/clicks` 和 `/v1/resolutions`
- [项目管理](api/projects.md) — API Key 管理（管理员）
- [认证](api/auth.md) — GitHub OAuth
