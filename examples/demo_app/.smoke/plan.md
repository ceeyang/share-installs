# 冒烟用例计划 — share-installs 核心链路

范围：**延迟深链归因主链路**，即「同一台设备上，浏览器点了邀请链接 → 装 App 首次启动
→ 原生 SDK 必须拿回同一个邀请码」。不覆盖 dashboard UI、计费、API key 管理。

业务事实来源：`examples/README.md`「Testing the Full Flow」、
`backend/src/services/fingerprintService.ts` 的三通道解析顺序（clipboard / exact / fuzzy）。

## C1 — 同设备点击后可解析（happy path）

- **目的**：验证 web 指纹上报与原生 SDK 指纹在同一设备上能被后端匹配上。
- **前置数据**：后端 + Redis + Postgres 运行中；邀请码由 `CODE` 环境变量注入，每轮唯一。
- **步骤**：设备浏览器打开落地页（自动上报 click）→ 冷启动 demo app → Configure → Resolve。
- **断言**（业务不变量）：
  - 到达：结果卡片可见
  - 有内容：结果 JSON 中出现本轮的邀请码
  - 无错：不出现 `matched": false` / `error`
- **失败意味着**：延迟深链归因整体不可用，产品核心价值失效 —— 阻塞发版。
- **资源**：writes=[click_events, conversions] reads=[]
- **platforms**: [android, ios]

## C2 — 无点击时不得凭空匹配（负向）

- **目的**：防止「任何设备来问都给个邀请码」这类假阳性归因。
- **前置数据**：清空该设备近期未解析的 click（换用从未点击过的设备参数）。
- **断言**：结果为 `matched: false`，且不出现任何邀请码。
- **失败意味着**：归因会把自然安装误记为邀请安装，奖励发放会被刷。
- **资源**：writes=[conversions] reads=[click_events]
- **platforms**: [android, ios]

## 覆盖缺口

- iOS 真机未跑（本机未接真机；模拟器受 osVersion 差异影响，见报告）。
- clipboard 通道（Android 专有第三通道）未纳入，需要落地页写剪贴板配合。
- HTTPS 落地页场景未纳入 —— 这正是 UA-CH 生效、触发 osVersion 硬否决的场景，见报告缺陷 D1。
