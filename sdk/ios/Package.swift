// swift-tools-version: 5.9
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "InviteSDK",
    platforms: [
        .iOS(.v15),
        .macOS(.v12),
    ],
    products: [
        .library(
            name: "InviteSDK",
            targets: ["InviteSDK"]
        ),
    ],
    dependencies: [],
    targets: [
        .target(
            name: "InviteSDK",
            dependencies: [],
            path: "Sources/InviteSDK",
            swiftSettings: [
                .enableExperimentalFeature("StrictConcurrency"),
            ]
        ),
        .testTarget(
            name: "InviteSDKTests",
            dependencies: ["InviteSDK"],
            path: "Tests/InviteSDKTests"
        ),
    ]
)
