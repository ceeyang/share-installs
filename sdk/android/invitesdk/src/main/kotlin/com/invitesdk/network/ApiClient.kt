/*
 * Copyright 2024 share-installs Authors.
 */

package com.invitesdk.network

import com.invitesdk.BuildConfig
import com.invitesdk.core.InviteLogger
import com.invitesdk.core.ShareInstallsConfiguration
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.logging.HttpLoggingInterceptor
import java.io.IOException
import java.util.concurrent.TimeUnit

/** Network errors thrown by the SDK. */
sealed class ShareInstallsNetworkException(message: String, cause: Throwable? = null) :
    Exception(message, cause) {
    class Timeout(message: String) : ShareInstallsNetworkException(message)
    class NoConnection(message: String, cause: Throwable) : ShareInstallsNetworkException(message, cause)
    class ServerError(val statusCode: Int, val errorBody: String) :
        ShareInstallsNetworkException("Server error $statusCode: $errorBody")
    class DecodingError(message: String, cause: Throwable) : ShareInstallsNetworkException(message, cause)
}

/**
 * Lightweight HTTP client using OkHttp.
 * Avoids Retrofit to minimize SDK transitive dependency footprint.
 */
internal class ApiClient(private val configuration: ShareInstallsConfiguration) {

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    private val httpClient: OkHttpClient by lazy {
        val loggingInterceptor = HttpLoggingInterceptor { message ->
            InviteLogger.d("[Network] $message")
        }.apply {
            level = if (configuration.debugLoggingEnabled)
                HttpLoggingInterceptor.Level.BODY
            else
                HttpLoggingInterceptor.Level.NONE
        }

        OkHttpClient.Builder()
            .connectTimeout(configuration.resolveTimeoutMs, TimeUnit.MILLISECONDS)
            .readTimeout(configuration.resolveTimeoutMs, TimeUnit.MILLISECONDS)
            .writeTimeout(configuration.resolveTimeoutMs, TimeUnit.MILLISECONDS)
            .addInterceptor { chain ->
                val builder = chain.request().newBuilder()
                    .addHeader("Content-Type", "application/json")
                    .addHeader("Accept", "application/json")
                    .addHeader("X-SDK-Platform", "android")
                    .addHeader("X-SDK-Version", BuildConfig.SDK_VERSION)

                configuration.apiKey?.let { key ->
                    builder.addHeader("Authorization", "Bearer $key")
                }

                chain.proceed(builder.build())
            }
            .addInterceptor(loggingInterceptor)
            .build()
    }

    private val mediaType = "application/json".toMediaType()

    /**
     * Performs a synchronous POST request and decodes the JSON response.
     * Must be called from a background thread (use coroutines with Dispatchers.IO).
     */
    @Throws(ShareInstallsNetworkException::class)
    inline fun <reified B, reified R> post(path: String, body: B): R {
        val url = "${configuration.normalizedBaseUrl}$path"
        val requestBody = json.encodeToString(body).toRequestBody(mediaType)

        InviteLogger.d("POST $url")

        val request = Request.Builder()
            .url(url)
            .post(requestBody)
            .build()

        val response = try {
            httpClient.newCall(request).execute()
        } catch (e: java.net.SocketTimeoutException) {
            throw ShareInstallsNetworkException.Timeout("Request timed out: $url")
        } catch (e: IOException) {
            throw ShareInstallsNetworkException.NoConnection("Network error: ${e.message}", e)
        }

        val responseBody = response.body?.string() ?: ""
        InviteLogger.d("Response ${response.code} from $url")

        if (!response.isSuccessful) {
            throw ShareInstallsNetworkException.ServerError(response.code, responseBody)
        }

        return try {
            json.decodeFromString(responseBody)
        } catch (e: Exception) {
            throw ShareInstallsNetworkException.DecodingError("Failed to decode response: ${e.message}", e)
        }
    }
}
