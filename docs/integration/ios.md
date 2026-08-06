# iOS SDK Integration Guide

> 📘 完整文档见 [docs/docs/sdk/ios.md](../docs/sdk/ios.md)。本页为快速集成摘要。

## Requirements

- iOS 15+
- Swift 5.9+
- Xcode 15+

## Installation

### Swift Package Manager (Recommended)

In Xcode: **File → Add Package Dependencies** → enter:
```
https://github.com/ceeyang/share-installs
```

Or add to `Package.swift`:
```swift
.package(url: "https://github.com/ceeyang/share-installs", from: "1.0.0")
```

CocoaPods is also supported: `pod 'ShareInstallsSDK'`.

## Setup

### 1. Initialize the SDK

```swift
import InviteSDK

@main
struct MyApp: App {
    init() {
        // SaaS (hosted service): pass your API key
        ShareInstallsSDK.configure(with: ShareInstallsConfiguration(
            apiKey: "sk_live_xxx"
        ))

        // Self-hosted: pass your backend URL instead (note the /api suffix)
        // ShareInstallsSDK.configure(with: ShareInstallsConfiguration(
        //     apiBaseURL: URL(string: "https://your-server.com/api")!
        // ))
    }

    var body: some Scene {
        WindowGroup { ContentView() }
    }
}
```

`ShareInstallsConfiguration` options:

| Parameter | Type | Description |
|-----------|------|-------------|
| `apiKey` | `String?` | Hosted-service API key. Omit when self-hosting. |
| `apiBaseURL` | `URL?` | Self-hosted backend URL (must include `/api`). Defaults to the hosted service. |
| `resolveTimeoutSeconds` | `Double` | Resolve request timeout, default `5.0`. |
| `debugLoggingEnabled` | `Bool` | Verbose `os.log` logging, default `false`. |

At least one of `apiKey` / `apiBaseURL` must be provided.

### 2. Resolve Deferred Invite (once, after registration/onboarding)

```swift
func onUserRegistered() {
    Task {
        do {
            if let invite = try await ShareInstallsSDK.shared.resolveDeferred() {
                print("Invite code: \(invite.code)")
                print("Custom data: \(invite.customData ?? [:])")
                print("Confidence: \(invite.confidence), channel: \(invite.channel)")
                applyInviteCode(invite.code)
            } else {
                // No match — user did not arrive via an invite link
            }
        } catch {
            // ShareInstallsResolveError.sdkNotConfigured / .networkError
            print("Resolve error: \(error)")
        }
    }
}
```

`resolveDeferred()` returns `nil` when the backend finds no match. The SDK does
not persist the result — deduplicate calls in your own logic (e.g. store a flag
after the first successful resolution).

### 3. Direct deep links (app already installed)

The SDK only handles **deferred** resolution. When the app is already
installed, handle Universal Links yourself (`onOpenURL` / associated domains)
and parse the invite code from your landing-page URL — no SDK call needed.

## Best Practices

- Call `resolveDeferred()` **once per install**, right after onboarding.
- Keep `debugLoggingEnabled: true` inside `#if DEBUG` blocks only.
- The device fingerprint window is 72 h by default (`FINGERPRINT_MATCH_TTL_HOURS`
  on the backend) — resolving later than that will return no match.
