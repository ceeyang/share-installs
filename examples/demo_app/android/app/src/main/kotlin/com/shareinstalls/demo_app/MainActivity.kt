package com.shareinstalls.demo_app

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import com.invitesdk.ShareInstallsSDK
import com.invitesdk.core.ShareInstallsConfiguration
import com.invitesdk.resolver.ShareInstallsResolveException
import kotlinx.coroutines.*
import kotlinx.serialization.json.JsonPrimitive

class MainActivity : FlutterActivity() {

    private val CHANNEL = "com.shareinstalls/sdk"
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "configure" -> handleConfigure(call, result)
                "resolveDeferred" -> handleResolveDeferred(result)
                "clearCache" -> handleClearCache(result)
                "getSDKInfo" -> handleGetSDKInfo(result)
                else -> result.notImplemented()
            }
        }
    }

    private fun handleConfigure(call: MethodCall, result: MethodChannel.Result) {
        val apiBaseUrl = call.argument<String>("apiBaseUrl")
        if (apiBaseUrl.isNullOrBlank()) {
            result.error("INVALID_ARGS", "apiBaseUrl is required", null)
            return
        }

        val apiKey = call.argument<String>("apiKey")
        val debug = call.argument<Boolean>("debug") ?: false

        try {
            val config = ShareInstallsConfiguration(
                apiBaseUrl = apiBaseUrl,
                apiKey = apiKey,
                debugLoggingEnabled = debug
            )
            ShareInstallsSDK.configure(applicationContext, config)
            result.success("configured")
        } catch (e: Exception) {
            result.error("CONFIGURE_ERROR", e.message, null)
        }
    }

    private fun handleResolveDeferred(result: MethodChannel.Result) {
        if (!ShareInstallsSDK.isConfigured) {
            result.error("NOT_CONFIGURED", "Call configure() first", null)
            return
        }

        scope.launch {
            try {
                val invite = ShareInstallsSDK.instance.resolveDeferred()
                if (invite != null) {
                    val customDataMap = invite.customData?.mapValues { (_, value) ->
                        when (value) {
                            is JsonPrimitive -> value.content
                            else -> value.toString()
                        }
                    }
                    result.success(mapOf(
                        "code" to invite.code,
                        "confidence" to invite.confidence,
                        "channel" to invite.channel.name.lowercase(),
                        "customData" to (customDataMap ?: emptyMap<String, String>())
                    ))
                } else {
                    result.success(null)
                }
            } catch (e: Exception) {
                result.error("RESOLVE_ERROR", e.message, null)
            }
        }
    }

    private fun handleClearCache(result: MethodChannel.Result) {
        try {
            // Note: Caching is now handled at the app level, so the SDK no longer caches it.
            // Leaving this method channel for backward compatibility or future plugin caching.
            result.success(null)
        } catch (e: Exception) {
            result.error("CLEAR_ERROR", e.message, null)
        }
    }

    private fun handleGetSDKInfo(result: MethodChannel.Result) {
        result.success(mapOf(
            "version" to if (ShareInstallsSDK.isConfigured) ShareInstallsSDK.SDK_VERSION else "unknown",
            "platform" to "android",
            "configured" to ShareInstallsSDK.isConfigured
        ))
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }
}
