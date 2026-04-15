// Copyright 2024 share-installs Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.

import Foundation

/// Configuration for the share-installs iOS SDK.
///
/// At least one of `apiKey` or `apiBaseURL` must be provided.
///
/// **Hosted service** (only `apiKey` required):
/// ```swift
/// let config = ShareInstallsConfiguration(apiKey: "sk_live_xxxxxxxx")
/// ShareInstallsSDK.configure(with: config)
/// ```
///
/// **Self-hosted** (only `apiBaseURL` required, no `apiKey`):
/// ```swift
/// let config = ShareInstallsConfiguration(
///     apiBaseURL: URL(string: "https://your-server.com/api")!
/// )
/// ShareInstallsSDK.configure(with: config)
/// ```
public struct ShareInstallsConfiguration: Sendable {

    // MARK: - Constants

    /// Default base URL for the hosted service.
    public static let hostedAPIBaseURL = URL(string: "https://console.share-installs.com/api")!

    // MARK: - Properties

    /// Base URL of the share-installs backend.
    /// Defaults to the hosted service URL when `apiKey` is supplied and this is omitted.
    public let apiBaseURL: URL

    /// API key for the hosted service.
    /// Leave `nil` for self-hosted deployments.
    public let apiKey: String?

    /// Maximum seconds to wait for the resolve response. Default: 5.0.
    public let resolveTimeoutSeconds: Double

    /// Enable verbose debug logging (disable in production). Default: false.
    public let debugLoggingEnabled: Bool

    // MARK: - Init

    /// - Parameters:
    ///   - apiKey: API key for the hosted service. Omit when self-hosting.
    ///   - apiBaseURL: Backend URL for self-hosted deployments.
    ///                 Defaults to the hosted service URL when `apiKey` is provided.
    ///                 At least one of `apiKey` or `apiBaseURL` must be set.
    public init(
        apiKey: String? = nil,
        apiBaseURL: URL? = nil,
        resolveTimeoutSeconds: Double = 5.0,
        debugLoggingEnabled: Bool = false
    ) {
        precondition(
            apiKey != nil || apiBaseURL != nil,
            "[ShareInstalls] Provide `apiKey` (hosted service) or `apiBaseURL` (self-hosted)."
        )
        self.apiKey = apiKey
        self.apiBaseURL = apiBaseURL ?? ShareInstallsConfiguration.hostedAPIBaseURL
        self.resolveTimeoutSeconds = resolveTimeoutSeconds
        self.debugLoggingEnabled = debugLoggingEnabled
    }
}
