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

## 真机结果（2026-08-21，Redmi 220333QAG「fog」/ Android 13 / MIUI）

### ✅ 浏览器侧已在真机上验证通过

真机 Chrome 打开落地页、采集真实指纹并成功上报（`/v1/debug/clicks` 可查）。实际信号：

```
os_version=13.0  screen=360x825  pixel_ratio=2.0  timezone=Asia/Phnom_Penh
languages=["en-US","en","zh-CN"]  hardware_concurrency=8  touch_points=5
```

### ❗ D1 在这台真机上被真实触发

真机上报的 `os_version` 是 **`13.0`**，而本机 `Build.VERSION.RELEASE` 是 **`13`** —— 正是 D1。
用这台设备的真实数值重放（`.smoke/contract_probe.sh` 同款请求）：

| 场景 | web osVersion | 结果 |
|---|---|---|
| 真机实况 | `"13.0"` | **`matched:false`** |
| 对照：osVersion 置空 | `null` | `matched:true` fuzzy 1.0 |

**关键**：真机走的是 `http://localhost`（USB 隧道），浏览器视其为**安全上下文**，UA-CH 可用
—— 与生产 https 落地页行为一致。模拟器走 `10.0.2.2` 属非安全上下文，UA-CH 不可用，
才恰好绕开这个坑。**这解释了为什么模拟器全绿而真机会坏。**

### ⛔ 原生 SDK 侧未能在真机上跑（设备限制，非代码问题）

卡在 MIUI 的安全限制上，**根因单一**：开发者选项里的
**「USB 调试（安全设置）」未开启**，它同时管两件事：

1. **模拟输入被拒** —— `adb shell input tap/swipe` 报
   `SecurityException: Injecting input events requires ... INJECT_EVENTS permission`；
2. **adb 安装被拒** —— `INSTALL_FAILED_USER_RESTRICTED`。MIUI 弹不出授权框时会当作用户拒绝；
   实测每装一个新包都需要在设备上手动点确认，而 Maestro 每次会话结束会卸载自己的驱动包，
   于是每轮都要人工介入一次，无法无人值守。

该开关**必须登录小米账号才能打开**，无可靠绕过方案（社区专门讨论过）。
参考：<https://medium.com/@kierantully/theres-an-extra-security-restriction-on-xiaomi-miui-devices-which-prevents-usb-debugging-assigning-54e5f8719ac7>
、<https://medium.com/@resulcay/how-to-fix-the-install-failed-user-restricted-error-on-miui-hyperos-7675156e40d4>

其余已解决的真机适配（均已固化进 runner）：

- **局域网不通**：手机 `192.168.89.79/23` 与开发机 `192.168.88.233/23` 属同一网段，
  Mac 防火墙已关、node 监听 `*:6066`，但手机 Chrome 报 `ERR_ADDRESS_UNREACHABLE`
  —— 路由器开启了 AP 客户端隔离。**已改用 `adb reverse tcp:6066 tcp:6066` 走 USB 隧道绕开**，
  实测真机 Chrome 能正常加载落地页。runner 在 `--host localhost` 时会自动建立该隧道。
- 真机参数：Android 13、720×1650 @320dpi（dp 360×825）、时区 `Asia/Phnom_Penh`。

另有两项 MIUI 行为已在 runner 里绕开：Maestro 的 `launchApp` 在 MIUI 上返回成功但
App 起不来（改由 adb `am start` 冷启并轮询前台）；`am start -d` 的 URL 必须在**设备侧**
加引号，否则 `&` 被设备 shell 截断、`code`/`auto` 参数丢失，页面静默使用默认邀请码。

开启「USB 调试（安全设置）」后一条命令即可：
`bash .smoke/run_core_smoke.sh --case all --device b88b74e7 --host localhost`

## 自愈记录

四轮修复全部针对**测试自身的技术缺陷**，未放宽任何业务断言：

1. Chrome 首次运行向导挡住落地页 → 过掉向导（设备起始态，不改用例）。
2. 断言挂在落地页动态插入的日志节点上，Chrome 不把它稳定暴露给无障碍树 →
   删掉该中间断言，改为等待；点击是否成功由「App 必须拿回该邀请码」这条业务断言反向保证。
3. `assertVisible` 是整串正则匹配而非子串，带时间戳前缀的控制台日志匹配不上 → 改写为 `.*…*.`。
4. 结果卡片渲染在可滚动区域下方 → 补 `scrollUntilVisible`。
5. 为适配真机，一度让用例往输入框里填后端地址，连踩三个坑：`hideKeyboard` 在 Android 上
   发的是 BACK 键会退出 App；`eraseText` 清不干净；`inputText` 含 `://` 的串会吞字符
   （实测填成 `http://10.0.2.2:6066/api6066/api`）。**最终放弃输入框**，改由安装时
   `--dart-define=SI_API_BASE_URL` 烧入，用例只负责点击 —— 少 4 个易碎步骤。

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
