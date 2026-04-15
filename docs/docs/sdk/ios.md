# iOS SDK

Swift 接入指南。在 App 首次启动时调用 resolve，获取邀请码和自定义数据。

---

## 安装

### Swift Package Manager（推荐）

在 Xcode 中：**File → Add Package Dependencies**，输入：

```
https://github.com/ceeyang/share-installs
```

或在 `Package.swift` 中添加：

```swift
dependencies: [
  .package(url: "https://github.com/ceeyang/share-installs", from: "1.0.0")
]
```

### CocoaPods

```ruby
# Podfile
pod 'ShareInstalls'
```

```bash
pod install
```

---

## 配置

`apiKey` 和 `apiBaseURL` 至少填写一项，否则运行时触发 `preconditionFailure`。

在 `AppDelegate.swift` 或 `@main App` 结构体中初始化 SDK：

```swift
import ShareInstallsSDK

@main
struct MyApp: App {
  init() {
    // 托管服务：只需填写 apiKey
    ShareInstallsSDK.configure(with: ShareInstallsConfiguration(
      apiKey: "sk_live_xxxxxxxx"
    ))

    // 自建部署：只需填写 apiBaseURL，无需 apiKey
    // ShareInstallsSDK.configure(with: ShareInstallsConfiguration(
    //   apiBaseURL: URL(string: "https://your-server.com/api")!
    // ))
  }

  var body: some Scene {
    WindowGroup { ContentView() }
  }
}
```

### 配置项

| 参数 | 类型 | 说明 |
|------|------|------|
| `apiKey` | `String?` | 托管服务的 API Key。自建模式传 `nil` |
| `apiBaseURL` | `URL?` | 自建后端地址。省略时默认 `https://console.share-installs.com/api` |
| `resolveTimeoutSeconds` | `Double` | 请求超时（秒），默认 `5.0` |
| `debugLoggingEnabled` | `Bool` | 开启详细日志，默认 `false` |

> `apiKey` 和 `apiBaseURL` 两者都不填时，SDK 启动时会触发 `preconditionFailure` 并 crash（属于编程错误，应在开发期发现）。

---

## 归因解析

在**用户注册/登录完成后**调用 `resolveDeferred`，时机越早越好（首次启动的前几秒内）：

```swift
import ShareInstallsSDK

func onUserRegistered() async {
  do {
    if let result = try await ShareInstallsSDK.shared.resolveDeferred() {
      // 匹配成功
      let inviteCode = result.inviteCode    // 你系统的邀请码
      let customData = result.customData    // 落地页传入的自定义数据
      let confidence = result.meta.confidence  // 置信度，0.0–1.0

      // 处理邀请码
      applyInviteCode(inviteCode, from: customData)
    } else {
      // 未匹配（用户不是通过邀请链接进来的，或超过 TTL）
    }
  } catch {
    // 网络错误等，静默处理即可，不影响主流程
  }
}
```

### 返回值结构

```swift
struct ResolveResult {
  let inviteCode: String         // 邀请码
  let customData: [String: Any]? // 落地页传入的自定义数据
  let meta: ResolveMeta
}

struct ResolveMeta {
  let confidence: Double  // 置信度 0.0–1.0
  let channel: String     // "exact" | "fuzzy" | "clipboard"
}
```

### 归因通道说明

| channel | 含义 |
|---------|------|
| `exact` | Redis 精确匹配，置信度接近 1.0 |
| `fuzzy` | PostgreSQL 模糊匹配，置信度 0.75–0.99 |
| `clipboard` | 剪贴板兜底（iOS 不使用此通道） |

---

## 采集的信号

iOS SDK 采集以下设备信号用于指纹匹配：

| 信号 | 说明 |
|------|------|
| OS 版本 | iOS 系统版本号 |
| 屏幕尺寸 | 宽、高、缩放比 |
| 语言 | 系统语言列表 |
| 时区 | 设备时区 |
| 网络类型 | wifi / cellular / none |
| 磁盘分级 | 64GB / 128GB / 256GB 等（脱敏） |
| Keychain UUID | 跨 App 重装保持唯一（用户卸载重装后仍有效） |
| IP 地址 | 服务端提取，与落地页 IP 比对 |

所有信号均为设备硬件/软件特征，不包含个人身份信息。

---

## 最佳实践

**调用时机：** 在用户完成注册后立即调用，而非 App 启动时。这样可以确保邀请码绑定到真实用户，而非匿名安装。

**只调用一次：** SDK 内部会记录是否已完成归因，重复调用会直接返回 `nil`（不会重复请求网络）。

**错误处理：** 网络超时或服务不可用时 `resolveDeferred` 会抛出异常，使用 `try?` 或 `catch` 静默处理，不要阻塞注册流程。

```swift
// 推荐写法：不阻塞主流程
Task {
  if let result = try? await ShareInstallsSDK.shared.resolveDeferred() {
    applyInviteCode(result.inviteCode)
  }
}
```

---

## 隐私合规

- 不使用 IDFA / IDFV
- 不访问通讯录、相机、位置等敏感权限
- 不在设备上持久化存储指纹数据
- 无需在 `Info.plist` 中添加任何隐私描述
- 符合 App Store 审核要求
