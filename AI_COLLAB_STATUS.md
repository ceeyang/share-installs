# AI Collaboration Status

## 1. Project Health & Current Phase

- **Phase**: Production CI/CD Ready
- **Status**: 已完成所有上线前 CI/CD 准备工作。后端 Docker 发布 (GHCR)、JS SDK npm publish、Android SDK GitHub Packages publish、iOS SDK SPM release 均已配置完毕。

---

## 2. Recent Activity Log（最近 5 条，FIFO）

- [2026-04-11 17:00] [Claude] 完成 CI/CD 上线准备：backend-ci + sdk-js + sdk-android + sdk-ios 四个 GitHub Actions workflow
- [2026-04-11 10:30] [Claude] 修复 iOS 指纹匹配 4 个 Bug（响应解析/nativeBounds/scale除法/CJK语言）
- [2026-04-11 01:00] [Claude] 同步文档：README API 部分 + docs/architecture.md 完整重写
- [2026-04-11 00:30] [Claude] 架构重删：移除 Invite CRUD，schema 去掉 Invite 模型，ClickEvent 直存 inviteCode
- [2026-04-10 23:55] [Claude] 新增 README 本地调试方案（Docker 只启基础设施 + npm run dev）
- [2026-04-10 21:25] [Antigravity] 重构 CLAUDE.md，强化多 AI 协作规则

---

## 3. Persistent Technical Notes（⚠️ 仅追加，禁止删除或修改已有条目）

- [Critical][Claude][2026-04-10] **IPv6 归一化**：`extractClientIp` 必须将 `::ffff:{ip}` 转换为 `{ip}`，否则反向代理场景下指纹匹配会失败。见 `resolveController.ts`。
- [Critical][Claude][2026-04-10] **Redis 限流 Key 冲突**：多个 rate limiter 共享 Redis 时，必须为每个 store 指定独立前缀（`rl:api`、`rl:resolve`），否则计数器互相消耗，提前触发 429。见 `rateLimit.ts`。
- [Critical][Antigravity][2026-04-10] **JS SDK 测试**：不可用全局 `jest.mock` 覆盖共享类；改用 `jest.spyOn` + `mockRestore`，防止 mock 泄漏到其他测试文件。
- [Critical][Antigravity][2026-04-10] **Android 权限**：SDK 所需的 `ACCESS_NETWORK_STATE` 是 normal-level 权限，无需用户授权弹窗。
- [Critical][Claude][2026-04-11] **架构重构**：Invite 模型已删除，ClickEvent 改为直存 `inviteCode`（string）+ `customData`（JSON）。`rl:invite` 限流前缀已废弃（对应的 inviteCreateRateLimiter 已移除）。所有引用 `InviteService`、`inviteController`、`LinkService` 的测试需同步删除或重写。
- [Critical][Claude][2026-04-11] **iOS 指纹匹配 4 个 Bug**：①`InviteCodeResolver.swift` 响应模型从 `invite.code` 改为 `inviteCode`（顶层字段）；②`FingerprintCollector.swift` 从 `nativeBounds`（物理像素）改为 `bounds`（逻辑点）才能与 Web CSS px 对齐；③后端 `resolveController.ts` 移除了 `/scale` 除法（iOS 现在直接发逻辑点）；④`fingerprint.ts` `firstLanguage()` 改为按 `-` 分割取第一段，解决 `zh-Hans-CN` vs `zh-CN` 不匹配问题。

---

## 4. Active TODO

- [ ] **Phase 4**: Prometheus 指标 + Grafana 监控面板（优先级：中）
- [ ] **Phase 5**: 生产环境部署（优先级：低）

---

## 5. Next Step / Handover

- **下一步**：
  1. 在 GitHub 仓库 Settings → Secrets 添加 `NPM_TOKEN`（JS SDK 发布需要）
  2. 发布第一个 SDK 版本：`git tag sdk-js-v1.0.0 && git push origin sdk-js-v1.0.0`
  3. 同理打 `sdk-android-v1.0.0` 和 `sdk-ios-v1.0.0` tag 触发各自发布
  4. 可选：接入 Phase 4 Prometheus 指标 + Grafana 监控面板
- **接手 AI**：CI/CD 已全部就绪。发布流程为 tag-based：`sdk-js-v*` → npm，`sdk-android-v*` → GitHub Packages，`sdk-ios-v*` → GitHub Release，后端 Docker 镜像在每次 main push 时自动构建。
