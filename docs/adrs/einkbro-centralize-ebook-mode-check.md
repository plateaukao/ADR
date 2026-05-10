# Refactor: Centralize Ebook Mode Active Check

## Problem

Multiple call sites checked `touchAreaType == TouchAreaType.Ebook && enableTouchTurn` independently. One site (context menu `isEbookMode`) only checked the type without `enableTouchTurn`, causing "Go to" to appear instead of "Copy Link" even when ebook pagination was disabled.

## Root Cause

No single source of truth for "is ebook touch pagination active." Each call site duplicated the two-condition check (or forgot the second condition), leading to inconsistent behavior.

## Solution

Added `ConfigManager.isEbookModeActive` computed property that encapsulates `touchAreaType == Ebook && enableTouchTurn`. Replaced all scattered inline checks with this property. Fixed the context menu `isEbookMode` parameter that was missing the `enableTouchTurn` guard.

Sites intentionally left checking only `touchAreaType == Ebook` (without `enableTouchTurn`):
- `TouchAreaViewController.toggleTouchPageTurn` / `maybeDisableTemporarily` / `updateTouchAreaType` — Ebook mode never uses overlay touch area views regardless of pagination state.
- `BrowserActivity` K_ENABLE_TOUCH handler — reacts to the toggle change itself, passes the toggle state to `toggleEbookTouchMode`.

## Key Files

- `app/src/main/java/info/plateaukao/einkbro/preference/ConfigManager.kt` — new `isEbookModeActive` property
- `app/src/main/java/info/plateaukao/einkbro/activity/BrowserActivity.kt` — 3 call sites updated
- `app/src/main/java/info/plateaukao/einkbro/browser/WebContentPostProcessor.kt` — 1 call site updated

## Lessons Learned

- When two conditions must always be checked together, wrap them in a named property to prevent partial checks at new call sites.
- Audit all usages of a mode flag when fixing one — the same bug pattern often exists in multiple places.
