// Copyright 2024 share-installs Authors.

import XCTest
@testable import InviteSDK

final class ShareInstallsSDKTests: XCTestCase {

    override func setUp() {
        super.setUp()
        ShareInstallsSDK.configure(with: ShareInstallsConfiguration(
            apiBaseURL: URL(string: "https://api.test.example.com")!,
            debugLoggingEnabled: true
        ))
    }

    // MARK: - Configuration

    func testConfigurationInitializesSDK() {
        XCTAssertTrue(ShareInstallsSDK.shared.isConfigured)
    }

    // MARK: - Deep Link Handling

    func testHandleUniversalLinkExtractsCode() {
        let url = URL(string: "https://yourdomain.com/invite/ABC12345")!
        let code = ShareInstallsSDK.shared.handleUniversalLink(url)
        XCTAssertEqual(code, "ABC12345")
    }

    func testHandleUniversalLinkIgnoresNonInviteURL() {
        let url = URL(string: "https://yourdomain.com/about")!
        let code = ShareInstallsSDK.shared.handleUniversalLink(url)
        XCTAssertNil(code)
    }

    func testHandleUniversalLinkRejectsShortCode() {
        let url = URL(string: "https://yourdomain.com/invite/AB")!
        let code = ShareInstallsSDK.shared.handleUniversalLink(url)
        XCTAssertNil(code)
    }

    func testHandleDeepLinkExtractsCode() {
        // Requires urlScheme to be set
        ShareInstallsSDK.configure(with: ShareInstallsConfiguration(
            apiBaseURL: URL(string: "https://api.test.example.com")!,
            urlScheme: "myapp"
        ))
        let url = URL(string: "myapp://invite?code=XYZ99999")!
        let code = ShareInstallsSDK.shared.handleDeepLink(url)
        XCTAssertEqual(code, "XYZ99999")
    }

    func testHandleDeepLinkIgnoresWrongScheme() {
        ShareInstallsSDK.configure(with: ShareInstallsConfiguration(
            apiBaseURL: URL(string: "https://api.test.example.com")!,
            urlScheme: "myapp"
        ))
        let url = URL(string: "otherapp://invite?code=XYZ99999")!
        let code = ShareInstallsSDK.shared.handleDeepLink(url)
        XCTAssertNil(code)
    }

    // MARK: - Fingerprint Collector

    @MainActor
    func testFingerprintCollectorReturnsSignals() {
        let collector = FingerprintCollector()
        let signals = collector.collect()
        XCTAssertEqual(signals.platform, "ios")
        XCTAssertNotNil(signals.osVersion)
    }
}
