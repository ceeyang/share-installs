# Project AI Work Log

## [2026-04-10 21:14] Antigravity
**任务ID**：INIT-PROTOCOL  
**操作**：协作规范化  
**描述**：根据用户要求，格式化 `COLLABORATION_PROTOCOL.md` 并正式将其作为多 AI 协作的执行标准。初始化 `AI_WORK_LOG.md` 以记录后续操作。  
**影响文件**：COLLABORATION_PROTOCOL.md, AI_WORK_LOG.md  
**状态**：已完成
---

## [2026-04-10 21:25] Antigravity
**任务ID**：TASK-CLAUDE-CONFIG  
**操作**：文档规范化  
**描述**：重构并格式化 `CLAUDE.md`，强化多 AI 协作规则，确保 Claude 与 Gemini 共享同一套维护协议。  
**影响文件**：CLAUDE.md  
**状态**：已完成
---

## [2026-04-10 22:00] Claude
**任务ID**：TASK-PROTOCOL-V2.1  
**操作**：协作规范升级  
**描述**：简化启动流程（6 文件 → 2 文件按需读）；在协议中加入职责边界和 append-only 范围；为 AI_COLLAB_STATUS.md 的 Persistent Notes 区块加保护标记；新建两个 knowledge_base 文件（Redis 限流 key 冲突、指纹匹配约束）。  
**影响文件**：CLAUDE.md, COLLABORATION_PROTOCOL.md, AI_COLLAB_STATUS.md, .agent/knowledge_base/redis_rate_limiting.md, .agent/knowledge_base/fingerprint_matching.md  
**状态**：已完成
---

## [2026-04-11 01:00] Claude
**任务ID**：TASK-DOCS-SYNC  
**操作**：文档同步  
**描述**：同步重构后的文档。README：重写 Backend API 部分（旧端点 /v1/track-click、/v1/invites 全部替换为 /v1/clicks、/v1/resolutions，删除 Create Invite 示例，补充完整 curl 示例和响应格式）；SDK Integration 示例移除商店跳转逻辑，明确分工边界；环境变量表删除已移除的 INVITE_CODE_LENGTH、INVITE_DEFAULT_TTL_DAYS、INVITE_LINK_BASE_URL 等。docs/architecture.md：完整重写，阐明职责边界、新数据模型（无 Invite 表）、两种部署模式说明。  
**影响文件**：README.md、docs/architecture.md  
**状态**：已完成
---

## [2026-04-11 00:30] Claude
**任务ID**：TASK-CORE-REFACTOR  
**操作**：架构重构（删减）  
**描述**：按产品需求重新定义系统职责——只做指纹收集和匹配，邀请码由调用方管理。删除 inviteService、inviteController、linkService 三个文件；重构 Prisma schema（删除 Invite 模型、InviteStatus 枚举，ClickEvent/Conversion 改用 inviteCode 字符串直存 + customData JSON）；简化 FingerprintService（collectClick 不再验证邀请码，直接存储；tryClipboardMatch 无需 DB 查询）；ResolveController 移除 InviteService 依赖；routes 仅保留 POST /v1/clicks、POST /v1/resolutions、GET /health 及项目管理端点；config 移除 INVITE_CODE_LENGTH、INVITE_DEFAULT_TTL_DAYS、INVITE_LINK_BASE_URL；crypto.ts 只保留 sha256；rateLimit 移除 inviteCreateRateLimiter；移除 nanoid 依赖。  
**影响文件**：schema.prisma、fingerprintService.ts、resolveController.ts、routes/index.ts、config/index.ts、utils/crypto.ts、middleware/auth.ts、middleware/rateLimit.ts、.env.example、package.json（删除：inviteService.ts、inviteController.ts、linkService.ts）  
**状态**：已完成
---

## [2026-04-10 23:55] Claude
**任务ID**：TASK-README-LOCALDEV  
**操作**：文档更新  
**描述**：在根目录 README.md 的「Deployment Modes」中新增「本地调试」方案（方案3）：Docker 只启动 db + redis，代码本地 `npm run dev`。包含 Step-by-step 命令、常见报错对照表（Redis ECONNREFUSED、Prisma P1001 等）。原「Bare Metal」升级为 Homebrew 全本地安装说明，Kubernetes 序号由 4 改为 5。  
**影响文件**：README.md  
**状态**：已完成
---

## [2026-04-10 23:35] Antigravity
**任务ID**：TASK-SDK-DEMO  
**操作**：新增  
**描述**：创建 Flutter Demo App 作为原生 SDK 测试宿主。iOS 通过 CocoaPods 本地路径引用 `sdk/ios`（ShareInstalls pod），Android 通过 Gradle composite build 引用 `sdk/android`。使用 MethodChannel 桥接 native SDK（configure/resolveDeferred/clearCache/getSDKInfo）到 Flutter UI。同时创建 Web 指纹采集 Demo 和 API Playground。iOS 模拟器构建已验证通过。  
**影响文件**：examples/demo_app/（Flutter 项目）, examples/web/fingerprint-demo.html, examples/web/api-playground.html, examples/README.md  
**状态**：已完成
---

## [2026-04-11 00:22] Antigravity
**任务ID**：TASK-EXAMPLES-SYNC  
**操作**：重写  
**描述**：根据 Claude 的架构重构（删除 Invite CRUD，ClickEvent 直存 inviteCode），同步重写所有 examples。fingerprint-demo.html 移除邀请创建逻辑，只保留 Track Click + Resolve 两步流程；api-playground.html 移除 /v1/invites 全部端点；Flutter main.dart 默认端口改为 6066；examples/README.md 全面更新；修复 app.ts 静态文件日志路径。  
**影响文件**：examples/web/fingerprint-demo.html, examples/web/api-playground.html, examples/demo_app/lib/main.dart, examples/README.md, backend/src/app.ts  
**状态**：已完成
---

## [2026-04-11 00:52] Antigravity
**任务ID**：TASK-FINGERPRINT-FIX  
**操作**：修复  
**描述**：修复 iOS 模拟器下 Web 指纹与 App 指纹匹配失败（No match）的问题。原因：1. App SDK 采集的是物理像素（加上 scale），Web SDK 采集的是逻辑坐标，导致分辨率不匹配；2. 后端没有从 Web 端的 User-Agent 中提取 `osVersion` 存入数据库，丢失了 OS 版本匹配权重 (8分)。已在 `resolveController.ts` 中针对 App 分辨率通过 `scale` 除法归一化，并在记录 ClickEvent 时提取 `osVersion`，同时补全了匹配过程的详细日志输出。  
**影响文件**：backend/src/controllers/resolveController.ts, backend/src/utils/fingerprint.ts  
**状态**：已完成
---

## [2026-04-11 00:54] Antigravity
**任务ID**：TASK-SDK-JS-UPDATE  
**操作**：更新  
**描述**：根据用户要求，调整 web demo 使用真正的 `sdk/js` 浏览器包。首先给 Web SDK 的 `trackClick(inviteCode)` 增加了 `customData` 参数支持并重构编译。然后在 `fingerprint-demo.html` 里移除了硬编码的指纹和网络请求代码，改为通过 `<script src="../../sdk/js/dist/umd/share-installs-sdk.min.js">` 引用打包后的 Web SDK 进行数据采集与上报。  
**影响文件**：sdk/js/src/InviteSDK.ts, examples/web/fingerprint-demo.html  
**状态**：已完成
---

## [2026-04-11 00:58] Antigravity
**任务ID**：TASK-SDK-SUPER-SIMPLE  
**操作**：精简重构  
**描述**：大幅精简了 Web SDK 和对应的 HTML Demo 以符合“一句话极简集成”要求。为 `ShareInstalls` 导出了 `ShareInstalls.trackClick({...})` 的顶层方法，无需手动 new 实例即可完成采集与上报。同时把 `fingerprint-demo.html` 重写为一个所见即所得的极简落地页代码模板（仅 70 行），清除了原先所有的测试输入框和调试面板。开发者只需复制 `<script>` 标签和 `ShareInstalls.trackClick` 函数调用即可完成全量集成。  
**影响文件**：sdk/js/src/index.ts, examples/web/fingerprint-demo.html  
**状态**：已完成
---

## [2026-04-11 09:47] Antigravity
**任务ID**：TASK-SDK-NULL-VALIDATION  
**操作**：修复  
**描述**：修复了 Web 端 `POST /v1/clicks` 时报 `INVALID_ARGUMENT (fingerprint.hardware.memory)` 错误的问题。由于 Safari 等部分浏览器不支持 `navigator.deviceMemory` 导致 JS SDK 回传值为 `null`，而原先后端 `express-validator` 获取 `optional()` 时不允许传 `null`，只允许缺省 (`undefined`)。已在 `resolveController.ts` 为所有允许可选的设备特征参数上添加了 `{nullable: true}` 参数进行宽容处理。  
**影响文件**：backend/src/controllers/resolveController.ts  
**状态**：已完成
---

## [2026-04-11 16:30] Claude
**任务ID**：TASK-CONFIDENCE-IMPROVE  
**操作**：修复 + 优化  
**描述**：分析 inviteCode=Ohhh 置信度 0.795 原因，定位三个问题并修复。①screen 丢 20 分：Android SDK 用 `toInt()` 截断除法，浏览器用四舍五入，同一设备差 1px；后端 screen 比较改为 ±2px 容差（min/max 对方向无关）。②pixelRatio 浮点噪音：2.549999952316284 vs 2.55；改为乘以 100 取整后比较，吸收 float32→float64 精度损失。③Android SDK 未采集 hardwareConcurrency/touchPoints，web 有数据（8核/5点）但 native 侧 available=false，9 分白白不参与；Android SDK 新增 `Runtime.getRuntime().availableProcessors()` 和 `getTouchPoints()`，后端 resolve validator 和 resolveInvite 调用同步新增字段。实测同一设备评分 0.795 → 1.0。  
**影响文件**：backend/src/utils/fingerprint.ts, backend/src/controllers/resolveController.ts, sdk/android/invitesdk/src/main/kotlin/com/invitesdk/fingerprint/FingerprintCollector.kt  
**状态**：已完成
---

## [2026-04-11 16:05] Claude
**任务ID**：TASK-CLIPBOARD-FALLBACK  
**操作**：修复 + 新增  
**描述**：①修复后端 resolve 顺序：剪切板原为最高优先级（Channel 1），改为指纹匹配失败后的最终 fallback（Channel 3）；②Web SDK `trackClick` 在 Android Chrome 上新增 `navigator.clipboard.writeText("SHAREINSTALLS:{inviteCode}")`，不需用户授权弹窗（页面聚焦时即可写入），iOS/非安全上下文静默忽略；③重新构建 UMD 包。  
**影响文件**：backend/src/services/fingerprintService.ts, sdk/js/src/InviteSDK.ts, sdk/js/dist/umd/share-installs-sdk.min.js  
**状态**：已完成
---

## [2026-04-11 12:20] Claude
**任务ID**：TASK-OLD-INVITECODE-MATCH  
**操作**：修复  
**描述**：修复更新邀请码后 iOS 仍返回旧邀请码的问题。根因一：`computeFingerprint` 包含完整 languages 数组，iOS `["zh-Hans-CN","en"]` vs Web `["zh-CN","en-US"]` 哈希不同，精确匹配永远 miss，降级到模糊匹配；修复：移除 languages，改用 IP/24 + timezone + screen(min/max) + pixelRatio，稳定且跨平台一致。根因二：同一设备有旧/新两条 ClickEvent 时评分打平，`score > bestScore` 严格大于无法确定哪条胜出，依赖 DB 返回顺序；修复：`findMany` 加 `orderBy: {createdAt: 'desc'}`（最新优先），打平时自动选最新 ClickEvent（即新邀请码）。  
**影响文件**：backend/src/utils/fingerprint.ts, backend/src/services/fingerprintService.ts  
**状态**：已完成
---

## [2026-04-11 12:00] Claude
**任务ID**：TASK-REMOVE-CACHE-FIX-409  
**操作**：修复  
**描述**：修复 409 ALREADY_EXISTS 错误。根源：`Conversion.clickEventId` 有 `@unique` 约束，移除重复匹配限制后同一 ClickEvent 可多次触发 Conversion 创建，违反唯一约束。变更：①`Conversion.clickEventId` 去掉 `@unique`，改为普通 `@@index`；②`ClickEvent` 的 `conversion Conversion?` 关系改为 `conversions Conversion[]`；③删除 `ClickEvent` 上已无意义的 `resolved`/`resolvedAt` 字段及相关索引；④清理 `fingerprintService.ts` 中所有 `resolved` 字段引用；⑤`prisma db push --accept-data-loss` 同步数据库。  
**影响文件**：backend/prisma/schema.prisma, backend/src/services/fingerprintService.ts  
**状态**：已完成
---

## [2026-04-11 11:30] Claude
**任务ID**：TASK-CACHE-RESOLVED-INVITE  
**操作**：修复  
**描述**：移除"已解析则报错"的错误行为，改为"已解析则返回缓存结果"。iOS：`InviteCodeResolver.swift` 将完整 ResolvedInvite（code + channel + confidence + customData）用 JSONSerialization 序列化到 UserDefaults，二次调用直接反序列化返回，无需网络请求；移除 `alreadyResolved` 错误 case 及对应 throw。Android：同等改造，用 `kotlinx.serialization` 序列化 CachedResolution 到 SharedPreferences，解码失败时自动清理缓存并重新 resolve；移除 `AlreadyResolved` 异常。两端卸载重装均会清除本地缓存，届时自动重新匹配。  
**影响文件**：sdk/ios/Sources/InviteSDK/Resolver/InviteCodeResolver.swift, sdk/ios/Sources/InviteSDK/InviteSDK.swift, sdk/android/invitesdk/src/main/kotlin/com/invitesdk/resolver/InviteCodeResolver.kt  
**状态**：已完成
---

## [2026-04-11 11:10] Claude
**任务ID**：TASK-FINGERPRINT-QUALITY  
**操作**：修复 + 新增  
**描述**：系统性修复指纹匹配质量问题。①`computeFingerprint` 移除 UA/canvas/webgl/audio 等 web-only 字段，改为只用跨平台信号（IP/24、languages、timezone、screen、pixelRatio），使精确匹配通道在生产中实际可用；②屏幕比较改为方向无关（排序后比较 min/max 对），解决横竖屏切换导致 20 分丢失的问题；③`isSameSubnet` 支持 IPv6 /48 前缀比较；④`markClickResolved` 修复 Redis key 删除 bug（改为删 web 指纹 hash 而非原生信号 hash）；⑤clipboard match 补 DB 查询恢复 customData；⑥新增诊断端点 `GET /v1/debug/clicks/:inviteCode`（非生产环境），返回存储的 ClickEvent 信号供对比排查。  
**影响文件**：backend/src/utils/fingerprint.ts, backend/src/services/fingerprintService.ts, backend/src/controllers/resolveController.ts, backend/src/routes/index.ts  
**状态**：已完成
---

## [2026-04-11 10:45] Claude
**任务ID**：TASK-ANDROID-FINGERPRINT-FIX  
**操作**：修复  
**描述**：修复 Android SDK 与 iOS 相同的指纹匹配问题。①`InviteCodeResolver.kt`：重写 `ResolveResponse` 数据类，从 `invite.code`/`invite.customData` 改为顶层 `inviteCode`/`customData`，下游代码同步更新；②`FingerprintCollector.kt`：屏幕尺寸从 `widthPixels`/`heightPixels`（物理像素）改为 `(widthPixels/density).toInt()`（逻辑 dp），与 Web 端 CSS `window.screen.width` 对齐；后端无需额外除法（iOS/Android SDK 均已自行归一化）。  
**影响文件**：sdk/android/invitesdk/src/main/kotlin/com/invitesdk/resolver/InviteCodeResolver.kt, sdk/android/invitesdk/src/main/kotlin/com/invitesdk/fingerprint/FingerprintCollector.kt  
**状态**：已完成
---

## [2026-04-11 10:30] Claude
**任务ID**：TASK-IOS-FINGERPRINT-FIX  
**操作**：修复  
**描述**：修复 iOS 模拟器指纹匹配失败的 4 个根因。①`InviteCodeResolver.swift`：响应解析从 `response.invite?.code` 改为 `response.inviteCode`（顶层字段），匹配架构重构后的 API 返回格式；②`FingerprintCollector.swift`：`nativeBounds`（物理像素，iPhone 15=1179×2556）改为 `bounds`（逻辑点，393×852），与 Web SDK 的 CSS 像素对齐；③`resolveController.ts`：移除 `Math.round(w / scale)` 除法（iOS 现在直接发逻辑点，不需要后端归一化）；④`fingerprint.ts` `firstLanguage()`：从 `.slice(0, 5)` 改为 `.split('-')[0]`，解决 `zh-Hans-CN`（iOS）vs `zh-CN`（Web）主语言标签不匹配问题。  
**影响文件**：sdk/ios/Sources/InviteSDK/Resolver/InviteCodeResolver.swift, sdk/ios/Sources/InviteSDK/Fingerprint/FingerprintCollector.swift, backend/src/controllers/resolveController.ts, backend/src/utils/fingerprint.ts  
**状态**：已完成
---

## [2026-04-11 09:55] Antigravity
**任务ID**：TASK-SDK-SUPER-SIMPLE-FIX  
**操作**：调整  
**描述**：根据用户要求，在极简版的 `fingerprint-demo.html` 着陆页模型中，重新恢复了 API Base URL, API Key 和 Invite Code 的动态输入框，以便于 Demo 测试时能够修改上报接口和邀新参数。依然保留了极其克制且整洁的落地页样式风格。  
**影响文件**：examples/web/fingerprint-demo.html  
**状态**：已完成
---

## [2026-04-11 11:24] Antigravity
**任务ID**：TASK-SDK-BUILD-FIX  
**操作**：修复  
**描述**：由于此前针对指纹解析器作了无状态重构，移除了内部的缓存状态管理方法和相关异常（如 `clearCachedResolution` 与 `AlreadyResolved`），但遗漏了对应封装层的更新。本次修复清理了 `InviteSDK.kt` 中冗余的 `clearCachedResolution()` 方法，清理了 Android Demo 主层面的此方法调用及相关过时异常的捕获。同时在 Demo 层引入了 Kotlin 原本缺失的 serialization 依赖，彻底修复了 Android Demo 和 Flutter 端集成的编译阻断错误。  
**影响文件**：sdk/android/invitesdk/src/main/kotlin/com/invitesdk/InviteSDK.kt, examples/demo_app/android/app/src/main/kotlin/com/shareinstalls/demo_app/MainActivity.kt, examples/demo_app/android/app/build.gradle.kts  
**状态**：已完成
---

## [2026-04-11 17:00] Claude
**任务ID**：TASK-CICD-PRODUCTION
**操作**：新增
**描述**：完成上线前 CI/CD 准备工作，新增 4 个 GitHub Actions workflow。①`.github/workflows/backend-ci.yml`：后端 lint/type-check/test（含 PostgreSQL + Redis 服务容器）+ Docker 镜像构建并推送 GHCR（`sha-{commit}` + `latest` tag，仅 main push 触发）。②`.github/workflows/sdk-js.yml`：JS SDK lint/type-check/test/build，`sdk-js-v*` tag 触发时自动从 tag 提取版本并 `npm publish --provenance`（需 `NPM_TOKEN` secret）。③`.github/workflows/sdk-android.yml`：Android SDK Gradle 单元测试 + lint，`sdk-android-v*` tag 触发时发布到 GitHub Packages Maven repository（使用 `GITHUB_TOKEN`，无需额外 secret）。④`.github/workflows/sdk-ios.yml`：macOS-14 (Apple Silicon) 上 `swift build` + `swift test`，`sdk-ios-v*` tag 触发时创建 GitHub Release 并附带 SPM 安装指引。所有 workflow 均配置路径过滤（path filter），只在对应子目录有改动时触发，避免无关触发。同步更新了 `sdk/js/package.json`（publishConfig + repository）和 `sdk/android/invitesdk/build.gradle.kts`（GitHub Packages 仓库配置）。
**影响文件**：.github/workflows/backend-ci.yml, .github/workflows/sdk-js.yml, .github/workflows/sdk-android.yml, .github/workflows/sdk-ios.yml, sdk/js/package.json, sdk/android/invitesdk/build.gradle.kts
**状态**：已完成
---
