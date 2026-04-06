# Mandroid Transfer: macOS Finder-like File Browser for Android Devices

## Problem
There was no convenient way to browse and transfer files between a Mac and Android devices. Existing options (Android File Transfer, adb shell) are either buggy/unmaintained or require command-line knowledge. A native macOS app with Finder-like UX for ADB file operations was needed.

## Root Cause
Apple dropped Android File Transfer support long ago, and no maintained open-source macOS-native alternative existed that provided a Finder-like drag-and-drop experience backed by ADB.

## Solution
Built a native SwiftUI macOS app (macOS 14+, Swift 6) that wraps the ADB CLI to provide full file browsing and transfer capabilities:

### Architecture
- **MVVM** with `@Observable` ViewModels + `actor`-isolated services for Swift 6 strict concurrency
- **ADBService** (actor): wraps `Foundation.Process` to execute `adb devices`, `adb shell ls -la`, `adb pull`, `adb push`, `adb shell rm/mkdir`. Parses `ls -la` output via regex, streams stderr for transfer progress
- **DeviceManager**: polls `adb devices` every 3s, auto-selects first online device, handles disconnects
- **DirectoryCache** (actor): in-memory cache keyed by `(deviceSerial, path)` with 5-min TTL, invalidated on push/delete/mkdir/refresh
- **TransferManager**: orchestrates push/pull with progress tracking, manages active/completed task lists
- **AppState**: central `@Observable` state — navigation history (back/forward), sorting, bookmarks, file operations

### UI
- `NavigationSplitView`: sidebar (device dropdown + draggable bookmarks) | detail (file list with breadcrumbs)
- File list with multi-selection, context menus (Pull to Mac, Push File Here, New Folder, Delete), double-click navigation
- Transfer status bar at bottom with per-file progress
- Keyboard shortcuts: Cmd+R (refresh), Cmd+[/] (back/forward), Cmd+Up (parent), Cmd+Shift+. (hidden files), Delete key

### Drag and Drop
- **Finder → App (push)**: `.onDrop(of: [.fileURL])` on file list, extracts URLs and calls `pushFile()`
- **App → Finder (pull)**: `.draggable(DragItem)` with `FileRepresentation` that lazily pulls to temp dir on drop
- **File list → Sidebar (bookmark)**: `DragItem` also exports `utf8PlainText` (the path); sidebar accepts text drops to create custom bookmarks
- Custom bookmarks persisted to UserDefaults, removable via context menu, reorderable

### Key Technical Decisions
| Decision | Choice | Rationale |
|----------|--------|-----------|
| ADB integration | CLI via `Process` | No Swift ADB library exists; CLI is reliable |
| Concurrency | `actor` for services, `@Observable` for VMs | Swift 6 strict concurrency compliance |
| Cache | In-memory actor with TTL | Simple, fast, no persistence needed |
| Drag-out | `DragItem` with dual `TransferRepresentation` | Text path for internal use, file export for Finder |
| Project type | SPM executable | Simple setup; `open Package.swift` for Xcode |

## Key Files
- `Sources/Services/ADBService.swift` — actor wrapping all ADB CLI interactions, `ls -la` parser, streaming progress for pull/push
- `Sources/ViewModels/AppState.swift` — central state: navigation, sorting, bookmarks, file ops
- `Sources/Views/FileListView.swift` — main file browser: list, breadcrumbs, context menus, drag-and-drop both directions
- `Sources/Services/TransferManager.swift` — push/pull orchestration with progress tracking
- `Sources/Services/DirectoryCache.swift` — in-memory cache with TTL for fast navigation
- `Sources/Views/SidebarView.swift` — device picker, bookmarks with drag-to-add support
- `Sources/Models/DragItem.swift` — `Transferable` with dual representation (text + file)
- `Sources/Models/Bookmark.swift` — bookmark model with built-in defaults + UserDefaults persistence

## Feature Spec Plan

### Phase 1 — Foundation
Package.swift (SPM executable, macOS 14+), data models (`AndroidFile`, `DeviceInfo`, `TransferTask`), `ADBService` actor with device listing, shell commands, pull/push with streaming progress, `ls -la` output parser.

### Phase 2 — Device Management + Browsing
`DeviceManager` polling every 3s with auto-selection. `DirectoryCache` actor with 5-min TTL. `AppState` with navigation history. Views: `NavigationSplitView` with sidebar (device picker + bookmarks) and file list (multi-select, breadcrumbs, toolbar).

### Phase 3 — File Transfers
`TransferManager` with active/completed task tracking, ADB stderr progress parsing. `TransferStatusView` bottom bar. Context menus: Pull to Mac (NSSavePanel), Push File Here (NSOpenPanel), Delete, New Folder.

### Phase 4 — Drag and Drop
Drag-in from Finder via `.onDrop(of: [.fileURL])`. Drag-out to Finder via `.draggable(DragItem)` with lazy `FileRepresentation`. Drag folders to sidebar to create bookmarks via `utf8PlainText` representation.

### Phase 5 — Polish
Menu bar commands with keyboard shortcuts (Go menu, View menu). Hidden files toggle. Sort by name/size/date. Error alerts. Empty states (no device, empty directory). Delete confirmation dialog. New folder alert.

## Lessons Learned
- Swift 6 strict concurrency requires `@unchecked Sendable` on classes that use `NSLock` for internal synchronization (the compiler can't verify lock-based safety).
- `@Observable` class `deinit` can't access `@MainActor`-isolated properties; use explicit `stopPolling()` instead of relying on `deinit` for task cancellation.
- SwiftUI type checker chokes on complex `body` expressions with ternary operators in view modifiers; extracting sub-views and helper functions resolves this.
- `DragItem` with multiple `TransferRepresentation` entries (text + file) enables dual-purpose drag: lightweight internal drops (bookmarks) and heavyweight Finder exports (actual file pull).
- ADB writes transfer progress to stderr, not stdout. The `readabilityHandler` on the stderr pipe captures incremental updates.
