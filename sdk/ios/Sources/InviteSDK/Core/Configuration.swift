// Copyright 2024 share-installs Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.

import Foundation

/// Configuration for the share-installs iOS SDK.
///
/// **Single-tenant (self-hosted):** only `apiBaseURL` is required.
/// ```swift
/// let config = ShareInstallsConfiguration(
///     apiBaseURL: URL(string: "https://api.yourapp.com")!
/// )
/// ShareInstallsSDK.configure(with: config)
/// ```
///
/// **Multi-tenant (SaaS):** also supply `apiKey`.
/// ```swift
/// let config = ShareInstallsConfiguration(
///     apiBaseURL: URL(string: "https://api.shareinstalls.com")!,
///     apiKey: "sk_live_xxxxxxxx"
/// )
/// ShareInstallsSDK.configure(with: config)
/// ```
public struct ShareInstallsConfiguration: Sendable {

    // MARK: - Required

    /// Base URL of the share-installs backend.
    public let apiBaseURL: URL

    // MARK: - Optional

    /// API key for multi-tenant deployments.
    /// Leave `nil` for single-tenant (self-hosted) deployments.
    public let apiKey: String?

    /// Maximum seconds to wait for the resolve response. Default: 5.0.
    public let resolveTimeoutSeconds: Double

    /// Enable verbose debug logging (disable in production). Default: false.
    public let debugLoggingEnabled: Bool

    // MARK: - Init

    public init(
        apiBaseURL: URL,
        apiKey: String? = nil,
        resolveTimeoutSeconds: Double = 5.0,
        debugLoggingEnabled: Bool = false
    ) {
        self.apiBaseURL = apiBaseURL
        self.apiKey = apiKey
        self.resolveTimeoutSeconds = resolveTimeoutSeconds
        self.debugLoggingEnabled = debugLoggingEnabled
    }
}
