/*
 * Copyright 2024 share-installs Authors.
 */

package com.invitesdk.fingerprint

import android.content.ClipboardManager
import android.content.Context
import com.invitesdk.core.InviteLogger

/**
 * Reads the Android clipboard to detect invite codes written by the landing page.
 *
 * ## Clipboard channel
 * The invite landing page can write the following string to the clipboard before
 * redirecting the user to the Play Store:
 *
 *   Single-tenant format:  `SHAREINSTALLS:{inviteCode}`
 *   Multi-tenant format:   `SHAREINSTALLS:{projectId}:{inviteCode}`
 *
 * On first app launch, this class reads and parses that value. If found, it is
 * a 100%-confidence match and takes priority over fingerprint matching.
 *
 * The clipboard content is cleared after reading to avoid polluting future
 * clipboard operations.
 *
 * **Important:** Android 10+ restricts background clipboard reads. This must be
 * called while the app is in the foreground (e.g. in Activity.onResume or
 * Application.onCreate when the process is starting fresh).
 */
internal object ClipboardReader {

    private const val PREFIX = "SHAREINSTALLS:"

    /**
     * Reads the clipboard and returns the raw clipboard string if it matches
     * the expected prefix. Returns `null` if no matching value is found.
     *
     * Clears the clipboard after a successful read.
     */
    fun read(context: Context): String? {
        return try {
            val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
                ?: return null

            val item = cm.primaryClip?.getItemAt(0) ?: return null
            val text = item.coerceToText(context)?.toString() ?: return null

            if (!text.startsWith(PREFIX)) return null

            InviteLogger.d("Clipboard invite code found")

            // Clear clipboard so the value is not read by other apps or on future launches
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                cm.clearPrimaryClip()
            } else {
                @Suppress("DEPRECATION")
                cm.setPrimaryClip(android.content.ClipData.newPlainText("", ""))
            }

            text
        } catch (e: Exception) {
            InviteLogger.d("Clipboard read failed: ${e.message}")
            null
        }
    }
}
