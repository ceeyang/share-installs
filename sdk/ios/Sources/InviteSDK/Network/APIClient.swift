// Copyright 2024 share-installs Authors.

import Foundation

/// Network errors surfaced by the SDK.
public enum ShareInstallsNetworkError: LocalizedError {
    case invalidURL
    case noData
    case decodingFailed(Error)
    case serverError(statusCode: Int, message: String?)
    case timeout
    case noConnection

    public var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid URL"
        case .noData: return "No data received from server"
        case .decodingFailed(let err): return "Failed to decode response: \(err)"
        case .serverError(let code, let msg): return "Server error \(code): \(msg ?? "Unknown")"
        case .timeout: return "Request timed out"
        case .noConnection: return "No network connection"
        }
    }
}

// Backward-compatible typealias
@available(*, deprecated, renamed: "ShareInstallsNetworkError")
public typealias InviteNetworkError = ShareInstallsNetworkError

/// Lightweight HTTP client used internally by the SDK.
final class APIClient: Sendable {

    private let configuration: ShareInstallsConfiguration
    internal let session: URLSession

    init(configuration: ShareInstallsConfiguration, session: URLSession? = nil) {
        self.configuration = configuration

        if let session = session {
            self.session = session
            return
        }

        let sessionConfig = URLSessionConfiguration.default
        sessionConfig.timeoutIntervalForRequest = configuration.resolveTimeoutSeconds
        sessionConfig.timeoutIntervalForResource = configuration.resolveTimeoutSeconds * 2

        var headers: [AnyHashable: Any] = [
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-SDK-Platform": "ios",
            "X-SDK-Version": ShareInstallsSDK.sdkVersion,
        ]
        if let apiKey = configuration.apiKey {
            headers["Authorization"] = "Bearer \(apiKey)"
        }
        sessionConfig.httpAdditionalHeaders = headers

        self.session = URLSession(configuration: sessionConfig)
    }

    /// Performs a POST request and decodes the JSON response.
    func post<B: Encodable, R: Decodable>(
        path: String,
        body: B,
        responseType: R.Type
    ) async throws -> R {
        let url = configuration.apiBaseURL.appendingPathComponent(path)
        var request = URLRequest(url: url)
        request.httpMethod = "POST"

        do {
            request.httpBody = try JSONEncoder().encode(body)
        } catch {
            throw ShareInstallsNetworkError.decodingFailed(error)
        }

        InviteLogger.debug("POST \(url.absoluteString)", category: .network)

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await session.data(for: request)
        } catch let urlError as URLError {
            switch urlError.code {
            case .timedOut: throw ShareInstallsNetworkError.timeout
            case .notConnectedToInternet, .networkConnectionLost:
                throw ShareInstallsNetworkError.noConnection
            default: throw urlError
            }
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw ShareInstallsNetworkError.noData
        }

        InviteLogger.debug(
            "Response \(httpResponse.statusCode) from \(url.absoluteString)",
            category: .network
        )

        guard (200..<300).contains(httpResponse.statusCode) else {
            // Parse Google-style {error:{code,status,message}} or legacy {error,message}
            let message = (try? JSONDecoder().decode(GoogleErrorResponse.self, from: data))?.error.message
                ?? (try? JSONDecoder().decode(LegacyErrorResponse.self, from: data))?.message
            throw ShareInstallsNetworkError.serverError(
                statusCode: httpResponse.statusCode,
                message: message
            )
        }

        do {
            return try JSONDecoder().decode(R.self, from: data)
        } catch {
            throw ShareInstallsNetworkError.decodingFailed(error)
        }
    }
}

// MARK: - Error response models

private struct GoogleErrorResponse: Decodable {
    struct ErrorDetail: Decodable {
        let code: Int
        let status: String
        let message: String
    }
    let error: ErrorDetail
}

private struct LegacyErrorResponse: Decodable {
    let error: String
    let message: String?
}
