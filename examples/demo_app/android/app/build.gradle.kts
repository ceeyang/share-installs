plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "com.shareinstalls.demo_app"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.shareinstalls.demo_app"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    buildTypes {
        release {
            // TODO: Add your own signing config for the release build.
            // Signing with the debug keys for now, so `flutter run --release` works.
            signingConfig = signingConfigs.getByName("debug")
        }
    }
}

flutter {
    source = "../.."
}

dependencies {
    // share-installs Android SDK — the real published coordinates, so this file
    // doubles as the integration snippet users copy. Built from source locally
    // via the substitution rule in the root build.gradle.kts; pass
    // -PusePublishedSdk (and -PsdkVersion=x.y.z) to resolve the artifact instead.
    implementation("io.github.share-installs:sdk-android:${rootProject.findProperty("sdkVersion") ?: "0.0.4"}")
    // Kotlin serialization (required for parsing JsonElement from customData)
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.2")
}
