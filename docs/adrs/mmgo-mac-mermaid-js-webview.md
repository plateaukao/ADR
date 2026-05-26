# mmgo-mac: Replace mmgo Go library with bundled mermaid.js in WKWebView

Commit: `250034b` on branch `mermaid-js-webview`.

## Summary

The renderer changed from `libmmgo.dylib` (a Go port of mermaid via cgo) to
upstream `mermaid.js` v11 bundled as a SwiftPM resource and hosted in an
off-screen `WKWebView`. The `CMmgo` systemLibrary target, the dylib, the
`MermaidRenderer.swift` Swift-to-C bridge, and the `Frameworks/` directory
are gone. Also: history now replaces an item being edited instead of
stacking new entries on top of it.

## Approach

`Sources/MmgoMac/Resources/mermaid.html` is a tiny host page that loads
`mermaid.min.js` via a relative `<script src>` and exposes a global
`renderMermaid(source, theme)` returning the resulting SVG (or error) to
Swift through `window.webkit.messageHandlers.mermaid`.

A new `MermaidWebView` class (in `ContentView.swift`) owns the
`WKWebView`, the navigation delegate, and the script-message handler.
`render(source:theme:)` forwards work into the page via
`evaluateJavaScript`. A single-slot pending queue collapses bursts of
keystrokes: at most one render is in flight, and the latest desired
state is the only thing waiting. No time-based debounce — the
single-slot pattern alone keeps the JS side from piling up.

Two design constraints discovered during implementation:

- **mermaid.js leaks DOM nodes on parse error.** `mermaid.render()`
  appends a temporary `<div id="d{id}">` to `document.body` for layout
  measurement. On success it self-cleans; on a parse error it leaves
  the temp node behind, and that node contains mermaid's own
  "Syntax error in graph" SVG. Without intervention, repeated bad
  renders stack up multiple error views. The host page sweeps
  `body > [id^="d"]` before and after every render in a `finally`
  block.
- **SwiftPM resource bundle vs. `codesign --deep`.** `Bundle.module`
  searches multiple locations including the executable directory.
  Placing the SwiftPM-generated `MmgoMac_MmgoMac.bundle` in
  `Contents/MacOS/` next to the binary works at runtime but breaks
  signing — `codesign --deep` treats sub-bundles in `Contents/MacOS/`
  as malformed helper executables. The bundle goes in
  `Contents/Resources/`, which `Bundle.module` also searches.

History change: `ContentView` now tracks an `editingOriginal: String?`
representing the entry the user is iterating on. On save, that baseline
is removed before the new version is inserted, so the same diagram
across many keystrokes occupies one slot. Selecting a history item sets
the baseline; pasting clears it (the pasted text becomes a fresh entry
on first save); removing the baseline from history detaches it.

PNG snapshot path is unchanged: `WKWebView.takeSnapshot` now operates on
a webview whose contents *are* the rendered mermaid SVG, so the existing
Copy PNG / Save PNG buttons work without modification.

## Trade-offs

- **Render latency went up.** A C-call into Go took ~5–30 ms
  synchronously. mermaid.js in WKWebView is ~30–120 ms per render plus
  ~5–10 ms IPC, async. First render after launch adds a one-time
  ~150–300 ms parse cost for `mermaid.min.js`. Still well under the
  threshold where typing feels laggy on typical diagrams; large
  diagrams may benefit from a future time-based debounce.
- **Net size: ~−1 MB.** `libmmgo.dylib` was 4.2 MB; `mermaid.min.js` is
  3.2 MB. The `.app` bundle is now 3.7 MB total.
- **No more cgo / Go toolchain dependency.** The repo is now pure
  Swift + a vendored JS file. Updating mermaid is a single `curl`.
- **Feature parity with upstream mermaid.** mmgo's Go port lagged
  mainline mermaid; switching to the JS source means newer diagram
  types and theming options work without waiting for a backport.
- **CLI mode is not in scope.** mmgo had a CLI; this app does not. A
  headless mode is feasible (NSApplication with `.accessory`
  activation policy hosting an off-screen WKWebView), but each
  invocation pays a ~500 ms–1 s startup cost — fine for one-off use,
  painful in a shell loop. Deferred.

## Key Files

- `Sources/MmgoMac/ContentView.swift` — new `MermaidWebView`
  ObservableObject + `MermaidWebContainer` `NSViewRepresentable`, plus
  the history-replacement logic.
- `Sources/MmgoMac/Resources/mermaid.html` — host page with the orphan
  sweeper.
- `Sources/MmgoMac/Resources/mermaid.min.js` — mermaid v11 bundle
  (3.2 MB).
- `Package.swift` — drops the `CMmgo` target, declares the two
  resources on `MmgoMac`.
- `build.sh` — drops the dylib copy and rpath surgery; copies the
  SwiftPM resource bundle into `Contents/Resources/`.
- Removed: `Frameworks/libmmgo.dylib`, `Sources/CMmgo/`,
  `Sources/MmgoMac/MermaidRenderer.swift`.
