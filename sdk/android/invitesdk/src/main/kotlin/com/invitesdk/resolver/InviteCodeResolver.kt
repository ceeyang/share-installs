/*
 * Copyright 2024 share-installs Authors.
 */

package com.invitesdk.resolver

import android.content.Context
import com.invitesdk.core.InviteLogger
import com.invitesdk.fingerprint.ClipboardReader
import com.invitesdk.fingerprint.FingerprintCollector
import com.invitesdk.network.ApiClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

/** Data class representing a successfully resolved invite. */
data class ResolvedInvite(
    val code: String,
    val customData: Map<String, JsonElement>?,
    val confidence: Double,
    val channel: ResolveChannel,
) {
    enum class ResolveChannel { EXACT, FUZZY, CLIPBOARD }
}

/** Errors during invite resolution. */
sealed class ShareInstallsResolveException(message: String) : Exception(message) {
    object SdkNotConfigured :
        ShareInstallsResolveException("ShareInstallsSDK.configure() has not been called.")
}

/**
 * Handles deferred deep link resolution.
 *
 * No state is persisted by this class. Caching and persistence are the
 * responsibility of the caller.
 *
 * Resolution order:
 *   1. Clipboard channel (Android-only, confidence = 1.0)
 *   2. Exact fingerprint hash match (fast path)
 *   3. Fuzzy similarity match (fallback)
 */
internal class InviteCodeResolver(
    private val context: Context,
    private val apiClient: ApiClient,
    private val fingerprintCollector: FingerprintCollector,
) {
    // ---- Request / Response DTOs ----

    @Serializable
    internal data class ResolveRequest(
        val channel: String,
        val clipboardCode: String? = null,
        val fingerprint: FingerprintCollector.Signals,
    )

    @Serializable
    internal data class ResolveResponse(
        val matched: Boolean,
        @SerialName("inviteCode") val inviteCode: String? = null,
        val customData: Map<String, JsonElement>? = null,
        val meta: Meta? = null,
    ) {
        @Serializable
        data class Meta(
            val confidence: Double = 1.0,
            val channel: String = "exact",
        )
    }

    // ---- Public API ----

    /**
     * Submits device fingerprint signals to the backend and returns the matched invite.
     *
     * Always performs a network request. Returns null if no match is found.
     * Caching and persistence are the caller's responsibility.
     */
    @Throws(ShareInstallsResolveException::class)
    suspend fun resolveDeferred(): ResolvedInvite? {
        val clipboardCode = ClipboardReader.read(context)

        return withContext(Dispatchers.IO) {
            val signals = fingerprintCollector.collect()
            val request = ResolveRequest(
                channel = "android",
                clipboardCode = clipboardCode,
                fingerprint = signals,
            )

            InviteLogger.d("Resolving deferred invite (clipboard=${clipboardCode != null})...")

            val response: ResolveResponse = apiClient.post("/v1/resolutions", request)

            if (!response.matched || response.inviteCode == null) {
                InviteLogger.i("No deferred invite found for this device.")
                return@withContext null
            }

            val channel = when (response.meta?.channel) {
                "fuzzy"     -> ResolvedInvite.ResolveChannel.FUZZY
                "clipboard" -> ResolvedInvite.ResolveChannel.CLIPBOARD
                else        -> ResolvedInvite.ResolveChannel.EXACT
            }

            val resolved = ResolvedInvite(
                code = response.inviteCode,
                customData = response.customData,
                confidence = response.meta?.confidence ?: 1.0,
                channel = channel,
            )

            InviteLogger.i("Resolved invite: ${resolved.code} (channel=${channel}, confidence=${resolved.confidence})")
            resolved
        }
    }
}
