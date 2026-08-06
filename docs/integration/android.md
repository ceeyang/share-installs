# Android SDK Integration Guide

> 📘 完整文档见 [docs/docs/sdk/android.md](../docs/sdk/android.md)。本页为快速集成摘要。

## Requirements

- Android 5.0+ (minSdk 21)
- Kotlin 1.9+
- AGP 8.2+

## Installation

```kotlin
// app/build.gradle.kts
dependencies {
    implementation("io.github.share-installs:sdk-android:0.0.4")
}
```

Published to Maven Central (and GitHub Packages as a mirror).

## Setup

### 1. Initialize in Application

```kotlin
class MyApplication : Application() {
    override fun onCreate() {
        super.onCreate()

        // SaaS (hosted service): pass your API key
        ShareInstallsSDK.configure(
            context = this,
            configuration = ShareInstallsConfiguration(
                apiKey = "sk_live_xxx",
                debugLoggingEnabled = BuildConfig.DEBUG
            )
        )

        // Self-hosted: pass your backend URL instead (note the /api suffix)
        // ShareInstallsSDK.configure(
        //     context = this,
        //     configuration = ShareInstallsConfiguration(
        //         apiBaseUrl = "https://your-server.com/api"
        //     )
        // )
    }
}
```

`apiKey` 和 `apiBaseUrl` 至少填写一项，否则初始化抛出 `IllegalArgumentException`。

### 2. Resolve Deferred Invite (once, after registration/onboarding)

```kotlin
// In a ViewModel, after user registration:
viewModelScope.launch {
    try {
        val invite = ShareInstallsSDK.instance.resolveDeferred()
        if (invite != null) {
            Log.d("Invite", "code=${invite.code} confidence=${invite.confidence} channel=${invite.channel}")
            applyInviteCode(invite.code)
        } else {
            // No match — user did not arrive via an invite link
        }
    } catch (e: ShareInstallsResolveException) {
        // SdkNotConfigured — configure() was not called
        Log.e("Invite", "Resolution failed", e)
    } catch (e: Exception) {
        Log.e("Invite", "Network error", e)
    }
}
```

Notes:

- **Must be called from the foreground** — clipboard access on Android 10+
  requires the app to be visible. The SDK checks the clipboard first
  (`SHAREINSTALLS:<code>`, confidence 1.0), then falls back to fingerprint
  matching.
- `resolveDeferred()` returns `null` when no match is found.
- The SDK does not persist the result — deduplicate calls in your own logic
  (e.g. store a flag after the first successful resolution).

### 3. Direct deep links (app already installed)

The SDK only handles **deferred** resolution. When the app is already
installed, handle App Links yourself (intent filters + `assetlinks.json`) and
parse the invite code from your landing-page URL — no SDK call needed.

## ProGuard / R8

The SDK ships with its own consumer rules; no extra configuration is required.
If you shrink aggressively, keep the SDK's models:

```
-keep class com.invitesdk.** { *; }
```
