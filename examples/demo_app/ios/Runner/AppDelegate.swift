import Flutter
import UIKit
import ShareInstalls

@main
@objc class AppDelegate: FlutterAppDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    GeneratedPluginRegistrant.register(with: self)

    // Set up MethodChannel for Flutter ↔ native SDK communication
    if let controller = window?.rootViewController as? FlutterViewController {
      let channel = FlutterMethodChannel(name: "com.shareinstalls/sdk", binaryMessenger: controller.binaryMessenger)

      channel.setMethodCallHandler { [weak self] (call, result) in
        switch call.method {
        case "configure":
          self?.handleConfigure(call: call, result: result)
        case "resolveDeferred":
          self?.handleResolveDeferred(result: result)
        case "clearCache":
          result(nil) // No-op: caching is the caller's responsibility
        case "getSDKInfo":
          self?.handleGetSDKInfo(result: result)
        default:
          result(FlutterMethodNotImplemented)
        }
      }
    }

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // MARK: - MethodChannel Handlers

  private func handleConfigure(call: FlutterMethodCall, result: @escaping FlutterResult) {
    guard let args = call.arguments as? [String: Any],
          let apiBaseUrl = args["apiBaseUrl"] as? String,
          let url = URL(string: apiBaseUrl) else {
      result(FlutterError(code: "INVALID_ARGS", message: "apiBaseUrl is required and must be a valid URL", details: nil))
      return
    }

    let apiKey = args["apiKey"] as? String
    let debug = args["debug"] as? Bool ?? false

    let config = ShareInstallsConfiguration(
      apiKey: apiKey,
      apiBaseURL: url,
      debugLoggingEnabled: debug
    )

    ShareInstallsSDK.configure(with: config)
    result("configured")
  }

  private func handleResolveDeferred(result: @escaping FlutterResult) {
    guard ShareInstallsSDK.shared.isConfigured else {
      result(FlutterError(code: "NOT_CONFIGURED", message: "Call configure() first", details: nil))
      return
    }

    Task { @MainActor in
      do {
        if let invite = try await ShareInstallsSDK.shared.resolveDeferred() {
          result([
            "code": invite.code,
            "confidence": invite.confidence,
            "channel": invite.channel.rawValue,
            "customData": invite.customData ?? [:],
          ] as [String: Any])
        } else {
          result(nil) // No match
        }
      } catch {
        result(FlutterError(code: "RESOLVE_ERROR", message: error.localizedDescription, details: nil))
      }
    }
  }

  private func handleGetSDKInfo(result: @escaping FlutterResult) {
    result([
      "version": ShareInstallsSDK.sdkVersion,
      "platform": "ios",
      "configured": ShareInstallsSDK.shared.isConfigured,
    ] as [String: Any])
  }
}
