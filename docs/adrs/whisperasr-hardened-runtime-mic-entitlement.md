# WhisperASR: Hardened Runtime Broke Microphone Recording

## Problem

Microphone recording in the release build silently produced no audio. The mic checkbox appeared to work (no errors shown), but captured audio contained no microphone input. The debug build via `swift run` worked perfectly, making the issue hard to reproduce during development.

## Root Cause

Commit `8013c73` (2026-03-23, "bump version to 0.1.1") added Developer ID code signing with `--options runtime` (hardened runtime) to `build_release.sh` for Apple notarization. However, it did not include an entitlements file granting `com.apple.security.device.audio-input`.

Hardened runtime silently blocks access to protected resources (microphone, camera, location, etc.) unless the corresponding entitlement is explicitly embedded during code signing. Without it, `AVAudioEngine` either fails silently or throws an error that the app's catch handler downgraded to a non-blocking warning ("Microphone unavailable, recording app audio only").

## Why It Wasn't Caught

- `swift run` executes the binary directly under Terminal.app's process, which inherits Terminal's own microphone permission — bypassing hardened runtime restrictions entirely.
- The microphone feature (`3e77de4`, 2026-03-16) was added before code signing was introduced, so it was never tested under hardened runtime.
- The app gracefully falls back to app-only audio when mic fails, so no crash or obvious error occurred.

## Solution

Added an entitlements plist with `com.apple.security.device.audio-input` to the codesign step in `build_release.sh`:

```bash
codesign --deep --force --options runtime \
    --entitlements "$ENTITLEMENTS" \
    --sign "$CODESIGN_IDENTITY" \
    "$APP_BUNDLE"
```

## Key Files

- `Scripts/build_release.sh` — added entitlements plist generation and `--entitlements` flag to codesign

## Lessons Learned

1. **Hardened runtime silently blocks protected resources.** Unlike sandboxing (which shows permission dialogs), hardened runtime just denies access. Every protected resource (mic, camera, USB, AppleEvents) needs an explicit entitlement.
2. **`swift run` masks permission issues.** Always test the actual `.app` bundle for permission-sensitive features, not the debug binary.
3. **When adding `--options runtime` to codesign, audit all system resource usage** (Info.plist usage descriptions) and create matching entitlements for each one.
