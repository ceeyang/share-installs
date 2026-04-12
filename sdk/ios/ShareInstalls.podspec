Pod::Spec.new do |s|
  s.name             = 'ShareInstalls'
  s.version          = '0.0.1'
  s.summary          = 'iOS SDK for share-installs – deferred deep link invite attribution.'

  s.description      = <<~DESC
    ShareInstalls is the iOS SDK for the open-source share-installs platform.
    It enables deferred deep linking: when a user clicks an invite link and
    installs the app, the invite code is automatically resolved and returned
    to your app on first launch – even if the app was not installed when the
    link was clicked.

    Features:
    - Deferred deep link resolution via browser fingerprint matching
    - iOS Universal Links (App Links) support
    - Custom URI scheme fallback
    - Zero third-party dependencies
    - Swift 5.9+, iOS 15+
  DESC

  s.homepage         = 'https://github.com/ceeyang/share-installs'
  s.license          = { :type => 'Apache-2.0', :file => 'LICENSE' }
  s.author           = { 'share-installs' => 'hello@share-installs.dev' }
  s.source           = {
    :git => 'https://github.com/ceeyang/share-installs.git',
    :tag => "sdk-ios-v#{s.version}"
  }

  s.ios.deployment_target = '15.0'
  s.swift_versions        = ['5.9']
  # Match the SPM target name so consumers use `import InviteSDK` with both
  # CocoaPods and SPM without changing their import statements.
  s.module_name           = 'InviteSDK'

  # Paths are relative to the git repo root (monorepo layout: sdk/ios/ subdir)
  s.source_files = 'sdk/ios/Sources/InviteSDK/**/*.swift'

  # No external dependencies – uses only system frameworks
  s.frameworks = 'Foundation', 'UIKit'

  # Pod does not contain resources or assets
  s.resource_bundles = {}

  # Exclude test targets from pod installation
  s.test_spec 'Tests' do |ts|
    ts.source_files = 'sdk/ios/Tests/InviteSDKTests/**/*.swift'
  end
end
