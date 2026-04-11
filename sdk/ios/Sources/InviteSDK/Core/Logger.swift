// Copyright 2024 share-installs Authors.

import Foundation
import os.log

/// Internal SDK logger. Uses os.log for performance and privacy compliance.
enum InviteLogger {
    private static let subsystem = "com.invitesdk"

    private static let general = Logger(subsystem: subsystem, category: "General")
    private static let network = Logger(subsystem: subsystem, category: "Network")
    private static let deepLink = Logger(subsystem: subsystem, category: "DeepLink")
    private static let fingerprint = Logger(subsystem: subsystem, category: "Fingerprint")

    static var isDebugEnabled = false

    static func debug(_ message: String, category: LogCategory = .general) {
        guard isDebugEnabled else { return }
        logger(for: category).debug("[InviteSDK] \(message, privacy: .public)")
    }

    static func info(_ message: String, category: LogCategory = .general) {
        logger(for: category).info("[InviteSDK] \(message, privacy: .public)")
    }

    static func warning(_ message: String, category: LogCategory = .general) {
        logger(for: category).warning("[InviteSDK] \(message, privacy: .public)")
    }

    static func error(_ message: String, category: LogCategory = .general) {
        logger(for: category).error("[InviteSDK] \(message, privacy: .public)")
    }

    static func fault(_ message: String, category: LogCategory = .general) {
        logger(for: category).fault("[InviteSDK] \(message, privacy: .public)")
    }

    private static func logger(for category: LogCategory) -> Logger {
        switch category {
        case .general: return general
        case .network: return network
        case .deepLink: return deepLink
        case .fingerprint: return fingerprint
        }
    }

    enum LogCategory {
        case general, network, deepLink, fingerprint
    }
}
