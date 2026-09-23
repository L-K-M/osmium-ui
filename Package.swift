// swift-tools-version:5.9
// The native window host (macos/OsmiumWindows.swift) as a Swift package.
// The web side (osmium.css, src/) ships through npm.
import PackageDescription

let package = Package(
    name: "OsmiumUI",
    platforms: [.macOS(.v12)],
    products: [.library(name: "OsmiumUI", targets: ["OsmiumUI"])],
    targets: [.target(name: "OsmiumUI", path: "macos")]
)
