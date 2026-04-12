/*
 * Copyright 2024 share-installs Authors.
 */

package com.invitesdk.fingerprint

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.os.Environment
import android.os.StatFs
import android.provider.Settings
import android.util.DisplayMetrics
import android.view.WindowManager
import com.invitesdk.BuildConfig
import kotlin.math.roundToInt
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.util.Locale
import java.util.TimeZone

/**
 * Collects device signals for fingerprint-based deferred deep linking.
 *
 * All collected signals are non-PII and do not require user permission:
 * - No GAID (advertising ID)
 * - No precise location
 * - Only hardware/software characteristics and network metadata
 *
 * Required permissions (normal, no user prompt):
 *   android.permission.ACCESS_NETWORK_STATE
 */
internal class FingerprintCollector(private val context: Context) {

    @Serializable
    data class Signals(
        val androidId: String,
        val osVersion: String,
        val apiLevel: Int,
        val screen: ScreenInfo,
        val languages: List<String>,
        val timezone: String,
        val networkType: String,
        val brand: String,
        val model: String,
        @SerialName("buildFingerprint") val buildFingerprint: String,
        val diskBucket: String,
        /** Number of logical CPU cores — matches web navigator.hardwareConcurrency. */
        val hardwareConcurrency: Int,
        /** Max simultaneous touch points — matches web navigator.maxTouchPoints. */
        val touchPoints: Int,
    )

    @Serializable
    data class ScreenInfo(
        /** Logical dp width — matches CSS window.screen.width (widthPixels / density). */
        val w: Int,
        /** Logical dp height — matches CSS window.screen.height (heightPixels / density). */
        val h: Int,
        /** Screen density (dpi/160), e.g. 3.0 for xxhdpi. Equivalent to devicePixelRatio. */
        val density: Float,
    )

    /** Synchronously collects all available device signals. */
    fun collect(): Signals {
        val metrics = getDisplayMetrics()
        return Signals(
            androidId = getAndroidId(),
            osVersion = Build.VERSION.RELEASE ?: "unknown",
            apiLevel = Build.VERSION.SDK_INT,
            screen = ScreenInfo(
                // Convert physical pixels → logical dp to match web CSS px (window.screen.width/height).
                // Use roundToInt() to match Chrome's Math.round() behavior; .toInt() truncates and
                // produces values that are 1px off, causing the exact-match fingerprint hash to miss.
                w = metrics?.let { if (it.density > 0) (it.widthPixels / it.density).roundToInt() else it.widthPixels } ?: 0,
                h = metrics?.let { if (it.density > 0) (it.heightPixels / it.density).roundToInt() else it.heightPixels } ?: 0,
                density = metrics?.density ?: 0f,
            ),
            languages = getLanguages(),
            timezone = try { TimeZone.getDefault().id } catch (_: Exception) { "UTC" },
            networkType = getNetworkType(),
            brand = Build.BRAND ?: "unknown",
            model = Build.MODEL ?: "unknown",
            buildFingerprint = Build.FINGERPRINT ?: "unknown",
            diskBucket = getDiskBucket(),
            hardwareConcurrency = try { Runtime.getRuntime().availableProcessors() } catch (_: Exception) { 1 },
            touchPoints = getTouchPoints(),
        )
    }

    // MARK: - Private helpers

    private fun getAndroidId(): String {
        return Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
            ?: "unknown"
    }

    private fun getLanguages(): List<String> {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            val config = context.resources.configuration
            (0 until config.locales.size()).map { config.locales.get(it).toLanguageTag() }
        } else {
            @Suppress("DEPRECATION")
            listOf(context.resources.configuration.locale.toLanguageTag())
        }
    }

    /** Returns "wifi", "cellular", or "none". Requires ACCESS_NETWORK_STATE. */
    private fun getNetworkType(): String {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            ?: return "none"

        val network = cm.activeNetwork ?: return "none"
        val caps = cm.getNetworkCapabilities(network) ?: return "none"

        return when {
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "cellular"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ethernet"
            else -> "other"
        }
    }

    /** Returns a coarse total storage bucket (e.g. "64GB"). */
    private fun getDiskBucket(): String {
        return try {
            val stat = StatFs(Environment.getDataDirectory().path)
            val totalBytes = stat.blockCountLong * stat.blockSizeLong
            val gb = totalBytes / 1_000_000_000L
            when {
                gb < 33  -> "32GB"
                gb < 65  -> "64GB"
                gb < 129 -> "128GB"
                gb < 257 -> "256GB"
                gb < 513 -> "512GB"
                else     -> "1TB+"
            }
        } catch (_: Exception) {
            "unknown"
        }
    }

    @Suppress("DEPRECATION")
    private fun getDisplayMetrics(): DisplayMetrics? {
        return try {
            val wm = context.getSystemService(Context.WINDOW_SERVICE) as? WindowManager
            val metrics = DisplayMetrics()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                val bounds = wm?.currentWindowMetrics?.bounds
                metrics.widthPixels = bounds?.width() ?: 0
                metrics.heightPixels = bounds?.height() ?: 0
                metrics.density = context.resources.displayMetrics.density
            } else {
                wm?.defaultDisplay?.getMetrics(metrics)
            }
            metrics
        } catch (_: Exception) {
            null
        }
    }

    /** Returns the maximum number of simultaneous touch points supported by the screen. */
    private fun getTouchPoints(): Int {
        val pm = context.packageManager ?: return 0
        return try {
            pm.getSystemAvailableFeatures()
                ?.firstOrNull { it.name == "android.hardware.touchscreen.multitouch.jazzhand" }
                ?.let { 5 }
                ?: if (pm.hasSystemFeature("android.hardware.touchscreen.multitouch")) 2
                else if (pm.hasSystemFeature("android.hardware.touchscreen")) 1
                else 0
        } catch (_: Exception) {
            0
        }
    }
}
