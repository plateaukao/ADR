2026-08-16

# NerLan iOS: hide the Google Drive sync section ahead of App Review

## Why

Google Drive sync is the bridge to the Android build — favorites, AI
transcripts, handouts, listening stats and podcast subscriptions round-trip
through the hidden `appDataFolder`. Useful, and entirely optional.

It is also the app's only third-party login. App Review guideline 4.8 says an
app offering a third-party login service has to offer an equivalent
privacy-preserving option (in practice, Sign in with Apple) alongside it.
NerLan doesn't, and building an Apple-ID login path purely to satisfy a feature
that one person uses is a poor trade on a first submission. Losing a review
cycle to it would be worse.

So the section is hidden for this submission, not removed.

## How

One constant in `SettingsView`:

```swift
private static let showsGoogleDriveSync = false
```

and the section's call site becomes `if Self.showsGoogleDriveSync { driveSection }`.
Everything else is untouched — `driveSection` still compiles, `DriveSync` still
runs, `settings.syncToDrive` keeps whatever value it had, and an account that is
already signed in keeps syncing. Flipping the constant back to `true` restores
the feature exactly as it was, with no migration and nothing to re-authorise.

A constant rather than `#if DEBUG` because the two differ in an important way:
`#if DEBUG` would hide the section from *every* Release build, including the
local `build_release.sh` .ipa and the macOS DMG. This is a decision about what
Apple sees, not about build configuration, so it reads better as one grep-able
flag with the reasoning attached to it.

## What the reviewer's build actually contains

Hiding the UI is enough to remove the login surface, because nothing about
Google is declared anywhere else:

- The OAuth flow runs through `ASWebAuthenticationSession` with a
  reverse-client-ID callback scheme, which needs no `CFBundleURLTypes` entry.
  `Info.plist` registers only `nerlan`, for the widget deep links.
- With the section hidden there is no sign-in button, no account row, and no
  "同步到 Google Drive" toggle anywhere in the app.

The `DriveAuth`/`DriveSync` code is still linked into the binary. That isn't a
review concern on its own — unreachable code isn't a rejection reason — but it
is the reason this is a UI gate and not a claim that Google has been removed
from the app.

Verified on iPhone 16 / iOS 26.4: Settings now runs API 來源 → OpenAI 金鑰 →
模型 → 翻譯 → 串流快取 → iCloud 同步 → 清除所有 AI 內容 → 統計, with no Google
Drive section anywhere in the scroll.
