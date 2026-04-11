// Copyright 2024 share-installs Authors.

import Foundation
import Security

/// Manages a persistent UUID stored in the iOS Keychain.
///
/// Unlike `UserDefaults`, Keychain data survives app uninstall/reinstall
/// (as long as the device is not erased). This makes it the strongest
/// stable identifier available on iOS without requiring user permission.
///
/// The UUID is generated once and never changes for a given app installation
/// on a given device.
enum KeychainUUID {

    private static let service = "com.shareinstalls.sdk"
    private static let account = "device_uuid"

    /// Returns the persistent device UUID, generating one if needed.
    static func getOrCreate() -> String {
        if let existing = read() {
            return existing
        }
        let uuid = UUID().uuidString
        save(uuid)
        return uuid
    }

    // MARK: - Private helpers

    private static func read() -> String? {
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: account,
            kSecReturnData: true,
            kSecMatchLimit: kSecMatchLimitOne,
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess,
              let data = result as? Data,
              let string = String(data: data, encoding: .utf8)
        else { return nil }

        return string
    }

    private static func save(_ value: String) {
        guard let data = value.data(using: .utf8) else { return }

        // Delete any existing entry first (handles re-installs with Keychain data intact)
        let deleteQuery: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: account,
        ]
        SecItemDelete(deleteQuery as CFDictionary)

        let addQuery: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: account,
            kSecValueData: data,
            // Accessible after first unlock; survives backup/restore.
            kSecAttrAccessible: kSecAttrAccessibleAfterFirstUnlock,
        ]

        let status = SecItemAdd(addQuery as CFDictionary, nil)
        if status != errSecSuccess {
            InviteLogger.warning("Keychain save failed (status \(status))", category: .fingerprint)
        }
    }
}
