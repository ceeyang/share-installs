// Copyright 2024 share-installs Authors.

import Foundation
import UIKit
import SystemConfiguration

/// Collects device signals for fingerprint-based deferred deep linking.
///
/// All collected signals are non-PII and do not require user permission:
/// - No IDFA / IDFV (ATT authorisation not required)
/// - No precise location
/// - Only hardware/software characteristics and network metadata
///
/// The Keychain UUID is the strongest stable identifier available on iOS
/// without user permission – it persists across app reinstalls.
final class FingerprintCollector: Sendable {

    struct Signals: Encodable {
        let osVersion: String
        let screen: ScreenInfo
        let languages: [String]
        let timezone: String
        let networkType: String
        let diskBucket: String
        let keychainUuid: String
    }

    struct ScreenInfo: Encodable {
        let w: Int
        let h: Int
        let scale: Double
    }

    /// Collects all available device signals. Must be called on the main thread.
    @MainActor
    func collect() -> Signals {
        let screen = UIScreen.main
        let bounds = screen.bounds  // logical points — matches CSS pixels from web SDK

        return Signals(
            osVersion: UIDevice.current.systemVersion,
            screen: ScreenInfo(
                w: Int(bounds.width),
                h: Int(bounds.height),
                scale: Double(screen.scale)
            ),
            languages: Locale.preferredLanguages,
            timezone: TimeZone.current.identifier,
            networkType: Self.networkType(),
            diskBucket: Self.diskBucket(),
            keychainUuid: KeychainUUID.getOrCreate()
        )
    }

    // MARK: - Private helpers

    /// Returns "wifi", "cellular", or "none".
    private static func networkType() -> String {
        guard let reachability = SCNetworkReachabilityCreateWithName(nil, "8.8.8.8") else {
            return "none"
        }

        var flags: SCNetworkReachabilityFlags = []
        SCNetworkReachabilityGetFlags(reachability, &flags)

        let isReachable = flags.contains(.reachable)
        let isWWAN = flags.contains(.isWWAN)

        if !isReachable { return "none" }
        if isWWAN { return "cellular" }
        return "wifi"
    }

    /// Returns a coarse disk capacity bucket (e.g. "64GB", "256GB").
    private static func diskBucket() -> String {
        let urls = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)
        guard let url = urls.first,
              let values = try? url.resourceValues(forKeys: [.volumeTotalCapacityKey]),
              let total = values.volumeTotalCapacity
        else { return "unknown" }

        let gb = total / 1_000_000_000
        switch gb {
        case ..<33:   return "32GB"
        case ..<65:   return "64GB"
        case ..<129:  return "128GB"
        case ..<257:  return "256GB"
        case ..<513:  return "512GB"
        default:      return "1TB+"
        }
    }
}
