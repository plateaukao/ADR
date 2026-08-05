2026-08-05

# EinkBro iOS: 1.2 build 6 to TestFlight

Build 5 went up on August 3rd, but the two features that landed right after it
— the toolbar that slides with the scroll offset, and the dual YouTube caption
overlay with native-fullscreen support — existed only in git. Build 6 puts
them on the 1.2 TestFlight train; the marketing version deliberately stays 1.2
(the train is still open, so only `CFBundleVersion` needed to rise, 5 → 6).

The recipe was the established one (headless `xcodebuild archive` +
`-exportArchive` with `destination: upload`, cloud signing via the Xcode
login), with two wrinkles worth recording:

- **The Xcode session auth had rotted.** Two days after a successful upload,
  `-exportArchive` failed with `Failed to Use Accounts` — the keychain items
  for the Apple ID were missing their `Xcode-Username`/`Xcode-Token` fields.
  The archive step itself had succeeded (cloud signing used cached
  provisioning), so after re-signing into Xcode (Settings → Accounts, with
  2FA) only the export step had to re-run — the ~30-minute Release archive
  (Kotlin/Native LTO dominates it) was not repeated.
- **`plutil -replace` strips plist comments.** Bumping `CFBundleVersion` with
  `plutil` silently deleted the XML comment explaining why
  `NSAllowsArbitraryLoadsInWebContent` is set. Restored by hand before
  committing; future bumps should edit the plist textually instead.

What testers get in build 6, over build 5:

- **Toolbar slides with the scroll** — the auto-hide toolbar tracks scroll
  offset Safari-style instead of vanishing in one frame, with rubber-band and
  page-bottom guards against feedback shake.
- **Dual YouTube captions** — second-language line drawn under the player's
  captions (alignment mirrored from the caption window), fed natively when
  the page's own fetch is CORS-blocked, and shown in AVKit fullscreen as
  "original + translation" through a WebVTT text track, the only rendering
  channel that exists there.

Commit `b9ddc7a`, tag `v1.2-6`. Feature narrative:
`einkbro-ios-dual-caption-overlay-fullscreen.md`.
