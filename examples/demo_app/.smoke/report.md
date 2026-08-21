# 核心链路冒烟报告 2026-08-21

被测对象：**延迟深链归因主链路** —— 浏览器指纹上报 → 后端匹配 → 原生 SDK `resolveDeferred()`。
真实运行，无 mock：真 Chrome、真 JS SDK、真 Kotlin SDK、真 Express 后端、真 Postgres/Redis。

## 结论

**Android 主链路在明文 http 落地页下通过；但存在一个会在生产 https 落地页下必然触发的
匹配缺陷（D1），未修复前不建议按现状发版。** iOS 未跑（本机无真机，模拟器不适用，见覆盖缺口）。

## 环境

| 项 | 值 |
|---|---|
| 设备 | Android 模拟器 Pixel_10a，Android 17 (API 37)，1080×2424 @420dpi |
| 后端 | 本地 `npm run dev`，`NODE_ENV=development`，`MULTI_TENANT=false` |
| 依赖 | Postgres 16（宿主 5435，5432 被占）、Redis 7（6379） |
| 设备侧地址 | `http://10.0.2.2:6066` |
| 工具 | Flutter 3.44.9 / Maestro 2.8.0 / JDK 17 |

## 用例结果

| 用例 | 平台 | 结果 | 备注 |
|---|---|---|---|
| C1 同设备点击后可解析 | android | **通过** | 后端复核：`conversions` 落库 `fuzzy / confidence 1.0 / ANDROID` |
| C2 无点击不得凭空匹配 | android | **通过** | 返回 `matched:false`，未产生 conversion |
| 契约探针 A（https 落地页） | — | **失败** | 见 D1 |
| 契约探针 B/C | — | 通过 | 对照组 |

## 缺陷

### D1（严重）Android 在 https 落地页下恒不匹配 — `osVersion` 硬否决

**现象**：web 侧与 native 侧来自同一台设备，仍返回 `matched:false`，exact 与 fuzzy 双双落空。

**根因**：`backend/src/utils/fingerprint.ts` 的 `normalizeOsVersion()` 对
`"17.0"` 返回 `17.0`、对 `"17"` 返回 `17`，两者不等。而：

- web 侧：`sdk/js/src/FingerprintCollector.ts` 用 UA-CH `platformVersion`（如 `"17.0.0"`）
  截成 `"17.0"`。Chrome 把 UA 字符串冻结在 `Android 10`，后端只能依赖 UA-CH。
- native 侧：`FingerprintCollector.kt` 用 `Build.VERSION.RELEASE`，Android 10–17 都是纯主版本号 `"17"`。

`computeSimilarityScore()` 开头对 osVersion 不一致直接 `return 0`（硬否决），
`computeFingerprint()` 的哈希也把它算进去 —— 所以两条通道同时失效。

**为什么本次 UI 冒烟没红**：冒烟走明文 http，非安全上下文下 `navigator.userAgentData`
不可用，web 侧 `osVersion` 为空，"仅一侧有该信号"不参与打分也不触发否决，于是走 fuzzy 通过。
生产落地页是 https，UA-CH 生效，缺陷必然显现。**这类"测试环境恰好绕开"的掩盖最危险。**

**复现**：`bash examples/demo_app/.smoke/contract_probe.sh`，A 组即为该场景。

**涉及文件**：`backend/src/utils/fingerprint.ts`（`normalizeOsVersion`）、
`sdk/js/src/FingerprintCollector.ts`（`collectAndroidOsVersion`）。

**建议修法**（未实施，属存量代码，待决策）：在 `normalizeOsVersion()` 里把零 minor 归一，
使 `"17.0"` 与 `"17"` 归一化到同一个值：

```ts
const match = version.match(/(\d+)[._](\d+)/);
if (match) return match[2] === '0' ? match[1] : `${match[1]}.${match[2]}`;
```

修完 A/B/C 三组应全部匹配。因为它同时改变 `computeFingerprint` 的哈希，
上线时窗口期内的存量 click 会失去 exact 命中，但仍可走 fuzzy，属可接受。

### D2（低）示例项目写死了他人的局域网 IP

`examples/web/fingerprint-demo.html` 与 `examples/demo_app/lib/main.dart` 的默认地址是
`http://192.168.9.251:6066/api`，任何其他机器上都跑不通，属阻塞测试进行的配置级缺陷。
**已修复**：落地页默认取 `location.origin`，并支持 `?api=&code=&key=&auto=1`；
demo app 改为 `--dart-define=SI_API_BASE_URL` 覆盖，缺省按平台取模拟器可达地址。

## 自愈记录

四轮修复全部针对**测试自身的技术缺陷**，未放宽任何业务断言：

1. Chrome 首次运行向导挡住落地页 → 过掉向导（设备起始态，不改用例）。
2. 断言挂在落地页动态插入的日志节点上，Chrome 不把它稳定暴露给无障碍树 →
   删掉该中间断言，改为等待；点击是否成功由「App 必须拿回该邀请码」这条业务断言反向保证。
3. `assertVisible` 是整串正则匹配而非子串，带时间戳前缀的控制台日志匹配不上 → 改写为 `.*…*.`。
4. 结果卡片渲染在可滚动区域下方 → 补 `scrollUntilVisible`。

业务断言自始至终未变：C1 断言「拿回的邀请码等于本轮点击的那个」，C2 断言「明确返回未匹配」。

## 覆盖缺口

- **iOS 未跑**：本机未连真机。iOS 模拟器不适用 —— 后端从 Safari UA 取 iOS 版本，
  模拟器的 `iPhone OS` 段是内核版本、`Version/` 段才是公开版本，与原生
  `UIDevice.systemVersion` 常有 minor 差异，会踩到同一个 osVersion 硬否决。
  iOS 必须真机验证。
- **真机未跑**：`adb devices` 与 `xcrun devicectl list devices` 均无实体设备。
  接上设备后执行：`bash .smoke/run_core_smoke.sh --case all --host <本机LAN IP>`。
- **clipboard 通道**（Android 第三通道）未纳入，需落地页配合写剪贴板。
- **https 落地页场景**未纳入 UI 冒烟，目前只由契约探针覆盖。
