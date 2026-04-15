/*
 * Copyright 2024 share-installs Authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

package com.invitesdk.core

/**
 * Configuration for the share-installs Android SDK.
 *
 * At least one of [apiKey] or [apiBaseUrl] must be provided.
 *
 * **Hosted service** (only [apiKey] required):
 * ```kotlin
 * val config = ShareInstallsConfiguration(apiKey = "sk_live_xxxxxxxx")
 * ShareInstallsSDK.configure(applicationContext, config)
 * ```
 *
 * **Self-hosted** (only [apiBaseUrl] required, no [apiKey]):
 * ```kotlin
 * val config = ShareInstallsConfiguration(apiBaseUrl = "https://your-server.com/api")
 * ShareInstallsSDK.configure(applicationContext, config)
 * ```
 *
 * @property apiKey           API key for the hosted service. Null for self-hosted deployments.
 * @property apiBaseUrl       Backend URL. Defaults to the hosted service when [apiKey] is set.
 * @property resolveTimeoutMs Network timeout in milliseconds. Default: 5000.
 * @property debugLoggingEnabled Verbose logging. Disable in production.
 */
data class ShareInstallsConfiguration(
    val apiKey: String? = null,
    val apiBaseUrl: String? = null,
    val resolveTimeoutMs: Long = 5_000L,
    val debugLoggingEnabled: Boolean = false,
) {
    companion object {
        /** Default base URL for the hosted service. */
        const val HOSTED_API_BASE_URL = "https://console.share-installs.com/api"
    }

    init {
        require(apiKey != null || apiBaseUrl != null) {
            "[ShareInstalls] Provide apiKey (hosted service) or apiBaseUrl (self-hosted)."
        }
        apiBaseUrl?.let {
            require(it.startsWith("http")) { "apiBaseUrl must be a valid HTTP/HTTPS URL." }
        }
    }

    /** Resolved base URL (never null after init). */
    internal val resolvedBaseUrl: String
        get() = (apiBaseUrl ?: HOSTED_API_BASE_URL).trimEnd('/')
}
