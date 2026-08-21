# 核心链路测试指南（延迟深链归因）

本文说明如何真实验证 share-installs 的核心能力：**同一台设备上，浏览器点了邀请链接、
装上 App 后首次启动，SDK 必须拿回同一个邀请码。**

测试全程不 mock：真实浏览器、真实原生 SDK、真实后端与 Postgres/Redis。

## 匹配是怎么成立的

后端按三条通道依次尝试（`backend/src/services/fingerprintService.ts`）：
exact 哈希 → fuzzy 加权相似度 → clipboard（Android 专有）。

fuzzy 的权重与阈值（`FINGERPRINT_MATCH_THRESHOLD`，默认 0.75）：

| 信号 | 权重 | web 来源 | Android 来源 | iOS 来源 |
|---|---|---|---|---|
| 屏幕宽高（±2 容差） | 25 | CSS `screen.width/height` | `dp = px / density` | `UIScreen.bounds` |
| IP（/24 网段） | 20 | 请求来源 IP | 同 | 同 |
| **osVersion** | 20 | UA-CH / Safari UA | `Build.VERSION.RELEASE` | `UIDevice.systemVersion` |
| 时区 | 15 | `Intl` | `TimeZone.getDefault` | `TimeZone.current` |
| 语言（主子标签） | 10 | `navigator.languages` | `configuration.locales` | `Locale.preferredLanguages` |
| 像素比 | 5 | `devicePixelRatio` | `density` | `screen.scale` |

**只有两侧都有的信号才计入分母**，所以某一侧缺失不会拉低得分。

> ⚠️ **osVersion 是硬否决**：两侧都有且归一化后不相等，直接判 0 分，其余信号再吻合也没用。
> 这是排查「同一台设备却匹配不上」时的第一嫌疑人。参见
> `examples/demo_app/.smoke/report.md` 缺陷 D1。

**前提**：点链接的浏览器和装 App 的设备必须是同一台。用电脑浏览器点、手机上装 App，
屏幕尺寸和 IP 都对不上，本来就不该匹配。

## 起测试环境

```bash
# 1. 依赖（5432 若被占用，换个端口并同步改 backend/.env 的 DATABASE_URL）
DB_PORT=5435 docker compose up db redis -d

# 2. backend/.env（关键项）
#    NODE_ENV=development  —— dev 下跳过限流，反复跑测试不会被 429
#    HOST=0.0.0.0          —— 真机要能从局域网访问
#    DATABASE_URL=postgresql://postgres:postgres@localhost:5435/share_installs

# 3. 后端
cd backend && npx prisma generate && npx prisma migrate deploy && npm run dev
curl http://localhost:6066/api/health
```

后端在非 production 下会把 `examples/` 与 `sdk/js/dist/` 挂成静态资源，
落地页地址即 `http://<host>:6066/examples/web/fingerprint-demo.html`。

## 自动化冒烟

```bash
cd examples/demo_app
bash .smoke/run_core_smoke.sh --case all                        # 模拟器
bash .smoke/run_core_smoke.sh --case all --host 192.168.1.20    # 真机，填本机 LAN IP
bash .smoke/contract_probe.sh                                   # 只验跨端指纹契约，不碰 UI
```

用例定义在 `.smoke/plan.md`，选择器契约在 `.smoke/registry.json`
（定位一律走 `Semantics(identifier:)`，不用文案匹配）。

### 真机步骤

1. 手机与开发机连同一 WiFi，确认 `curl http://<LAN IP>:6066/api/health` 在手机浏览器里能通。
2. 装 App：
   ```bash
   flutter run -d <device-id> --dart-define=SI_API_BASE_URL=http://<LAN IP>:6066/api
   ```
3. 跑冒烟：`bash .smoke/run_core_smoke.sh --case all --host <LAN IP>`。

手工验证走同样的路径：手机浏览器打开落地页 → 填邀请码 → Download App →
打开 demo app → Configure SDK → Resolve，结果卡片应显示同一个邀请码。

## 本机工具链坑位

- **JDK**：Flutter 优先用 Android Studio 自带的 JBR（当前是 25），对本项目的 Gradle 太新，
  报错只有一行版本号。指到 JDK 17：
  ```bash
  flutter config --jdk-dir="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
  ```
  换过 JDK 后**必须** `./gradlew --stop`，否则旧 daemon 仍以旧 JDK 运行。
  `flutter config --jdk-dir=` 可清空该设置。
- **Chrome 首次运行向导**会挡住落地页，模拟器上手动过一次即可，之后持久生效。
- **明文 HTTP**：Android 侧靠 `usesCleartextTraffic="true"`，iOS 侧靠
  `NSAllowsLocalNetworking`，demo app 两者都已配置。
- **非安全上下文**：http 下 `navigator.userAgentData` 不可用，web 侧 `osVersion` 恒为空。
  这会**掩盖** D1 类缺陷 —— http 下测试全绿不代表 https 生产环境没问题。

## 排查「同一台设备却匹配不上」

后端在非 production 下提供诊断端点，直接比对存下来的 web 信号：

```bash
curl http://localhost:6066/api/v1/debug/clicks/<邀请码> | python3 -m json.tool
```

拿它和移动端 SDK 实际发出的 `/v1/resolutions` 请求体逐字段对，
优先看 osVersion（硬否决）、屏幕宽高、IP 网段这三项。
