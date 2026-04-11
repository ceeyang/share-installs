# share-installs 开发进度

## 已完成

### Module 1: Backend ✅

**变更文件：**
- `backend/prisma/schema.prisma` — 新增 `Project`/`ApiKey` 模型；`ClickEvent` 增加 canvas/webgl/audio hash、hardware、touchPoints、languages、pixelRatio 等字段；`Invite`/`ClickEvent`/`Conversion` 增加可选 `projectId`
- `backend/src/config/index.ts` — 新增 `MULTI_TENANT` 开关，TTL 改为 72h，阈值改为 0.75；移除旧的 app identity 配置
- `backend/src/middleware/errorHandler.ts` — 错误格式改为 Google API 标准 `{error:{code,status,message}}`
- `backend/src/middleware/auth.ts` — 支持单租户（ADMIN_SECRET）和多租户（API Key）双模式；`createManagementAuth` 工厂函数自动选择
- `backend/src/utils/fingerprint.ts` — `FingerprintSignals` 增加新字段；评分算法改为 available-based（仅统计两端均有数据的字段）；canvas/webgl/audio 在 web-to-web 中计分，不影响 web-to-native 评分
- `backend/src/routes/index.ts` — 路由重命名为 Google API 风格：`/v1/fingerprints:collect`、`/v1/fingerprints:resolve`；按 MULTI_TENANT 模式分叉路由；新增 project management 路由
- `backend/src/controllers/resolveController.ts` — 接受完整指纹字段（canvas/webgl/audio/hardware/native iOS+Android）
- `backend/src/controllers/inviteController.ts` — 支持 projectId 隔离、自定义 code；移除 LinkService 依赖
- `backend/src/services/fingerprintService.ts` — 支持剪切板通道（Android）、projectId 隔离、存储完整指纹字段；剪切板格式 `SHAREINSTALLS:{projectId}:{code}` 或 `SHAREINSTALLS:{code}`
- `backend/src/services/inviteService.ts` — 支持 projectId 隔离、自定义 code、改用 findFirst 替代 findUnique
- `backend/.env.example` — 更新配置项，移除 app identity 相关项

**新增文件：**
- `backend/src/services/apiKeyService.ts` — 多租户项目和 API Key 管理
- `backend/src/controllers/projectController.ts` — 多租户管理接口
- `backend/jest.config.js` — Jest 配置（ts-jest）
- `backend/tests/setup.ts` — 测试环境变量注入
- `backend/tests/unit/fingerprint.test.ts` — 指纹算法单元测试（13 用例）
- `backend/tests/unit/inviteService.test.ts` — InviteService 单元测试（8 用例）

**测试结果：** 21/21 通过

**待执行（需数据库连接）：**
```bash
cd backend && npx prisma migrate dev --name add-multitenancy-and-rich-fingerprint
```

---

### Module 2: Web SDK ✅

**变更文件：**
- `sdk/js/src/types.ts` — `BrowserFingerprint` 增加 canvas/webgl/audio hash、screen(dpr/depth)、hardware、languages、touchPoints、connection；`ShareInstallsOptions` 增加可选 `apiKey`；`TrackClickResult.clickEventId` → `eventId`
- `sdk/js/src/FingerprintCollector.ts` — 新增 Canvas 指纹（FNV-1a hash）、WebGL 指纹（vendor+renderer+render hash）、Audio 指纹（AudioContext）；新增 hardwareConcurrency、deviceMemory、maxTouchPoints、languages array、connection info
- `sdk/js/src/ApiClient.ts` — 支持 `Authorization: Bearer <apiKey>` header；错误解析兼容 Google 格式和旧格式
- `sdk/js/src/InviteSDK.ts` — 调用路径改为 `/v1/fingerprints:collect`；传递完整 fingerprint 对象；支持 apiKey 配置项

**新增文件：**
- `sdk/js/jest.config.js`
- `sdk/js/tests/FingerprintCollector.test.ts` — 7 用例（jsdom 环境，canvas/webgl 返回 null 是预期行为）

**测试结果：** 7/7 通过

---

### Module 3: iOS SDK ✅

**变更文件：**
- `sdk/ios/Sources/InviteSDK/Core/Configuration.swift` — 增加可选 `apiKey`；移除 `urlScheme`、`deepLinkCacheMaxAge`
- `sdk/ios/Sources/InviteSDK/Core/Logger.swift` — 新增 `warning` 级别
- `sdk/ios/Sources/InviteSDK/Fingerprint/FingerprintCollector.swift` — 完全重写：增加 `keychainUuid`（最强稳定标识）、`networkType`（Reachability，无需授权）、`diskBucket`（存储容量档位）、`languages`（数组）；更新 `Signals` 为新 schema
- `sdk/ios/Sources/InviteSDK/Network/APIClient.swift` — 发送 `Authorization: Bearer <apiKey>` header；错误解析支持 Google 格式
- `sdk/ios/Sources/InviteSDK/Resolver/InviteCodeResolver.swift` — 接口路径改为 `/v1/fingerprints:resolve`；请求体改为 `{channel, fingerprint}`；`ResolvedInvite.matchType` → `channel`（支持 clipboard）
- `sdk/ios/Sources/InviteSDK/InviteSDK.swift` — 移除 `handleUniversalLink`、`handleDeepLink` 方法（不在需求范围）

**新增文件：**
- `sdk/ios/Sources/InviteSDK/Core/Keychain.swift` — Keychain UUID 持久化（卸载重装后保留）

**删除文件：**
- `sdk/ios/Sources/InviteSDK/DeepLink/DeepLinkHandler.swift`

---

### Module 4: Android SDK ✅

**变更文件：**
- `sdk/android/invitesdk/src/main/kotlin/com/invitesdk/core/Configuration.kt` — 增加可选 `apiKey`；移除 `uriScheme`
- `sdk/android/invitesdk/src/main/kotlin/com/invitesdk/fingerprint/FingerprintCollector.kt` — 完全重写：增加 `androidId`（Settings.Secure）、`networkType`（ConnectivityManager）、`diskBucket`、`buildFingerprint`（Build.FINGERPRINT）、`languages`（数组）、`brand`、`density`
- `sdk/android/invitesdk/src/main/kotlin/com/invitesdk/network/ApiClient.kt` — 发送 `Authorization: Bearer <apiKey>` header（修复原有 `.addHeader()` 空调用 bug）
- `sdk/android/invitesdk/src/main/kotlin/com/invitesdk/resolver/InviteCodeResolver.kt` — 接口路径改为 `/v1/fingerprints:resolve`；请求体增加 `clipboardCode`；`ResolvedInvite` 增加 `CLIPBOARD` 渠道
- `sdk/android/invitesdk/src/main/kotlin/com/invitesdk/InviteSDK.kt` — 移除 `handleIntent` 方法（不在需求范围）

**新增文件：**
- `sdk/android/invitesdk/src/main/kotlin/com/invitesdk/fingerprint/ClipboardReader.kt` — 安全读取剪切板，验证 `SHAREINSTALLS:` 前缀，读取后清除

**删除文件：**
- `sdk/android/invitesdk/src/main/kotlin/com/invitesdk/deeplink/DeepLinkHandler.kt`

---

## 剩余工作

### 需要数据库才能完成
- [ ] 执行 Prisma 迁移：`cd backend && npx prisma migrate dev --name add-multitenancy-and-rich-fingerprint`

### 建议后续完善
- [ ] 集成测试（需要 PostgreSQL + Redis）
- [ ] Web SDK 构建配置（rollup CDN bundle）
- [ ] iOS SDK SPM 发布配置
- [ ] Android SDK Maven Central 发布配置
- [ ] docker-compose.yml 更新（移除旧的 app identity 环境变量）
