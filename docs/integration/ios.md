# iOS SDK Integration Guide

## Requirements

- iOS 15+
- Swift 5.9+
- Xcode 15+

## Installation

### Swift Package Manager (Recommended)

In Xcode: **File → Add Package Dependencies** → enter:
```
https://github.com/yourorg/share-installs-sdk-ios
```

Or add to `Package.swift`:
```swift
.package(url: "https://github.com/yourorg/share-installs-sdk-ios", from: "1.0.0")
```

## Setup

### 1. Configure Universal Links (Required for Deferred Deep Linking)

In your app's target → **Signing & Capabilities** → **+ Associated Domains**:
```
applinks:yourdomain.com
```

Ensure your backend serves `/.well-known/apple-app-site-association`:
```json
{
  "applinks": {
    "details": [{"appID": "TEAMID.com.yourapp", "paths": ["/invite/*"]}]
  }
}
```

### 2. Initialize the SDK

In `AppDelegate.swift` or your `@main` App struct:

```swift
import InviteSDK

@main
struct MyApp: App {
    init() {
        ShareInstallsSDK.configure(with: ShareInstallsConfiguration(
            apiBaseURL: URL(string: "https://api.yourdomain.com")!,
            debugLoggingEnabled: false // set true only in DEBUG builds
        ))
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .onOpenURL { url in
                    // Handle both Universal Links and custom schemes
                    if let code = ShareInstallsSDK.shared.handleUniversalLink(url)
                                ?? ShareInstallsSDK.shared.handleDeepLink(url) {
                        // App was already installed – apply code immediately
                        applyInviteCode(code)
                    }
                }
        }
    }
}
```

### 3. Resolve Deferred Invite (on first launch / after registration)

```swift
func onUserRegistered() {
    Task {
        do {
            if let invite = try await ShareInstallsSDK.shared.resolveDeferred() {
                print("Invite code: \(invite.code)")
                print("Inviter data: \(invite.customData ?? [:])")
                print("Confidence: \(invite.confidence)")
                applyInviteCode(invite.code)
            }
        } catch ShareInstallsResolveError.alreadyResolved {
            // Already handled – skip silently
        } catch {
            print("Resolve error: \(error)")
        }
    }
}
```

### 4. Handle Account Reset

```swift
func onUserLoggedOut() {
    ShareInstallsSDK.shared.clearCachedResolution()
}
```

## Best Practices

- Call `resolveDeferred()` **once** per install, after onboarding (when you have the user's intent).
- **Do not** call it on every app launch — the SDK prevents duplicates via `UserDefaults`, but network requests are still made.
- Set `debugLoggingEnabled: true` only in `#if DEBUG` blocks.
- The SDK uses `os.log` for structured logging visible in Console.app.
