// Copyright 2024 share-installs Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.

import Foundation

/// The primary entry point for the share-installs iOS SDK.
///
/// ## Quick Start
///
/// **1. Configure the SDK** (call once in `AppDelegate` or `@main` struct):
/// ```swift
/// // Single-tenant (self-hosted, no API key needed)
/// ShareInstallsSDK.configure(with: ShareInstallsConfiguration(
///     apiBaseURL: URL(string: "https://api.yourapp.com")!
/// ))
///
/// // Multi-tenant (SaaS)
/// ShareInstallsSDK.configure(with: ShareInstallsConfiguration(
///     apiBaseURL: URL(string: "https://api.shareinstalls.com")!,
///     apiKey: "sk_live_xxxxxxxx"
/// ))
/// ```
///
/// **2. Resolve deferred invite** (on first launch, after onboarding):
/// ```swift
/// Task {
///     if let invite = try await ShareInstallsSDK.shared.resolveDeferred() {
///         // Auto-fill invite code: invite.code
///         // Access inviter metadata: invite.customData
///     }
/// }
/// ```
public final class ShareInstallsSDK: @unchecked Sendable {

    // MARK: - Public Properties

    public static let sdkVersion = "1.0.0"

    /// The shared SDK instance. Requires ``configure(with:)`` to be called first.
    public static let shared = ShareInstallsSDK()

    // MARK: - Private Components

    private var configuration: ShareInstallsConfiguration?
    private var apiClient: APIClient?
    private var resolver: InviteCodeResolver?
    private let fingerprintCollector = FingerprintCollector()

    // MARK: - Lifecycle

    private init() {}

    /// Configures the SDK. Must be called before any other SDK method.
    public static func configure(with configuration: ShareInstallsConfiguration) {
        shared.configure(with: configuration)
    }

    private func configure(with configuration: ShareInstallsConfiguration) {
        self.configuration = configuration
        InviteLogger.isDebugEnabled = configuration.debugLoggingEnabled

        let client = APIClient(configuration: configuration)
        self.apiClient = client
        self.resolver = InviteCodeResolver(apiClient: client, fingerprintCollector: fingerprintCollector)

        InviteLogger.info("ShareInstallsSDK v\(Self.sdkVersion) configured", category: .general)
    }

    // MARK: - Deferred Deep Linking

    /// Submits device fingerprint signals to the backend and returns the matched invite.
    ///
    /// Always performs a network request. Returns `nil` if no match is found.
    /// Caching and persistence are the caller's responsibility.
    ///
    /// - Returns: The resolved invite, or `nil` if no matching click was found.
    /// - Throws: ``ShareInstallsResolveError`` if unconfigured or the network fails.
    @MainActor
    public func resolveDeferred() async throws -> ResolvedInvite? {
        guard let resolver else {
            throw ShareInstallsResolveError.sdkNotConfigured
        }
        return try await resolver.resolveDeferred()
    }

    /// Returns `true` if the SDK has been configured.
    public var isConfigured: Bool { configuration != nil }
}
