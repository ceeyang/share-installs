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
        resolver.clearCachedResolution()
        
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
            diskBucket = "128GB"
        )
        every { fingerprintCollector.collect() } returns mockSignals
    }

    @Test
    fun `resolveDeferred success returns ResolvedInvite and caches it`() = runTest {
        // Mock successful API response
        coEvery { apiClient.post<Any>(any(), any()) } returns mapOf(
            "matched" to true,
            "invite" to mapOf(
                "code" to "WELCOME100",
                "customData" to emptyMap<String, Any>()
            ),
            "meta" to mapOf(
                "confidence" to 1.0,
                "channel" to "exact"
            )
        )

        val result = resolver.resolveDeferred()
        
        assertNotNull(result)
        assertEquals("WELCOME100", result?.code)
        assertEquals(ResolvedInvite.ResolveChannel.EXACT, result?.channel)

        // Second call should throw AlreadyResolved
        assertThrows(ShareInstallsResolveException.AlreadyResolved::class.java) {
            runTest { resolver.resolveDeferred() }
        }
    }

    @Test
    fun `resolveDeferred returns null when not matched`() = runTest {
        coEvery { apiClient.post<Any>(any(), any()) } returns mapOf(
            "matched" to false
        )

        val result = resolver.resolveDeferred()
        assertNull(result)
        
        // Should NOT be cached, so second call can proceed (and also return null)
        val result2 = resolver.resolveDeferred()
        assertNull(result2)
    }

    @Test
    fun `clearCachedResolution allows re-resolving`() = runTest {
        coEvery { apiClient.post<Any>(any(), any()) } returns mapOf(
            "matched" to true,
            "invite" to mapOf("code" to "WIN")
        )

        resolver.resolveDeferred()
        
        // Clear cache
        resolver.clearCachedResolution()
        
        // Should proceed without throwing AlreadyResolved
        val result = resolver.resolveDeferred()
        assertNotNull(result)
    }
}
