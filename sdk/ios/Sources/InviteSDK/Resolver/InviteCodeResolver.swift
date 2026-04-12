// Copyright 2024 share-installs Authors.

import Foundation

/// The resolved invite information returned on successful deferred deep link resolution.
public struct ResolvedInvite: @unchecked Sendable {
    /// The raw invite code string.
    public let code: String
    /// Custom metadata set by the inviter when creating the invite.
    public let customData: [String: Any]?
    /// Confidence score of the fingerprint match (0.0–1.0).
    public let confidence: Double
    /// How the invite was resolved.
    public let channel: ResolveChannel

    public enum ResolveChannel: String, Sendable {
        case exact, fuzzy, clipboard
    }
}

/// Errors thrown during invite resolution.
public enum ShareInstallsResolveError: LocalizedError, Sendable {
    case sdkNotConfigured
    case networkError(ShareInstallsNetworkError)

    public var errorDescription: String? {
        switch self {
        case .sdkNotConfigured:
            return "ShareInstallsSDK is not configured. Call ShareInstallsSDK.configure(with:) first."
        case .networkError(let e):
            return e.localizedDescription
        }
    }
}

/// Handles deferred deep link resolution by submitting device fingerprint signals
/// to the backend and returning the matched invite code.
///
/// No state is persisted by this class. Caching and persistence are the
/// responsibility of the caller.
final class InviteCodeResolver: Sendable {

    private let apiClient: APIClient
    private let fingerprintCollector: FingerprintCollector

    init(apiClient: APIClient, fingerprintCollector: FingerprintCollector) {
        self.apiClient = apiClient
        self.fingerprintCollector = fingerprintCollector
    }

    // MARK: - Request / Response models

    private struct ResolveRequest: Encodable {
        let channel: String
        let fingerprint: FingerprintCollector.Signals
    }

    private struct ResolveResponse: Decodable {
        let matched: Bool
        let inviteCode: String?
        let customData: [String: AnyDecodable]?
        let meta: Meta?

        struct Meta: Decodable {
            let confidence: Double
            let channel: String
        }
    }

    // MARK: - Public

    /// Submits device fingerprint signals to the backend and returns the matched invite.
    ///
    /// Always performs a network request. Returns `nil` if no match is found.
    /// Caching and persistence are the caller's responsibility.
    @MainActor
    func resolveDeferred() async throws -> ResolvedInvite? {
        let signals = fingerprintCollector.collect()
        let requestBody = ResolveRequest(channel: "ios", fingerprint: signals)

        InviteLogger.debug("Resolving deferred invite...", category: .deepLink)

        let response: ResolveResponse
        do {
            response = try await apiClient.post(
                path: "/v1/resolutions",
                body: requestBody,
                responseType: ResolveResponse.self
            )
        } catch let networkError as ShareInstallsNetworkError {
            throw ShareInstallsResolveError.networkError(networkError)
        }

        guard response.matched, let inviteCode = response.inviteCode else {
            InviteLogger.info("No deferred invite found for this device", category: .deepLink)
            return nil
        }

        let channel: ResolvedInvite.ResolveChannel
        switch response.meta?.channel {
        case "fuzzy":     channel = .fuzzy
        case "clipboard": channel = .clipboard
        default:          channel = .exact
        }

        let resolved = ResolvedInvite(
            code: inviteCode,
            customData: response.customData?.mapValues { $0.value },
            confidence: response.meta?.confidence ?? 1.0,
            channel: channel
        )

        InviteLogger.info(
            "Resolved invite: \(inviteCode) (channel: \(channel), confidence: \(resolved.confidence))",
            category: .deepLink
        )
        return resolved
    }
}

// MARK: - AnyDecodable helper

struct AnyDecodable: Decodable {
    let value: Any

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let v = try? c.decode(Int.self) { value = v }
        else if let v = try? c.decode(Double.self) { value = v }
        else if let v = try? c.decode(Bool.self) { value = v }
        else if let v = try? c.decode(String.self) { value = v }
        else if let v = try? c.decode([AnyDecodable].self) { value = v.map(\.value) }
        else if let v = try? c.decode([String: AnyDecodable].self) { value = v.mapValues(\.value) }
        else { value = NSNull() }
    }
}
