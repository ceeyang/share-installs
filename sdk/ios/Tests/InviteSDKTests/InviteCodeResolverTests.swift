import XCTest
@testable import InviteSDK

final class InviteCodeResolverTests: XCTestCase {

    var resolver: InviteCodeResolver!
    var apiClient: APIClient!
    var fingerprintCollector: FingerprintCollector!
    var session: URLSession!

    @MainActor
    override func setUp() {
        super.setUp()
        
        let config = ShareInstallsConfiguration(
            apiBaseURL: URL(string: "https://api.example.com")!
        )
        
        // Setup mock session
        let sessionConfig = URLSessionConfiguration.ephemeral
        sessionConfig.protocolClasses = [NetworkMock.self]
        session = URLSession(configuration: sessionConfig)
        
        apiClient = APIClient(configuration: config, session: session)
        fingerprintCollector = FingerprintCollector()
        resolver = InviteCodeResolver(apiClient: apiClient, fingerprintCollector: fingerprintCollector)
        
        resolver.clearCachedResolution()
    }

    @MainActor
    func testResolveDeferredSuccess() async throws {
        let jsonResponse = """
        {
            "matched": true,
            "invite": {
                "code": "PROMO2024",
                "customData": {"source": "test"}
            },
            "meta": {
                "confidence": 0.95,
                "channel": "fuzzy"
            }
        }
        """.data(using: .utf8)!

        NetworkMock.mockHandler = { request in
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 200,
                httpVersion: nil,
                headerFields: ["Content-Type": "application/json"]
            )!
            return (response, jsonResponse)
        }

        let result = try await resolver.resolveDeferred()
        
        XCTAssertNotNil(result)
        XCTAssertEqual(result?.code, "PROMO2024")
        XCTAssertEqual(result?.channel, .fuzzy)
        XCTAssertEqual(result?.confidence, 0.95)
        
        // Verify caching: second call should throw alreadyResolved
        do {
            _ = try await resolver.resolveDeferred()
            XCTFail("Should have thrown alreadyResolved")
        } catch ShareInstallsResolveError.alreadyResolved {
            // Success
        } catch {
            XCTFail("Wrong error thrown: \(error)")
        }
    }

    @MainActor
    func testResolveDeferredNoMatch() async throws {
        let jsonResponse = """
        {
            "matched": false
        }
        """.data(using: .utf8)!

        NetworkMock.mockHandler = { request in
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 200,
                httpVersion: nil,
                headerFields: ["Content-Type": "application/json"]
            )!
            return (response, jsonResponse)
        }

        let result = try await resolver.resolveDeferred()
        XCTAssertNil(result)
    }
}
