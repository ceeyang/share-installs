/*
 * Copyright 2024 share-installs Authors.
 */

package com.invitesdk.core

import android.util.Log

/** Internal logger for the InviteSDK. */
internal object InviteLogger {

    private const val TAG = "InviteSDK"
    var isDebugEnabled: Boolean = false

    fun d(message: String) {
        if (isDebugEnabled) Log.d(TAG, message)
    }

    fun i(message: String) {
        Log.i(TAG, message)
    }

    fun w(message: String, throwable: Throwable? = null) {
        if (throwable != null) Log.w(TAG, message, throwable)
        else Log.w(TAG, message)
    }

    fun e(message: String, throwable: Throwable? = null) {
        if (throwable != null) Log.e(TAG, message, throwable)
        else Log.e(TAG, message)
    }
}
