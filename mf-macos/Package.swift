// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MFTrackerKit",
    platforms: [
        .macOS(.v14),
    ],
    products: [
        .library(name: "MFTrackerKit", targets: ["MFTrackerKit"]),
    ],
    targets: [
        .target(
            name: "MFTrackerKit",
            path: "MFTrackerKit/Sources/MFTrackerKit"
        ),
    ]
)
