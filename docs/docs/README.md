# share-installs 文档

**延迟深度链接邀请归因系统** — 开源、自托管、无供应商锁定。

## 什么是 share-installs？

用户点击邀请链接并安装 App 后，邀请码在首次启动时自动识别回填，无需剪贴板授权，无需用户登录，无需第三方 SDK 绑定。

## 快速导航

- [快速开始](guide/quickstart.md) — 60 秒内启动自托管服务
- [SDK 集成](sdk/web.md) — iOS / Android / Web 接入指南
- [API 参考](api/resolutions.md) — 完整接口文档

## 工作原理

```
用户 A 分享链接 → 用户 B 点击访问 → JS SDK 采集指纹
→ 用户 B 安装 App → 首次启动调用 /api/v1/resolutions
→ 返回邀请码（置信度 0.94）
```

三级归因通道：

| 通道 | 方式 | 准确率 |
|------|------|--------|
| Redis 精确匹配 | 哈希完全一致 | ~100% |
| PostgreSQL 模糊匹配 | 多维特征加权评分 | >85% |
| Android 剪贴板 | 兜底方案 | 取决于系统版本 |
