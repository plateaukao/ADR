# mandroid_finder — Switch device detection from polling to `host:track-devices-l`

**Date:** 2026-04-26
**Status:** Implemented and shipped in commit `eb8e884` of `https://github.com/plateaukao/mandroid_finder`

## Problem

The first version of `mandroid_finder` polled `host:devices-l` every 2 seconds via a `Task` loop in `DeviceManager`. Plug/unplug events propagated to the Finder sidebar within "up to 2 s." Cheap with the native client (no subprocess spawns), but unnecessarily laggy and thematically out of place — every other Locations entry on macOS (iCloud Drive, Bonjour servers, USB drives) is event-driven.

## Root Cause

Polling was the simplest first cut. adb does provide an event-driven service — `host:track-devices` (and its long-format sibling `host:track-devices-l`) — that opens once and then pushes a fresh device list payload every time something changes. We just hadn't wired it up because we needed `ADBConnection` to exist first.

## Solution

Added `ADBClient.trackDevices()` returning an `AsyncThrowingStream<[DeviceInfo], Error>`:
- Opens one TCP connection to `127.0.0.1:5037`.
- Sends `host:track-devices-l` (the long-format variant — payload shape matches `host:devices-l`, so the existing `parseDevicesL` parses both).
- Reads the OKAY status, then loops `readHexLengthPayload` → `parseDevicesL` → `continuation.yield(...)`.
- Forwards any error (including the inevitable `short read` when `adb kill-server` slams the socket) to `continuation.finish(throwing:)` and closes the connection.
- Hooks `continuation.onTermination` to cancel the task when consumers drop their iterator.

Rewrote `DeviceManager` to consume the stream:
- One `trackingTask` runs an outer `while !Task.isCancelled` loop.
- Inside, `runStream()` does `for try await snapshot in ADBService.shared.trackDevices()` and updates `self.devices` on each yield.
- On stream error/close, clears devices, surfaces the error in the status window, falls out of `runStream`, sleeps 2 s, retries.
- Added `awaitFirstUpdate()`: a one-shot continuation that resolves on the first snapshot OR first failure, so app `bootstrap()` reconciles domains against the real device list rather than the empty placeholder.

The `host:track-devices-l` long-format choice mattered — short `host:track-devices` returns `serial<TAB>state`, which our space-splitting parser would have rejected. Caught it in the first smoke test (status said "connected" but device list was empty); one-line fix to add `-l`.

## Key Files

- `Core/ADBProtocol/ADBClient.swift` — added `trackDevices() -> AsyncThrowingStream<[DeviceInfo], Error>`
- `Core/ADBService.swift` — added `nonisolated func trackDevices() -> ...` wrapper exposing the stream from the actor
- `App/Services/DeviceManager.swift` — replaced poll loop with stream consumer + reconnect back-off + `awaitFirstUpdate()`
- `App/MandroidFinderApp.swift` — `await deviceManager.pollOnce()` → `await deviceManager.awaitFirstUpdate()`
- `README.md` — moved the bullet from "TODO" to "done" with auto-reconnect note

Net diff: +100 / −18 across five files.

## Lessons Learned

- **`host:track-devices` vs `host:track-devices-l` is a real gotcha.** The short variant uses `\t` between serial and state; the long variant uses spaces and tacks `usb:`/`product:`/`model:`/`device:`/`transport_id:` tokens onto the line. Our existing `parseDevicesL` splits on space, so the short variant returned no rows and we got a silent "connected but empty" UI. Symptom-to-cause time: about thirty seconds once the status said "connected" but devices was empty — a useful diagnostic split.
- **AsyncThrowingStream + onTermination is the right pattern for long-lived adb services.** Cancellation flows clean: `DeviceManager.stop()` cancels `trackingTask`, the consumer iterator stops, `onTermination` fires, the inner Task gets cancelled, `readExact` throws, `continuation.finish` closes — no leaks, no zombie connections.
- **`awaitFirstUpdate()` is a small but worth-it primitive.** Without it, `bootstrap()` would either (a) reconcile against an empty device list and remove every existing domain on every launch, or (b) skip the initial reconcile and leave stale domains around when a previously-connected device is gone. The continuation-based "wait for first event or first error" pattern handled both edge cases in three lines.
- **End-to-end latency** for plug-in → Finder sidebar entry appearing: dropped from "up to 2 s" to roughly the time it takes adb to USB-enumerate the device (a few hundred ms).
- **Reconnect-on-failure is a feature, not a bug.** `adb kill-server` followed by `adb start-server` cleanly cycles: domains disappear within ~1 s of the kill (our error handler clears `devices`, `.onChange` fires, reconcile removes domains), and reappear within ~3-5 s of the restart (back-off + reconnect + first stream yield). No app restart needed.
