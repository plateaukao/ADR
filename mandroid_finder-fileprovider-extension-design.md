<!-- added: 2026-04-26T10:57:16Z -->
# mandroid_finder — FileProvider Extension Design

**Date:** 2026-04-26
**Status:** Accepted (auto-mode implementation in progress)
**Sibling project:** `~/src/mandroid_transfer/` (left untouched)

## Problem

`mandroid_transfer` already exposes Android device storage over `adb` inside its own SwiftUI window. The user wants the same content surfaced inside **Finder itself** — under the sidebar's **Locations** section, the way iCloud Drive, Google Drive, and Bonjour-advertised servers appear — so files are browsable, drag-droppable, Quick-Lookable, and Spotlightable from any Finder window without launching a custom app UI.

Open question: **Is this even possible on modern macOS without kernel extensions?** And if so, what's the right framework, what does distribution look like, and how do you handle device connect/disconnect cleanly?

## Root Cause / Why This Is Non-Trivial

Three things make "show Android in Finder" harder than it sounds:

1. **macOS no longer trusts kernel extensions.** Anything that mounts a custom filesystem the old way (kext-based FUSE) requires user-allowed system extensions and breaks across OS updates.
2. **Finder's sidebar Locations section is not user-extensible by drag-and-drop.** You cannot just register a custom URL there. It is populated by (a) volumes in `/Volumes`, (b) Bonjour-advertised servers, (c) cloud storage providers using the File Provider framework, and (d) a small set of other system-managed entries.
3. **Android over ADB is not a real filesystem.** It's a pull/push protocol over USB. Every list, read, and write costs a Process invocation. Anything that pretends it is a POSIX FS will be slow or wrong.

Existing approaches surveyed:

| Approach | Sidebar entry? | Verdict |
|---|---|---|
| `NSFileProviderReplicatedExtension` (File Provider framework, macOS 11+) | Yes — under Locations, identical to iCloud Drive / Google Drive | **Chosen.** |
| macFUSE + adbfs | Mounts under `/Volumes` (Devices), not Locations | Requires kext-style approval; fragile across macOS versions |
| jmtpfs (MTP via FUSE) | Same as above | Sidesteps ADB; doesn't fit the project |
| Bonjour-advertised SMB bridge to ADB | Yes (under Network) | Disproportionate complexity |

## Solution

Build a new sibling project, **`mandroid_finder`**, structured as:

```
MandroidFinder.app (host)
  ├─ Embeds:
  │    MandroidFileProvider.appex   ← NSFileProviderReplicatedExtension
  └─ Links: MandroidCore.framework  ← ADBService, models, parsers (shared)
```

**Lifecycle:**
- Host app launches → polls `adb devices` → for each connected device, calls `NSFileProviderManager.add(NSFileProviderDomain(identifier: <serial>, displayName: <model>))`.
- macOS spawns the extension on demand and routes Finder operations to it via `NSFileProviderReplicatedExtension` callbacks (`item(for:)`, `enumerator(for:)`, `fetchContents(for:)`, `createItem(...)`, `modifyItem(...)`, `deleteItem(...)`).
- Each domain auto-creates a folder at `~/Library/CloudStorage/Mandroid-<DeviceModel>/` and a Finder sidebar entry under **Locations**.
- On disconnect, host calls `NSFileProviderManager.remove(domain:)`; the sidebar entry disappears.
- On launch, host reconciles: remove orphaned domains for devices not currently connected.

**Domain identifier = device serial** (stable per physical device → no duplicate sidebar entries after replug).

**Extension boundaries:**
- Extension does *not* import the app target. Both link the shared `MandroidCore` framework.
- The host app resolves the `adb` binary path at launch and writes it to App Group `UserDefaults` (`group.com.danielkao.mandroidfinder`) so the sandboxed extension can find it.
- All Process invocations live inside `ADBService` so sandbox auditing is centralized.

**Build:** generated via XcodeGen from `project.yml` (Apple has no SwiftPM product type for `.appex`). `xcodegen generate` produces `MandroidFinder.xcodeproj`; `xcodebuild` drives the rest.

## Key Files

Created in `~/src/mandroid_finder/`:

- `project.yml` — XcodeGen spec defining App + Extension + Core targets, App Group entitlement, sandbox, embed-extension-in-app
- `App/MandroidFinderApp.swift` — SwiftUI host app entry, status window
- `App/Services/DomainController.swift` — `NSFileProviderManager.add/remove` driven by `DeviceManager` polling
- `App/Services/DeviceManager.swift` — `adb devices` polling loop, observable device list
- `App/Views/StatusWindow.swift` — minimal UI listing devices and registered domains
- `App/Resources/MandroidFinder.entitlements` — App Group, FileProvider client capability
- `Extension/FileProviderExtension.swift` — `NSFileProviderReplicatedExtension` subclass
- `Extension/FileProviderEnumerator.swift` — directory enumeration via `ADBService.list`
- `Extension/FileProviderItem.swift` — wraps `AndroidFile` as `NSFileProviderItem`
- `Extension/Operations/{FetchContents,CreateItem,DeleteItem,ModifyItem}.swift`
- `Extension/Resources/Info.plist` — `NSExtensionPointIdentifier=com.apple.fileprovider-nonui`, `NSExtensionFileProviderDocumentGroup=group.com.danielkao.mandroidfinder`
- `Extension/Resources/MandroidFileProvider.entitlements` — App Group + sandbox
- `Core/ADBService.swift` — actor wrapping `adb` Process calls (devices, ls, push, pull, mkdir, rm, shell)
- `Core/Models/AndroidFile.swift` — model + `ls -la` parser
- `Core/Models/DeviceInfo.swift`
- `Core/AppGroup.swift` — shared constants
- `Scripts/build.sh` — `xcodegen generate && xcodebuild ... build`
- `Scripts/release.sh` — sign + notarize (placeholders for `CODESIGN_IDENTITY`)
- `README.md`, `.gitignore`

## Important Constraints

1. **Code signing is non-negotiable.** File Provider extensions are not loaded from unsigned bundles outside the dev machine. Distribution requires Developer ID + notarization.
2. **App Sandbox required on both targets.** All Process calls must go through `ADBService`; the absolute `adb` path is read from the App Group container.
3. **Domain identifier must be stable.** Use the device serial from `adb devices`, not a transient index.
4. **Replicated extension caches files locally** under `~/Library/CloudStorage/...`. On-demand materialization keeps disk usage bounded; very large pulls will use disk until eviction.
5. **End-to-end verification needs a real device + signing identity** — cannot be automated. Build verification (compile + extension embed) can.

## Lessons Learned

- **Apple's modern answer to "third-party storage in Finder" is universally `FileProvider`.** Cloud-flavored naming (`CloudStorage`) is misleading — it works for any backing store, including a USB-connected device. Don't rule it out just because the docs talk about cloud sync.
- **SwiftPM (`Package.swift`) cannot describe an App Extension bundle.** Any project that needs a `.appex` must be assembled by Xcode/`xcodebuild`. XcodeGen is the cleanest CLI-friendly way to keep the project description in version control without hand-editing `.pbxproj`.
- **Identifier stability matters more than display name.** Using a transient identifier (like `adb devices` row index) creates duplicate sidebar entries every time the device replugs. Use the device serial.
- **Studied existing project (`mandroid_transfer`) before designing.** Its `ADBService` actor, `AndroidFile` parser, and `DeviceManager` polling are exactly the right shape — reimplementing the minimum surface in `MandroidCore` keeps the new project independent without re-inventing the protocol surface.
- **Surveyed alternatives are documented above so we don't re-litigate them.** macFUSE/adbfs and jmtpfs are real options and worth knowing exist, but they don't deliver the iCloud-style sidebar UX the user explicitly asked for, and they bring kext-approval friction.
