package com.invitesdk.fingerprint

import android.content.Context
import android.os.Build
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [Build.VERSION_CODES.P])
class FingerprintCollectorTest {

    private val context: Context = ApplicationProvider.getApplicationContext()
    private val collector = FingerprintCollector(context)

    @Test
    fun `collect returns signals with expected fields`() {
        val signals = collector.collect()

        assertNotNull(signals.androidId)
        assertNotNull(signals.osVersion)
        assertNotNull(signals.brand)
        assertNotNull(signals.model)
        assertNotNull(signals.timezone)
        
        // Basic type verification
        assert(signals.apiLevel > 0)
        assert(signals.languages.isNotEmpty())
    }

    @Test
    fun `screen info is collected`() {
        val signals = collector.collect()
        
        assertNotNull(signals.screen)
        // Robolectric defaults for screen might be 480x800 or similar
        assert(signals.screen.w >= 0)
        assert(signals.screen.h >= 0)
        assert(signals.screen.density > 0f)
    }

    @Test
    fun `network type returns expected values`() {
        val networkType = collector.collect().networkType
        // In Robolectric environment it might be "none" or "wifi" depending on setup
        // We just ensure it's a known string from the collector's logic
        val validTypes = listOf("wifi", "cellular", "ethernet", "other", "none")
        assert(validTypes.contains(networkType))
    }
}
