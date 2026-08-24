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
        /** Logical dp width — matches CSS window.screen.width (full display px / density). */
        val w: Int,
        /** Logical dp height — matches CSS window.screen.height (full display px / density). */
        val h: Int,
        /** Screen density (dpi/160), e.g. 3.0 for xxhdpi. Equivalent to devicePixelRatio. */
        val density: Float,
    )

    /** Synchronously collects all available device signals. */
    fun collect(): Signals {
        val display = getDisplaySize()
        return Signals(
            androidId = getAndroidId(),
            osVersion = Build.VERSION.RELEASE ?: "unknown",
            apiLevel = Build.VERSION.SDK_INT,
            screen = ScreenInfo(
                // Convert physical pixels → logical dp to match web CSS px (window.screen.width/height).
                // Use roundToInt() to match Chrome's Math.round() behavior; .toInt() truncates and
                // produces values that are 1px off, causing the exact-match fingerprint hash to miss.
                w = display?.let { if (it.density > 0) (it.widthPx / it.density).roundToInt() else it.widthPx } ?: 0,
                h = display?.let { if (it.density > 0) (it.heightPx / it.density).roundToInt() else it.heightPx } ?: 0,
                density = display?.density ?: 0f,
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

    /** Returns "wifi", "cellular", "ethernet", "other", or "none". Requires ACCESS_NETWORK_STATE. */
    private fun getNetworkType(): String {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            ?: return "none"

        // activeNetwork + getNetworkCapabilities require API 23+
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            @Suppress("DEPRECATION")
            val info = cm.activeNetworkInfo ?: return "none"
            @Suppress("DEPRECATION")
            return when (info.type) {
                ConnectivityManager.TYPE_WIFI     -> "wifi"
                ConnectivityManager.TYPE_MOBILE   -> "cellular"
                ConnectivityManager.TYPE_ETHERNET -> "ethernet"
                else -> "other"
            }
        }

        val network = cm.activeNetwork ?: return "none"
        val caps = cm.getNetworkCapabilities(network) ?: return "none"

        return when {
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)     -> "wifi"
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

    private data class DisplaySize(val widthPx: Int, val heightPx: Int, val density: Float)

    /**
     * Returns the size of the whole display in physical pixels — what
     * window.screen.width/height report in the browser, which counts the areas
     * behind the status and navigation bars.
     *
     * resources.displayMetrics must not be used here: it reports the app's own
     * window, which on API 30+ excludes the system bars. On a 720x1650 device
     * that comes out 71dp short in height, and screen size carries the highest
     * weight of any cross-platform signal — the exact-match hash can then never
     * hit, and the fuzzy score drops to just above the match threshold, so any
     * further signal drift loses the attribution entirely.
     */
    private fun getDisplaySize(): DisplaySize? {
        val density = try {
            context.resources.displayMetrics.density
        } catch (_: Exception) {
            return null
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            try {
                val wm = context.getSystemService(Context.WINDOW_SERVICE) as? WindowManager
                // The largest window the app could ever occupy is the display itself,
                // system bar areas included.
                val bounds = wm?.maximumWindowMetrics?.bounds
                if (bounds != null && bounds.width() > 0 && bounds.height() > 0) {
                    return DisplaySize(bounds.width(), bounds.height(), density)
                }
            } catch (_: Exception) {
                // Non-visual contexts can refuse this on some OEM builds; fall through.
            }
        }

        return try {
            @Suppress("DEPRECATION")
            val display = (context.getSystemService(Context.WINDOW_SERVICE) as? WindowManager)
                ?.defaultDisplay ?: return null
            val real = DisplayMetrics()
            @Suppress("DEPRECATION")
            display.getRealMetrics(real)
            DisplaySize(real.widthPixels, real.heightPixels, density)
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
