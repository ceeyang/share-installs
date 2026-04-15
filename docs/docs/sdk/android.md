# Android SDK

Kotlin 接入指南。在 App 首次启动时调用 resolve，获取邀请码和自定义数据。

---

## 安装

### Gradle（Maven Central）

在 `build.gradle.kts`（模块级）中添加：

```kotlin
dependencies {
  implementation("com.share-installs:sdk-android:1.0.0")
}
```

---

## 配置

`apiKey` 和 `apiBaseUrl` 至少填写一项，否则初始化时抛出 `IllegalArgumentException`。

在 `Application` 子类的 `onCreate()` 中初始化 SDK：

```kotlin
import com.shareinstalls.sdk.ShareInstallsSDK
import com.shareinstalls.sdk.ShareInstallsConfiguration

class MyApplication : Application() {
  override fun onCreate() {
    super.onCreate()

    // 托管服务：只需填写 apiKey
    ShareInstallsSDK.configure(
      context = applicationContext,
      configuration = ShareInstallsConfiguration(
        apiKey = "sk_live_xxxxxxxx"
      )
    )

    // 自建部署：只需填写 apiBaseUrl，无需 apiKey
    // ShareInstallsSDK.configure(
    //   context = applicationContext,
    //   configuration = ShareInstallsConfiguration(
    //     apiBaseUrl = "https://your-server.com/api"
    //   )
    // )
  }
}
```

在 `AndroidManifest.xml` 中声明：

```xml
<application android:name=".MyApplication" ...>
```

### 配置项

| 参数 | 类型 | 说明 |
|------|------|------|
| `apiKey` | `String?` | 托管服务的 API Key。自建模式传 `null` |
| `apiBaseUrl` | `String?` | 自建后端地址。省略时默认 `https://console.share-installs.com/api` |
| `resolveTimeoutMs` | `Long` | 请求超时毫秒数，默认 `5000` |
| `debugLoggingEnabled` | `Boolean` | 开启详细日志，默认 `false` |

> `apiKey` 和 `apiBaseUrl` 两者都不填时，`ShareInstallsConfiguration` 初始化会抛出 `IllegalArgumentException`（属于编程错误，应在开发期发现）。

---

## 归因解析

在**用户注册/登录完成后**调用 `resolveDeferred`：

```kotlin
import com.shareinstalls.sdk.ShareInstallsSDK

// 在 Activity 或 ViewModel 中调用
lifecycleScope.launch {
  val result = ShareInstallsSDK.shared.resolveDeferred()
  if (result != null) {
    // 匹配成功
    val inviteCode = result.inviteCode    // 你系统的邀请码
    val customData = result.customData    // 落地页传入的自定义数据（Map<String, Any>?）
    val confidence = result.meta.confidence  // 置信度 0.0–1.0
    val channel = result.meta.channel        // "exact" | "fuzzy" | "clipboard"

    applyInviteCode(inviteCode, customData)
  }
}
```

### 返回值结构

```kotlin
data class ResolveResult(
  val inviteCode: String,
  val customData: Map<String, Any>?,
  val meta: ResolveMeta,
)

data class ResolveMeta(
  val confidence: Double,   // 0.0–1.0
  val channel: String,      // "exact" | "fuzzy" | "clipboard"
)
```

### 归因通道说明

| channel | 含义 |
|---------|------|
| `exact` | Redis 精确匹配，置信度接近 1.0 |
| `fuzzy` | PostgreSQL 模糊匹配，置信度 0.75–0.99 |
| `clipboard` | 剪贴板兜底，Android 专属 |

---

## Android 剪贴板机制

当用户点击邀请落地页时，Web SDK 会将邀请码写入剪贴板（格式：`SHAREINSTALLS:<code>`）。

Android SDK 在调用 `resolveDeferred` 时会先读取剪贴板尝试精确匹配，若成功则直接返回，跳过网络指纹匹配，速度更快、准确率更高。

**权限要求：**
- Android 12（API 31）以下：无需权限，直接读取
- Android 12 及以上：应用需在前台时读取（首次启动时满足此条件）

无需在 `AndroidManifest.xml` 中声明额外权限。

---

## 采集的信号

Android SDK 采集以下设备信号：

| 信号 | 说明 |
|------|------|
| Android ID | 设备唯一标识（重置出厂后变化） |
| API Level | Android 系统版本 |
| 品牌 + 型号 | 例如 `Samsung Galaxy S24` |
| Build Fingerprint | 系统构建指纹（精确标识固件版本） |
| 屏幕尺寸 | 宽、高、像素密度 |
| 语言 | 系统语言列表 |
| 时区 | 设备时区 |
| 网络类型 | wifi / cellular / none |
| IP 地址 | 服务端提取，与落地页 IP 比对 |

---

## 权限声明

SDK 使用以下权限，均为正常权限（无需运行时请求）：

```xml
<!-- 已在 SDK AAR 的 AndroidManifest 中自动合并 -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

---

## 最佳实践

**调用时机：** 与 iOS 一样，在用户注册完成后立即调用，而不是 App 启动时。

**异常处理：** `resolveDeferred` 是挂起函数（suspend），网络错误时会抛出异常，使用 `try-catch` 静默处理：

```kotlin
lifecycleScope.launch {
  try {
    val result = ShareInstallsSDK.shared.resolveDeferred()
    result?.let { applyInviteCode(it.inviteCode) }
  } catch (e: Exception) {
    // 静默处理，不阻塞注册流程
  }
}
```

**只调用一次：** SDK 内部记录归因状态，重复调用返回 `null`（不重复请求网络）。

---

## 隐私合规

- 不使用 GAID（Google Advertising ID）
- 不读取联系人、位置等敏感数据
- Android ID 是系统提供的设备标识，无需额外权限
- 符合 Google Play 政策要求
