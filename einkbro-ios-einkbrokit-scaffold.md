2026-07-22

# EinkBro iOS: EinkBroKit package + Swift app target scaffold (Phase 0 start)

First code commit of the Swift rewrite (see the companion ADR
*einkbro-ios-swift-migration-plan* for the full plan). It creates the two build-system
anchors everything else lands in:

- **`EinkBroKit`** — a local Swift package holding ~all future code. Platforms declare
  iOS 17 *and* macOS 14: macOS is not a shipping target yet, but declaring it lets
  platform-free Core code build and test on the host with plain `swift build` /
  `swift test` (sub-second loop, no simulator), and it enforces the discipline that
  UIKit/WebKit-touching files stay behind `#if os(iOS)` — which is exactly what the future
  macOS port needs. GRDB 7 is the package's only third-party dependency.
- **`EinkBro`** — a thin SwiftUI app target added to the existing XcodeGen project beside
  the Compose `iosApp` target. It deliberately shares the Compose app's bundle id and
  Info.plist invariants (einkbro:// scheme, webarchive document type, audio background
  mode), so installing one build over the other exercises the upgrade-in-place path
  throughout the migration. Deployment target is iOS 17 (vs 15) for `@Observable`.

The 49 JS/CSS/HTML assets shared with the Android app are copied verbatim into the package
bundle with a synchronous `Assets.get(name)` loader — dropping the Kotlin side's async
preload dance, which existed only because Compose resource reads are suspend functions.
A smoke test asserts representative assets (including the `__SIGN__` placeholder contract
in the paging script) load from `Bundle.module`.

Verified: `xcodebuild -scheme EinkBro` builds for the iPhone 16 simulator, and
`swift test` passes on the host.
