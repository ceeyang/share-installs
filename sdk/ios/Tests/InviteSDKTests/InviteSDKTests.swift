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

    // MARK: - Fingerprint Collector

    @MainActor
    func testFingerprintCollectorReturnsSignals() {
        let collector = FingerprintCollector()
        let signals = collector.collect()
        // platform is now added by the APIClient/Resolver, not the collector itself
        XCTAssertNotNil(signals.osVersion)
        XCTAssertNotNil(signals.timezone)
        XCTAssertFalse(signals.languages.isEmpty)
    }
}
