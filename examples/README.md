# Share Installs — SDK Demo Examples

Interactive demos for testing the share-installs SDK integration.

> **share-installs 只做两件事：** 收集浏览器指纹 + 匹配移动端设备指纹。邀请码由你的系统管理。

## Prerequisites

**Backend** (required for all demos):
```bash
# From the project root:

# 1. Start infrastructure
docker compose up db redis -d

# 2. Start backend
cd backend
npx prisma migrate dev
npm run dev
# Backend runs at http://localhost:6066
```

---

## 🌐 Web Demos

No build step needed. Open in any browser.

### Fingerprint Demo (`web/fingerprint-demo.html`)

Full deferred deep link flow demo:
- **Step 1**: Collect browser fingerprint (Canvas, WebGL, Screen, etc.)
- **Step 2**: Track click → `POST /v1/clicks` (store invite code + fingerprint)
- **Step 3**: Simulate resolve → `POST /v1/resolutions` (match and return invite code)

```
http://localhost:6066/examples/web/fingerprint-demo.html
```

### API Playground (`web/api-playground.html`)

Postman-like API explorer with all available endpoints:

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Server status |
| `POST /v1/clicks` | Record click + fingerprint |
| `POST /v1/resolutions` | Resolve invite from device signals |
| `POST /v1/projects` | Create project (SaaS only) |

```
http://localhost:6066/examples/web/api-playground.html
```

---

## 📱 Flutter Demo App (iOS + Android)

A Flutter host app that integrates the **native** iOS (Swift) and Android (Kotlin) SDKs via MethodChannel.

### Quick Start

```bash
cd examples/demo_app

# iOS (simulator)
flutter run -d ios

# Android (emulator)
flutter run -d android
```

### Features

| Feature | Description |
|---------|-------------|
| **Configure SDK** | Enter API base URL → initializes native SDK |
| **Resolve Deferred** | Calls native `resolveDeferred()` → returns invite code |
| **Clear Cache** | Resets locally cached resolution |
| **Console** | Real-time SDK log output |

### Architecture

```
Flutter UI (Dart)
    ↕ MethodChannel("com.shareinstalls/sdk")
┌──────────────────────────────────┐
│ iOS: AppDelegate.swift           │  ← ShareInstalls pod (local: sdk/ios)
│ Android: MainActivity.kt        │  ← InviteSDK (composite: sdk/android)
└──────────────────────────────────┘
    ↕ Native SDK → POST /v1/resolutions → Backend (localhost:6066)
```

---

## Testing the Full Flow

1. Start backend: `docker compose up db redis -d && cd backend && npm run dev`
2. Open `http://localhost:6066/examples/web/fingerprint-demo.html`
3. Enter an invite code (e.g. `ABC12345`) → Collect Fingerprint → Send Track Click
4. Run the Flutter demo on simulator → Tap **Resolve**
5. Should display the matched invite code with confidence score

---

## Project Structure

```
examples/
├── demo_app/                    # Flutter demo (iOS + Android)
│   ├── lib/main.dart            # Flutter UI
│   ├── ios/Runner/
│   │   └── AppDelegate.swift    # iOS MethodChannel → ShareInstalls SDK
│   └── android/app/
│       └── .../MainActivity.kt  # Android MethodChannel → InviteSDK
└── web/
    ├── fingerprint-demo.html    # Fingerprint + click tracking demo
    └── api-playground.html      # API endpoint explorer
```
