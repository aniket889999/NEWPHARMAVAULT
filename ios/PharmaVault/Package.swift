// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "PharmaVaultClientPolicy",
    platforms: [.macOS(.v13)],
    products: [.library(name: "PharmaVaultClientPolicy", targets: ["PharmaVaultClientPolicy"])],
    targets: [
        .target(name: "PharmaVaultClientPolicy", path: "PharmaVault", exclude: ["PharmaVaultApp.swift", "Info.plist"], sources: ["ClientPolicy.swift"]),
        .testTarget(name: "PharmaVaultClientPolicyTests", dependencies: ["PharmaVaultClientPolicy"], path: "Tests")
    ]
)
