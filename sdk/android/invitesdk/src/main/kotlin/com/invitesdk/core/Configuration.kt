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
 * **Single-tenant (self-hosted):** only [apiBaseUrl] is required.
 * ```kotlin
 * val config = ShareInstallsConfiguration(
 *     apiBaseUrl = "https://api.yourapp.com"
 * )
 * ShareInstallsSDK.configure(applicationContext, config)
 * ```
 *
 * **Multi-tenant (SaaS):** also supply [apiKey].
 * ```kotlin
 * val config = ShareInstallsConfiguration(
 *     apiBaseUrl = "https://api.shareinstalls.com",
 *     apiKey = "sk_live_xxxxxxxx"
 * )
 * ShareInstallsSDK.configure(applicationContext, config)
 * ```
 *
 * @property apiBaseUrl       Base URL of the share-installs backend (no trailing slash).
 * @property apiKey           API key for multi-tenant deployments. Null for single-tenant.
 * @property resolveTimeoutMs Network timeout in milliseconds. Default: 5000.
 * @property debugLoggingEnabled Verbose logging. Disable in production.
 */
data class ShareInstallsConfiguration(
    val apiBaseUrl: String,
    val apiKey: String? = null,
    val resolveTimeoutMs: Long = 5_000L,
    val debugLoggingEnabled: Boolean = false,
) {
    init {
        require(apiBaseUrl.startsWith("http")) {
            "apiBaseUrl must be a valid HTTP/HTTPS URL."
        }
    }

    internal val normalizedBaseUrl: String
        get() = apiBaseUrl.trimEnd('/')
}
