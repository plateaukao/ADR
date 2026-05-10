<!-- added: 2026-05-10T05:16:46Z -->
# mmgo-mac — Initial SwiftUI App

## Problem

The `mmgo` Go module renders Mermaid diagrams to SVG without a browser
runtime, but it's CLI-only. Wanted a small native macOS GUI that lets
the user paste a Mermaid script from the clipboard and see the rendered
SVG live, ideally without spawning a subprocess per render.

## Root Cause

No shipping integration existed between `mmgo` and any GUI host. The
options were:

1. Bundle the `mmgo` CLI binary inside an app and shell out via `Process`
   (simple, but extra latency and bundle weight per invocation).
2. Build `mmgo` as a C-callable library (`-buildmode=c-shared`) and link
   it into the host process directly.

We picked (2) for in-process rendering and tighter integration.

## Solution

**Go side (`mmgo` repo):** added `cmd/mmgolib/main.go`, a cgo wrapper
exposing two symbols:

- `MmgoRenderSVG(source, theme, background, errOut) -> char*`
- `MmgoFree(char*)`

Built with:

```
CGO_CFLAGS="-mmacosx-version-min=13.0" \
CGO_LDFLAGS="-mmacosx-version-min=13.0 -Wl,-install_name,@rpath/libmmgo.dylib" \
go build -buildmode=c-shared -o build/libmmgo.dylib ./cmd/mmgolib
```

The `-install_name` rewrite was load-bearing — without it the dylib's
recorded path is the bare filename and the host's `LC_RPATH` is ignored
by dyld.

**Swift side (`mmgo-mac` repo):** SwiftPM project with two targets:

- `CMmgo` (systemLibrary) — wraps `libmmgo.h` via a `module.modulemap`
  with a `link "mmgo"` directive.
- `MmgoMac` (executableTarget) — SwiftUI app, depends on `CMmgo`, adds
  `-L$(MMGO_BUILD_DIR)` and an `@rpath` linker entry pointing at the
  same dir so `swift run` finds the dylib at launch.

The UI is a two-pane `HSplitView`: an `NSTextView`-backed editor with
regex syntax highlighting on the left, a `WKWebView` rendering the
SVG-in-HTML on the right. Re-renders on every edit, theme change, and
paste.

## Key Files

- `mmgo/cmd/mmgolib/main.go` — cgo entry points
- `mmgo-mac/Package.swift` — two-target SPM manifest with linker flags
- `mmgo-mac/Sources/CMmgo/{libmmgo.h,module.modulemap}` — C bridge
- `mmgo-mac/Sources/MmgoMac/MermaidRenderer.swift` — Swift wrapper that
  marshals `String` ↔ `char*` and frees the returned pointer
- `mmgo-mac/Sources/MmgoMac/MermaidEditor.swift` — `NSViewRepresentable`
  around `NSTextView`, applies attribute highlighting via `NSTextStorage`
  on every `textDidChange`
- `mmgo-mac/Sources/MmgoMac/ContentView.swift` — two-pane SwiftUI view
  with paste / theme / render controls

## Lessons Learned

- **`install_name` matters more than rpath.** A c-shared dylib's default
  install_name is the output filename, which makes dyld treat it as a
  leaf-name lookup and skip the host's rpath entries. Always set
  `-Wl,-install_name,@rpath/<name>.dylib` when building Go shared libs
  for embedding.
- **`-mmacosx-version-min` must go through `CGO_*` flags, not
  `MACOSX_DEPLOYMENT_TARGET`.** The Go toolchain on macOS doesn't honor
  the env var for cgo-link steps; without `CGO_LDFLAGS` the dylib gets
  pinned to the host SDK version (e.g. macOS 26) and the Swift linker
  warns about a min-version mismatch.
- **SwiftPM systemLibrary is the cleanest bridge for prebuilt dylibs.**
  No bridging header (SPM doesn't support them), no XCFramework
  packaging, and the `link "mmgo"` directive in the modulemap pairs
  with `-L` linker flags on the executable target to find the dylib at
  build time.
- **`TextEditor` can't do styled runs on macOS 13.** For syntax
  highlighting, fall back to `NSTextView` via `NSViewRepresentable`
  and apply attributes through `NSTextStorage` inside the
  `textDidChange` delegate. Attribute-only mutations don't recurse
  through `textDidChange`, so no debounce/guard needed.
