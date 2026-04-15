# Web / JavaScript SDK

落地页接入指南。当用户通过邀请链接访问落地页时，SDK 在后台采集浏览器指纹并上报，用于后续 App 安装的归因匹配。

---

## 安装

### CDN（推荐，零构建）

```html
<script src="https://cdn.jsdelivr.net/npm/@share-installs/js-sdk/dist/share-installs-sdk.min.js"></script>
```

### npm / 打包工具

```bash
npm install @share-installs/js-sdk
```

```ts
import { ShareInstallsSDK } from '@share-installs/js-sdk';
```

---

## 初始化

`apiKey` 和 `apiBaseUrl` 至少填写一项，否则构造时抛出错误。

```ts
// 托管服务：只需填写 apiKey，apiBaseUrl 自动使用默认值
const sdk = new ShareInstallsSDK({
  apiKey: 'sk_live_xxxxxxxx',
});

// 自建部署：只需填写 apiBaseUrl，无需 apiKey
const sdk = new ShareInstallsSDK({
  apiBaseUrl: 'https://your-server.com/api',
});

// 其他可选参数
const sdk = new ShareInstallsSDK({
  apiKey: 'sk_live_xxxxxxxx',
  timeoutMs: 5000,   // 请求超时（毫秒），默认 5000
  debug: false,      // true 输出详细日志，生产环境关闭
});
```

### 配置项

| 参数 | 类型 | 说明 |
|------|------|------|
| `apiKey` | `string?` | 托管服务的 API Key（`sk_live_` 开头）。自建模式省略 |
| `apiBaseUrl` | `string?` | 自建后端地址。省略时默认 `https://console.share-installs.com/api` |
| `timeoutMs` | `number?` | 请求超时毫秒数，默认 `5000` |
| `debug` | `boolean?` | 开启 console 详细日志，默认 `false` |

> `apiKey` 和 `apiBaseUrl` 两者都不填时，SDK 构造器会抛出错误。

---

## 上报点击事件

在落地页加载时调用一次 `trackClick`：

```ts
// 从 URL 参数获取邀请码
const inviteCode = new URL(location.href).searchParams.get('code');

if (inviteCode) {
  try {
    const result = await sdk.trackClick(inviteCode, {
      // customData 是任意 JSON 对象，匹配成功后原样返回给 App
      // 可用于传递活动信息、渠道标识、奖励信息等
      campaign: 'summer2025',
      channel: 'wechat',
    });
    console.log('已上报，eventId:', result.eventId);
  } catch (e) {
    // 上报失败不影响用户体验，静默处理即可
  }
}
```

### 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `inviteCode` | `string` | 你系统中的邀请码，原样存储，原样返回 |
| `customData` | `object?` | 任意 JSON，序列化后不超过 10 KB |

### 返回值

```ts
{ eventId: string }  // 本次点击事件的唯一 ID
```

---

## 平台检测

SDK 暴露了平台检测工具方法，可用于条件性展示不同的下载按钮：

```ts
sdk.isIOS()     // true = iPhone / iPad 浏览器
sdk.isAndroid() // true = Android 浏览器
sdk.isMobile()  // true = iOS 或 Android

if (sdk.isIOS()) {
  window.location.href = 'https://apps.apple.com/app/...';
} else if (sdk.isAndroid()) {
  window.location.href = 'https://play.google.com/store/apps/details?id=...';
}
```

---

## 采集的信号

SDK 采集以下浏览器信号，全部为非 PII（非个人身份信息）硬件/软件特征：

| 信号 | 说明 |
|------|------|
| Canvas 哈希 | 渲染差异的 SHA-256 |
| WebGL 哈希 | GPU 渲染特征 |
| Audio 哈希 | AudioContext 处理差异 |
| 屏幕分辨率 | 宽、高、像素比、色深 |
| 硬件参数 | CPU 核数、内存（GB，已脱敏） |
| 语言 | `navigator.languages` |
| 时区 | `Intl.DateTimeFormat().resolvedOptions().timeZone` |
| 触控点数 | `navigator.maxTouchPoints` |
| User-Agent | 浏览器版本、操作系统 |
| 网络类型 | wifi / cellular / 4g 等 |
| Referrer | 来源页面 |

不使用 Cookie，不使用持久化标识符。

---

## Android 剪贴板兜底

在 Android Chrome 中，SDK 会在指纹采集后将邀请码写入剪贴板（格式：`SHAREINSTALLS:<code>`），作为指纹匹配失败时的兜底手段。

此操作**无需用户授权**（Android 系统在页面获焦状态下允许后台写入剪贴板），用户不会看到任何提示。

iOS 不支持此机制（系统限制），iOS 归因完全依赖指纹匹配。

---

## 完整示例

```html
<!DOCTYPE html>
<html>
<head>
  <title>邀请落地页</title>
</head>
<body>
  <h1>你的好友邀请你加入</h1>
  <button id="download">立即下载</button>

  <script src="https://cdn.jsdelivr.net/npm/@share-installs/js-sdk/dist/share-installs-sdk.min.js"></script>
  <script>
    const sdk = new ShareInstallsSDK({
      apiKey: 'sk_live_xxxxxxxx',  // 托管服务；自建改为 apiBaseUrl: 'https://your-server.com/api'
    });

    const inviteCode = new URL(location.href).searchParams.get('code');

    // 页面加载后立即上报（不等用户点击）
    if (inviteCode) {
      sdk.trackClick(inviteCode, { source: 'landing' }).catch(() => {});
    }

    document.getElementById('download').addEventListener('click', () => {
      if (sdk.isIOS()) {
        location.href = 'https://apps.apple.com/app/your-app/id000000000';
      } else if (sdk.isAndroid()) {
        location.href = 'https://play.google.com/store/apps/details?id=com.yourapp';
      } else {
        location.href = 'https://your-website.com';
      }
    });
  </script>
</body>
</html>
```
