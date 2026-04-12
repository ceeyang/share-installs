package com.invitesdk.resolver

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import com.invitesdk.fingerprint.FingerprintCollector
import com.invitesdk.network.ApiClient
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class InviteCodeResolverTest {

    private val context: Context = ApplicationProvider.getApplicationContext()
    private val apiClient = mockk<ApiClient>()
    private val fingerprintCollector = mockk<FingerprintCollector>()
    private lateinit var resolver: InviteCodeResolver

    @Before
    fun setup() {
        resolver = InviteCodeResolver(context, apiClient, fingerprintCollector)
        
        // Mock default fingerprint signals
        val mockSignals = FingerprintCollector.Signals(
            androidId = "aid",
            osVersion = "14",
            apiLevel = 34,
            screen = FingerprintCollector.ScreenInfo(1080, 1920, 3.0f),
            languages = listOf("en-US"),
            timezone = "UTC",
            networkType = "wifi",
            brand = "Google",
            model = "Pixel 8",
            buildFingerprint = "fingerprint",
            diskBucket = "128GB",
            hardwareConcurrency = 8,
            touchPoints = 5
        )
        every { fingerprintCollector.collect() } returns mockSignals
    }

    @Test
    fun `resolveDeferred success returns ResolvedInvite`() = runTest {
        // Mock successful API response
        coEvery { apiClient.post<Any, InviteCodeResolver.ResolveResponse>(any(), any()) } returns InviteCodeResolver.ResolveResponse(
            matched = true,
            inviteCode = "WELCOME100",
            customData = emptyMap(),
            meta = InviteCodeResolver.ResolveResponse.Meta(
                confidence = 1.0,
                channel = "exact"
            )
        )

        val result = resolver.resolveDeferred()
        
        assertNotNull(result)
        assertEquals("WELCOME100", result?.code)
        assertEquals(ResolvedInvite.ResolveChannel.EXACT, result?.channel)
    }

    @Test
    fun `resolveDeferred returns null when not matched`() = runTest {
        coEvery { apiClient.post<Any, InviteCodeResolver.ResolveResponse>(any(), any()) } returns InviteCodeResolver.ResolveResponse(
            matched = false,
            inviteCode = null,
            customData = null,
            meta = null
        )

        val result = resolver.resolveDeferred()
        assertNull(result)
    }
}
