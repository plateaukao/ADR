# Simplify Update Progress UI to Percentage Only

## Problem
The snapshot/release update flow showed verbose multi-phase progress text (downloading MB counts, extracting, installing, etc.) which cluttered the settings UI unnecessarily.

## Root Cause
The original implementation treated each phase (prepare, download, extract, install) as distinct UI states with descriptive text, when users only need to know overall completion progress.

## Solution
- Removed `progressText` from `ProgressState` and simplified `ProgressCallback` to accept only a `Float` progress value
- Replaced the multi-line progress section (text + percentage in a Row) with a single percentage `Text` label
- Stripped all descriptive strings from callback invocations in `HelperUnit` (`upgradeFromSnapshot`, `upgradeToLatestRelease`, `downloadFileWithProgress`, `extractApkAndInstallWithProgress`)
- Updated call sites in `SettingActivity` to match new single-parameter callback

## Key Files
- `app/src/main/java/info/plateaukao/einkbro/setting/SettingComposeData.kt` — `ProgressState`, `ProgressCallback`
- `app/src/main/java/info/plateaukao/einkbro/setting/SettingComposeUi.kt` — `ProgressActionSettingItemUi`
- `app/src/main/java/info/plateaukao/einkbro/unit/HelperUnit.kt` — download/extract/install functions
- `app/src/main/java/info/plateaukao/einkbro/activity/SettingActivity.kt` — call sites

## Lessons Learned
- The `ProgressCallback` interface and `ProgressState` data class are shared between snapshot and GitHub release update flows, so both were updated together.
