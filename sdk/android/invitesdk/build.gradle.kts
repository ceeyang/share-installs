plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android") version "1.9.22"
    id("org.jetbrains.kotlin.plugin.serialization") version "1.9.22"
    id("com.vanniktech.maven.publish") version "0.28.0"
}

android {
    namespace = "com.invitesdk"
    compileSdk = 34

    defaultConfig {
        minSdk = 21
        targetSdk = 34
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        consumerProguardFiles("consumer-rules.pro")

        buildConfigField("String", "SDK_VERSION", "\"${System.getenv("SDK_VERSION") ?: "1.0.0"}\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
        freeCompilerArgs += listOf("-opt-in=kotlin.RequiresOptIn")
    }

    buildFeatures {
        buildConfig = true
    }

    publishing {
        singleVariant("release") {
            withSourcesJar()
            withJavadocJar()
        }
    }
}

dependencies {
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.2")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.lifecycle:lifecycle-process:2.7.0")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.7.3")
    testImplementation("io.mockk:mockk:1.13.8")
    testImplementation("org.robolectric:robolectric:4.11.1")
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")
}

// Maven Central publishing via vanniktech plugin
// Reads coordinates from gradle.properties or environment variables
mavenPublishing {
    coordinates(
        groupId = "io.github.share-installs",
        artifactId = "sdk-android",
        version = System.getenv("SDK_VERSION") ?: "1.0.0"
    )

    pom {
        name.set("share-installs Android SDK")
        description.set("Android SDK for share-installs – deferred deep link invite attribution")
        url.set("https://github.com/share-installs/share-installs")
        inceptionYear.set("2026")

        licenses {
            license {
                name.set("Apache License 2.0")
                url.set("https://www.apache.org/licenses/LICENSE-2.0")
            }
        }

        developers {
            developer {
                id.set("share-installs")
                name.set("share-installs")
                url.set("https://github.com/share-installs")
            }
        }

        scm {
            url.set("https://github.com/share-installs/share-installs")
            connection.set("scm:git:github.com/share-installs/share-installs.git")
            developerConnection.set("scm:git:ssh://github.com/share-installs/share-installs.git")
        }
    }

    publishToMavenCentral(com.vanniktech.maven.publish.SonatypeHost.CENTRAL_PORTAL)
    signAllPublications()
}

// GitHub Packages — secondary mirror (used by sdk-android.yml)
publishing {
    repositories {
        maven {
            name = "GitHubPackages"
            url = uri("https://maven.pkg.github.com/share-installs/share-installs")
            credentials {
                username = System.getenv("GITHUB_ACTOR")
                password = System.getenv("GITHUB_TOKEN")
            }
        }
    }
}
