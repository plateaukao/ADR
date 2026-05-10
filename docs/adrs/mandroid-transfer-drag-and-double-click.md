# Mandroid Transfer - Add drag-and-drop and double-click support

## Problem
File list items in Mandroid Transfer had no drag support (couldn't drag to Finder or sidebar Bookmarks) and no double-click to open/navigate. The `makeDragProvider` method existed but was never wired to the view, and the only way to open folders was via context menu or Return key.

## Root Cause
1. Missing `.onDrag` modifier on file row views — the NSItemProvider creation logic existed but was never attached
2. Per-row `.contextMenu` + separate `.onKeyPress(.return)` didn't support double-click
3. NSItemProvider data gets stripped when dragging across SwiftUI view hierarchies (FileListView → SidebarView), causing `registeredTypeIdentifiers` to arrive empty at the drop handler

## Solution
1. Added `.onDrag` to each `FileRowView` in the List's ForEach, wiring up the existing `makeDragProvider(for:)` method
2. Replaced per-row `.contextMenu` and List-level `.contextMenu` + `.onKeyPress(.return)` with Apple's unified `contextMenu(forSelectionType:menu:primaryAction:)` API — handles single-click select, double-click open, right-click menus, and Return key in one modifier
3. Bypassed broken NSItemProvider cross-view serialization by storing dragged file paths in shared `AppState.draggedPaths` — sidebar reads directly from state on drop instead of deserializing from provider
4. Added visual "Drop to add bookmark" hint in sidebar when dragging over Bookmarks section

## Key Files
- `Sources/Views/FileListView.swift` — `.onDrag` modifier, `contextMenu(forSelectionType:...)`, drag path state sync
- `Sources/Views/SidebarView.swift` — Drop handler reads from AppState, visual drop hint
- `Sources/ViewModels/AppState.swift` — Added `draggedPaths: [String]` property

## Lessons Learned
- SwiftUI's `.onDrag`/`.onDrop` NSItemProvider serialization is unreliable across different view hierarchies — providers can arrive with empty type identifiers
- `contextMenu(forSelectionType:menu:primaryAction:)` (macOS 13+) is the correct way to handle selection + double-click + context menus in a List — using `onTapGesture(count: 2)` breaks List's built-in selection
- Shared state is a pragmatic workaround for broken drag-and-drop serialization in internal (same-app) drops
