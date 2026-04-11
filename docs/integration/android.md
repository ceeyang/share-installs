# Android SDK Integration Guide

## Requirements

- Android 5.0+ (minSdk 21)
- Kotlin 1.9+
- AGP 8.2+

## Installation

### Gradle (GitHub Packages)

Add to `settings.gradle.kts`:
```kotlin
dependencyResolutionManagement {
    repositories {
        maven {
            url = uri("https://maven.pkg.github.com/yourorg/share-installs")
            credentials {
                username = providers.gradleProperty("gpr.user").orNull
                    ?: System.getenv("GITHUB_ACTOR")
                password = providers.gradleProperty("gpr.token").orNull
                    ?: System.getenv("GITHUB_TOKEN")
            }
        }
    }
}
```

Add to your app's `build.gradle.kts`:
```kotlin
dependencies {
    implementation("com.share-installs:share-installs-sdk-android:1.0.0")
}
```

## Setup

### 1. Configure Android App Links

In `AndroidManifest.xml`, add to your launcher Activity:
```xml
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW"/>
    <category android:name="android.intent.category.DEFAULT"/>
    <category android:name="android.intent.category.BROWSABLE"/>
    <data
        android:scheme="https"
        android:host="yourdomain.com"
        android:pathPrefix="/invite/"/>
</intent-filter>
```

Ensure your backend serves `/.well-known/assetlinks.json`:
```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.yourapp",
    "sha256_cert_fingerprints": ["YOUR:CERT:FINGERPRINT"]
  }
}]
```

### 2. Initialize in Application

```kotlin
class MyApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        ShareInstallsSDK.configure(
            context = applicationContext,
            configuration = ShareInstallsConfiguration(
                apiBaseUrl = "https://api.yourdomain.com",
                debugLoggingEnabled = BuildConfig.DEBUG
            )
        )
    }
}
```

### 3. Handle Deep Links in Activity

```kotlin
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Handle direct deep link (app already installed)
        intent?.let { handleIncomingIntent(it) }
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        intent?.let { handleIncomingIntent(it) }
    }

    private fun handleIncomingIntent(intent: Intent) {
        val code = ShareInstallsSDK.instance.handleIntent(intent)
        if (code != null) {
            viewModel.applyInviteCode(code)
        }
    }
}
```

### 4. Resolve Deferred Invite

```kotlin
// In ViewModel or after user registration:
viewModelScope.launch {
    try {
        val invite = ShareInstallsSDK.instance.resolveDeferred()
        if (invite != null) {
            Log.d("Invite", "Code: ${invite.code}, confidence: ${invite.confidence}")
            applyInviteCode(invite.code)
        }
    } catch (e: ShareInstallsResolveException.AlreadyResolved) {
        // Skip — already resolved in a previous session
    } catch (e: Exception) {
        Log.e("Invite", "Resolution failed", e)
    }
}
```

### 5. Handle Account Reset

```kotlin
fun onUserLoggedOut() {
    ShareInstallsSDK.instance.clearCachedResolution()
}
```

## ProGuard / R8

Add to `proguard-rules.pro`:
```
-keep class com.invitesdk.** { *; }
-keepattributes *Annotation*
```
