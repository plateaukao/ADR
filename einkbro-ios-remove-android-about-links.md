2026-07-18

# EinkBro iOS: remove Android-only About screen content

Commit `0ed3c5f` (einkbro-ios), part of preparing the first App Store Connect
release.

## What changed and why

The settings About screen was ported verbatim from the Android app, where it
serves the open-source distribution: links to the project site, GitHub
releases, Twitter, changelogs, contributors, and Medium articles, plus two
"update" actions that download release/snapshot APKs from GitHub. None of that
applies to the iOS build — APK downloads are meaningless on iOS, and the links
all describe the Android project. Shipping them to App Store review would be
confusing at best.

Removing all eight items left the About screen with nothing but dividers, so
the screen and its `SettingRoute.About` navigation route were deleted outright
(`AboutSettings.kt` removed). The 關於 EinkBro row in main settings stays —
it still shows the app version (`v0.1.0-ios`) — but tapping it is now a no-op:
`VersionSettingItem.destination` became nullable (default `null`) and both
render sites in `SettingComposeUi` only navigate when a destination is set.
The Manual link (user guide) is unaffected.

`ProgressActionSettingItem` and its renderer stay in the settings framework
even though the About screen was their last user; they're part of the ported
component set.

## Verification

Type-check passed and the change was driven in the simulator: tapping
關於 EinkBro leaves the settings screen untouched. One pitfall worth
recording: the first simulator run appeared to show the old navigation
behavior because a stale `EinkBro.app` from an earlier session (built at
19:03, sitting in `iosApp/build/DerivedData` instead of the fresh build's
`build/DerivedData`) had been installed. The freshly built binary — easily
identified because it says "Gen AI" instead of the older "GPT Settings" —
behaved correctly.
