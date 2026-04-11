/*
 * Copyright 2024 share-installs Authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

package com.invitesdk

import android.content.Context
import com.invitesdk.core.InviteLogger
import com.invitesdk.core.ShareInstallsConfiguration
import com.invitesdk.fingerprint.FingerprintCollector
import com.invitesdk.network.ApiClient
import com.invitesdk.resolver.InviteCodeResolver
import com.invitesdk.resolver.ResolvedInvite
import com.invitesdk.resolver.ShareInstallsResolveException

/**
 * The primary entry point for the share-installs Android SDK.
 *
 * ## Quick Start
 *
 * **1. Initialize in Application.onCreate():**
 * ```kotlin
 * // Single-tenant (self-hosted, no API key needed)
 * ShareInstallsSDK.configure(
 *     context = applicationContext,
 *     configuration = ShareInstallsConfiguration(
 *         apiBaseUrl = "https://api.yourapp.com"
 *     )
 * )
 *
 * // Multi-tenant (SaaS)
 * ShareInstallsSDK.configure(
 *     context = applicationContext,
 *     configuration = ShareInstallsConfiguration(
 *         apiBaseUrl = "https://api.shareinstalls.com",
 *         apiKey = "sk_live_xxxxxxxx"
 *     )
 * )
 * ```
 *
 * **2. Resolve deferred invite on first launch (call from foreground):**
 * ```kotlin
 * lifecycleScope.launch {
 *     try {
 *         val invite = ShareInstallsSDK.instance.resolveDeferred()
 *         invite?.let { applyInviteCode(it.code) }
 *     } catch (e: ShareInstallsResolveException.AlreadyResolved) {
 *         // Already handled in a previous session
 *     }
 * }
 * ```
 */
class ShareInstallsSDK private constructor(
    context: Context,
    private val configuration: ShareInstallsConfiguration,
) {
    companion object {
        const val SDK_VERSION = BuildConfig.SDK_VERSION

        @Volatile
        private var _instance: ShareInstallsSDK? = null

        /** The configured SDK instance. Throws [IllegalStateException] if not yet configured. */
        val instance: ShareInstallsSDK
            get() = _instance
                ?: throw IllegalStateException(
                    "ShareInstallsSDK is not configured. Call ShareInstallsSDK.configure() first."
                )

        /**
         * Configures and initializes the SDK. Must be called before [instance].
         * Safe to call multiple times; subsequent calls replace the existing instance.
         */
        @JvmStatic
        fun configure(context: Context, configuration: ShareInstallsConfiguration) {
            synchronized(this) {
                InviteLogger.isDebugEnabled = configuration.debugLoggingEnabled
                _instance = ShareInstallsSDK(context.applicationContext, configuration)
                InviteLogger.i("ShareInstallsSDK v$SDK_VERSION initialized")
            }
        }

        /** Returns true if the SDK has been configured. */
        val isConfigured: Boolean get() = _instance != null
    }

    // ---- Internal Components ----

    private val apiClient = ApiClient(configuration)
    private val fingerprintCollector = FingerprintCollector(context)
    private val resolver = InviteCodeResolver(context, apiClient, fingerprintCollector)

    // ---- Public API ----

    /**
     * Attempts to resolve a deferred invite for this installation.
     *
     * Checks the clipboard first (100% confidence), then falls back to fingerprint
     * matching. Should be called **once per install**, after the user completes
     * registration or onboarding.
     *
     * **Must be called from the foreground** (clipboard access requires the app
     * to be visible in Android 10+). Internally switches to IO dispatcher for
     * the network call.
     *
     * @return The resolved invite, or null if no match was found.
     * @throws [ShareInstallsResolveException.AlreadyResolved] if already resolved.
     */
    @Throws(ShareInstallsResolveException::class)
    suspend fun resolveDeferred(): ResolvedInvite? {
        return resolver.resolveDeferred()
    }

}
