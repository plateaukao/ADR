# mandroid_finder — Replace bundled `adb` binary with native Swift implementation of the adb wire protocol

**Date:** 2026-04-26
**Status:** Implemented and shipped in initial commit `1b62143` of `https://github.com/plateaukao/mandroid_finder`
**Supersedes:** the bundling decision from `mandroid_finder-fileprovider-extension-design.md`

## Problem

`mandroid_finder` currently ships an 18 MB copy of Google's `adb` binary inside the host app and the file-provider extension. Every `ls`, `pull`, `push`, `mkdir`, `rm`, `mv` call spawns the bundled binary as a subprocess, which then opens a TCP connection to the user's running adb server at `127.0.0.1:5037`.

This works, but it's heavy: the project ships a third-party signed binary that must be kept current with platform-tools releases, every directory listing pays a `posix_spawn` round-trip, and the bundle is dominated by a binary we don't actually need at its full size — we use roughly five percent of `adb`'s feature surface.

## Root Cause / Why we ended up bundling

`mandroid_finder`'s `MandroidFileProvider.appex` is an App Extension. macOS forces App Extensions to run sandboxed — ExtensionKit refuses to activate one without `com.apple.security.app-sandbox`. A sandboxed process cannot `exec` binaries that live outside its own bundle (it's a kernel-level `posix_spawn` policy, not a file-permission issue, so the read-only `temporary-exception` entitlement is irrelevant). The bundled-binary approach was the cheapest way to give the extension *something* it was allowed to run.

`mandroid_transfer` doesn't hit this wall because it's a regular app, not an extension — it can run unsandboxed and `Process()`-exec the user's system `adb` directly.

## Alternatives considered

| Option | Approach | Bundle Δ | Cost | Verdict |
|---|---|---|---|---|
| **A. Bundle `adb`** | Extension ships its own adb, execs it as a subprocess to talk to the user's daemon. | +18 MB | Trivial | **Current state.** Pragmatic for v1. |
| **B. XPC bridge** | Extension RPCs into a non-sandboxed host or helper that runs adb. | 0 MB | Moderate (XPC plumbing, lifecycle) | Cleaner than (A) but ships a host daemon that has to be alive when Finder calls. |
| **C. Native protocol client** | Implement adb wire protocol in Swift; speak it directly to `127.0.0.1:5037`. No subprocesses, no bundled binary. | 0 MB | High (~week) | **Chosen.** Best long-term ergonomics. |
| **D. Tiny native shim** | Bundle a small custom helper that speaks the protocol. | small +Δ | Same as (C) plus packaging | Worst-of-both-worlds. |

## Solution

Replace the `Process`-based `ADBService` with a pure-Swift implementation of the adb client wire protocol. The user's adb server (started by Android Studio, `adb` on PATH, etc.) listens on `tcp:127.0.0.1:5037`. We open a TCP connection, send framed commands, and parse responses.

The adb protocol surface we actually need is small:
- **`host:devices-l`** — list connected devices and models
- **`host:transport:<serial>`** then **`shell:<command>`** — run shell commands (`ls -la <path>/`, `mkdir -p <path>`, `rm -rf <path>`, `mv <a> <b>`)
- **`host:transport:<serial>`** then **`sync:`** — switch to file-transfer mode, which uses a small framed sub-protocol (`SEND`, `RECV`, `STAT`, `LIST`, `DATA`, `DONE`, `OKAY`) for `pull` and `push`

The protocol is plain bytes over TCP, well-documented in Android's source tree (`packages/modules/adb/protocol.txt`, `SERVICES.TXT`, `SYNC.TXT`). Frames are length-prefixed ASCII hex for the host service handshake, then either raw shell bytes (for `shell:`) or 8-byte command/length frames (for `sync:`).

After the swap:
- The extension's `Process` invocations disappear; the network entitlements (`network.client`) remain — that's our only privileged need.
- The bundled `adb` binary is removed from both `MandroidFinder.app/Contents/Resources/` and `MandroidFileProvider.appex/Contents/Resources/`.
- `Tools/adb`, `Scripts/fetch-adb.sh`, and the post-compile copy phases are deleted.
- Distributable size drops by ~36 MB (binary embedded in two places).
- One real new requirement we inherit: the user must have an adb server running locally (Android Studio's adb, `brew install --cask android-platform-tools`, etc.). Without one, we can't talk to USB devices. We detect this gracefully and surface a clear "no adb server reachable" state.

## Architecture

Four-layer stack inside a new `Core/ADBProtocol/` group. Above it, `Core/ADBService.swift` keeps its existing public API so call sites in `Extension/` and `App/` need no changes.

```
ADBService (existing public API: devices(), list(...), pull(...), push(...), mkdir(...), remove(...), rename(...))
    │
    ▼
ADBClient        ← high-level service dispatcher: connects, picks transport, runs shell/sync
    │
    ├── ADBShell  ← `shell:<cmd>` — read raw bytes until close, lossy-UTF-8 decode
    └── ADBSync   ← `sync:` sub-protocol: LIST / STAT / RECV / SEND / DONE
        │
        ▼
    ADBConnection ← `Network.framework` NWConnection + frame I/O (length-prefixed hex headers, 8-byte sync frames)
```

**Why these boundaries.** `ADBConnection` is a dumb byte pipe with one job: read N bytes / write N bytes / close. Everything above it deals in messages. `ADBClient` opens one connection per top-level call (connections are cheap, and the adb server expects one transport switch per connection — connection-per-call sidesteps reuse complexity). `ADBSync` and `ADBShell` are mutually exclusive operating modes after the transport switch.

**Concurrency.** `ADBService` stays an `actor` — calls serialize naturally. Each call grabs a fresh `NWConnection` on a private dispatch queue and uses `withCheckedThrowingContinuation` to bridge NWConnection's callback API into async/await.

## Key Files

### New
- `Core/ADBProtocol/ADBConnection.swift` (~120 lines) — wraps `NWConnection`, exposes `send` / `read(exactly:)` / `readUntilClose()` / `close()`.
- `Core/ADBProtocol/ADBClient.swift` (~150 lines) — host service handshake (`<4-hex-length><payload>`, `OKAY`/`FAIL`), `devices()`, `openTransport(serial:)`, `shell(serial:, command:)`.
- `Core/ADBProtocol/ADBSync.swift` (~280 lines) — sync sub-protocol: `enterSync`, `recv` (RECV → DATA frames → DONE), `send` (SEND + path,mode → DATA frames ≤ 64 KiB → DONE+mtime → OKAY), `stat`. Optional `list` (LIST → DENT records) for v2.

### Modified
- `Core/ADBService.swift` — re-implement every public method on top of `ADBClient` / `ADBSync`. `setPath(_)` becomes a no-op for source-compat. `ADBError` updates: drop `adbNotFound`, add `serverUnreachable`.
- `Core/ADBLocator.swift` — strip down to constants (host = `127.0.0.1`, port = `5037`) or delete entirely; callers in `App/MandroidFinderApp.swift` lose the path-resolution logic.
- `App/MandroidFinderApp.swift` — drop `adbPath` `@State`, simplify `bootstrap()`.
- `App/Views/StatusWindow.swift` — replace "ADB: <path>" row with "ADB server: connected / unreachable".
- `App/Services/DeviceManager.swift` — `lastError` surfaces `serverUnreachable` cleanly.
- `project.yml` — remove the two `postCompileScripts: [Embed adb]` blocks.
- `.gitignore` — drop the `Tools/adb` line.
- `README.md` — drop bundled-adb mentions; document that an adb server must be running.

### Deleted
- `Tools/adb` (binary, gitignored — just `rm`)
- `Tools/` directory once empty
- `Scripts/fetch-adb.sh`
- The `./Scripts/fetch-adb.sh` line in `Scripts/build.sh`

### Reused as-is
- `Core/Models/AndroidFile.swift` — `LSParser` is already battle-tested against the device's `ls -la` output. Keep it; route `list()` through `ADBClient.shell()` instead of through `Process`.
- `Core/Models/DeviceInfo.swift` — same struct + `displayName` / `uniqueDisplayName` logic. The new `ADBClient.devices()` builds the same struct from the framed `host:devices-l` payload.
- `Core/AppGroup.swift` — `ContainerLog` stays as the diagnostic sink during this work.
- The `network.client` entitlement already exists in both entitlements files. The `network.server` entitlement (originally added so bundled adb could fork a daemon) is no longer needed — drop it in cleanup.

## Implementation order

Branchable phases — each compiles and the build stays green between phases:

1. **Add `ADBConnection` + `ADBClient.devices()`.** Wire it into `ADBService.devices()` only. Old shell-based path stays for everything else. Build, smoke-test: `DeviceManager` should still see the device. **This proves the connection layer.**
2. **Add `ADBClient.shell()`.** Switch `list`, `mkdir`, `remove`, `rename` to use it. Build, click into Finder, verify enumeration. **This proves shell mode + the host transport switch.**
3. **Add `ADBSync` (RECV path)** and switch `pull()`. Drag a file from Finder location to Desktop; verify bytes match.
4. **Add `ADBSync` (SEND path)** and switch `push()`. Drag a file in; verify on-device.
5. **Cleanup pass.** Delete `ADBLocator`'s probe/locate code, delete `Tools/adb`, delete `Scripts/fetch-adb.sh`, remove `postCompileScripts` from `project.yml`, update `README.md`, simplify `App/MandroidFinderApp.swift` and `StatusWindow.swift`. Rebuild — bundle should now be ~36 MB lighter and contain no `adb`.

## Wire-protocol reference

**Host service handshake (every connection starts here):**
```
client → server:  4-byte ASCII hex length + UTF-8 service string
                  e.g., "000ehost:devices-l"
server → client:  "OKAY" or "FAIL" + 4-byte ASCII hex length + UTF-8 error
```

**`host:devices-l` response after OKAY:** 4-byte ASCII hex length + payload (newline-separated lines, e.g., `6DB5F8BF\tdevice product:GoColor7 model:GoColor7 …`).

**`host:transport:<serial>` response after OKAY:** nothing — connection is now a transport to that device.

**`shell:<command>` after transport switch:** server sends OKAY, then raw shell stdout/stderr bytes until the server closes the connection.

**`sync:` after transport switch:** server sends OKAY; the connection enters the sync sub-protocol with 8-byte frame headers:
```
4-byte ASCII command tag (LIST | STAT | RECV | SEND | DATA | DONE | OKAY | FAIL | DENT)
4-byte little-endian uint32: length OR mode OR mtime depending on command
[ optional payload ]
```

Sync ops we care about:
- **STAT**: `STAT` + len(path) + path → server: `STAT` + mode(4) + size(4) + mtime(4)
- **RECV**: `RECV` + len(path) + path → server: stream of `DATA` + len + bytes, terminated by `DONE`
- **SEND**: `SEND` + len("<path>,<mode>") + "<path>,<mode>" → client: `DATA` + len + bytes (max 64 KiB per frame), then `DONE` + mtime → server: `OKAY` or `FAIL` + len + msg
- **LIST** *(optional, for v2)*: `LIST` + len(dir) + dir → server: stream of `DENT` + mode(4) + size(4) + mtime(4) + len(name)(4) + name, terminated by `DONE`

**References:**
- adb protocol: https://android.googlesource.com/platform/packages/modules/adb/+/refs/heads/main/protocol.txt
- adb services: https://android.googlesource.com/platform/packages/modules/adb/+/refs/heads/main/SERVICES.TXT
- adb sync: https://android.googlesource.com/platform/packages/modules/adb/+/refs/heads/main/SYNC.TXT

## Verification

End-to-end test plan (run after phase 5):

1. **Build:** `./Scripts/build.sh` — expect BUILD SUCCEEDED, no "Embed adb" build phase.
2. **Bundle audit:**
   ```bash
   APP="$(find ~/Library/Developer/Xcode/DerivedData/MandroidFinder-*/Build/Products/Debug -name MandroidFinder.app)"
   find "$APP" -name adb   # → empty
   du -sh "$APP"           # → ~5 MB instead of ~40 MB
   ```
3. **Pre-flight:** confirm an adb server is running on the user's machine: `adb devices` from Terminal must show the device. (`brew install --cask android-platform-tools` if not.)
4. **Launch + sidebar:** open the app, confirm "ADB server: connected" in the status window, confirm Finder → Locations shows the device entry.
5. **Enumeration:** `ls ~/Library/CloudStorage/MandroidFinder-<model>/` returns real `/sdcard` contents (Books/, Download/, etc.).
6. **Subdirectory:** `ls .../MandroidFinder-<model>/Books` returns ebook filenames including non-ASCII (Chinese, Japanese).
7. **Pull:** drag a small file from the Mandroid location to Desktop; verify byte-for-byte match (`shasum`).
8. **Push:** drag a file from Desktop into the Mandroid location; verify on-device with `adb shell ls -la /sdcard/` from Terminal.
9. **Mkdir / delete / rename:** new folder via Finder, rename it, drop a file into it, delete the folder. Each step should round-trip to the device.
10. **Server-down case:** `adb kill-server`, then click into the Finder location. Status window should show "ADB server: unreachable" within ~2s; Finder should show an error rather than hanging.
11. **Replug:** unplug the device, status updates within one poll cycle; replug, sidebar entry reappears.

Each phase 1–4 above also has its own intermediate smoke test (mentioned inline). If a phase regresses earlier behavior, revert before continuing.

## Risks / things to watch

- **NWConnection ↔ async bridging.** Swift's `Network.framework` is callback-based. The bridge has to handle three corner cases cleanly: connection-not-ready (queue sends until ready), early server-close mid-frame (return what we have, surface error), and continuation double-resume (each callback fires exactly once into one continuation — guard with a flag).
- **Sync `SEND` chunking.** Frame max payload is 64 KiB. We need to chunk large files. Easy to get off-by-one on the trailing `DONE` (which carries mtime, not a length).
- **Path encoding inside `shell:`** stays exactly as `quoted(...)` does today (single-quote wrap, escape internal single quotes). No change.
- **Server not running.** The bundled adb used to silently start one if missing. We can't, since we have no binary. Surface a clear `ADBError.serverUnreachable` and let the UI tell the user to start adb.

## Lessons learned (after implementation)

- **Net code expansion was proportional to expectations.** ~550 lines of new Swift across `ADBConnection`/`ADBClient`/`ADBSync` replaced ~120 lines of `Process`-based code in the old `ADBService`. The 5× line cost buys: zero bundled binaries, zero subprocess spawns per call, full control of error semantics, and a 36 MB drop in distributable size.
- **NWConnection ↔ async bridging is the trickiest part.** Two pitfalls bit during testing: (1) `stateUpdateHandler` fires on every transition, so a naive `cont.resume()` in the `.ready` case will double-resume when followed by `.failed` or `.cancelled` — guard with a once-fired flag (the `AtomicFlag` class). (2) `connection.receive` can return `data == nil, isComplete == false, error == nil` in rare windows; treat it as EOF and resume the continuation rather than hanging.
- **The shell-mode pipeline survived unchanged.** Routing `list()`/`mkdir()`/`rm()`/`mv()` through `ADBClient.shell()` and the existing `LSParser` worked first try. The lossy UTF-8 fix from the bundled-binary phase carried over verbatim — `String(decoding: outData, as: UTF8.self)` on raw socket bytes behaves identically to the same call on subprocess stdout.
- **Sync sub-protocol asymmetry was the only real surprise.** RECV is symmetric: client sends `RECV+path`, server streams `DATA+len+bytes`, client reads `DONE` to terminate. SEND is asymmetric: client sends `SEND+path,mode`, then *client* streams `DATA` frames, then *client* sends `DONE+mtime` (the length slot carries mtime, not a payload size — easy off-by-one), then *server* answers `OKAY` (length 0) or `FAIL+len+msg`. Reading the SYNC.TXT spec carefully before writing SEND avoided a debugging session.
- **Network entitlement scope shrank.** Bundled adb needed `network.server` so it could fork its own daemon when none was running. The native client only needs `network.client` — we strictly connect outbound to `127.0.0.1:5037`. The reduced entitlement surface is a real security win.
- **App-bundle size: 1.2 MB after this change**, down from ~40 MB with bundled adb. End-to-end smoke test (device enumeration, subdirectory listing with non-ASCII filenames, file pull via Finder drag-out) passed on first run after the swap.
- **One ergonomic regression**: the bundled adb used to silently `start-server` if no daemon was running. We can't, since we have no binary. The status window now surfaces "ADB server: unreachable" with a hint to run `adb start-server`. Acceptable tradeoff; future work could shell out to a known PATH location to start it (re-introducing some of the sandbox/exec complexity, but only on a one-shot best-effort path).
- **Future work surfaced by this implementation**: replacing the 2-second `host:devices-l` poll with `host:track-devices` (a long-lived connection that streams device add/remove events) is now a small change — same `ADBConnection`, just don't close after the first response. Worth doing once we have a `URLSessionTask`-style cancellation primitive in place.
