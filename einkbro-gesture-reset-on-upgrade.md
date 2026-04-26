# EinkBro: Gesture bindings silently reset to "Nothing" on upgrade

## Problem

Users upgrading EinkBro to a new version reported that *some* of their gesture
bindings (e.g. up-click → PageUp, down-click → PageDown, a multitouch swipe →
CloseTab) silently reverted to "Nothing" while others remained intact. The
reset was partial and inconsistent across installs.

## Root Cause

Two independent paths funneled bindings into `Noop` through
`BrowserActionCatalog.entryOf`, which returns `nothingEntry` for any id it
doesn't recognize.

1. **Obfuscated ids from intermediate snapshot builds.** Commit `d1e88ca9`
   (2026-04-14) switched gesture storage from the fixed `GestureType` string
   codes (`"01"`..`"23"`) to `BrowserAction::class.simpleName`. The R8
   `-keepnames` rule that stabilizes those simple names across release builds
   didn't land until `762d9729` (2026-04-15). Any release-flavored build
   installed in that window rewrote prefs from `"11"` → `"a"` (R8's obfuscated
   name for that build's `BrowserAction$PageUp`). A later build with different
   obfuscation — or with keepnames now stabilizing the name back to
   `"PageUp"` — reads `"a"`, finds nothing, and shows "Nothing".
2. **Catalog-trimmed ids.** Commit `a89084fe` removed
   `ToggleTouchPagination` (a duplicate of `ToggleTouchTurnPage`) and nine
   other entries from the catalog. `migrateLegacyId` for legacy
   `GestureType.TouchPagination` (`"18"`) still rewrote prefs to
   `"ToggleTouchPagination"`, which then wouldn't resolve.

In both cases the preference getter's only recovery path was to pass the
unresolved id through `entryOf`, get `nothingEntry`, and silently return
`Noop` — permanently losing the user's binding.

## Solution

Two surgical changes:

1. **Remap the known survivor.** In
   `BrowserActionCatalog.legacyGestureToActionId`, point
   `GestureType.TouchPagination` at `ToggleTouchTurnPage` so legacy "18"
   migrations land on a catalog entry that exists.
2. **Fall back to the declared default on unresolved ids.** In
   `BrowserActionPreference.getValue`, distinguish the explicit `"Noop"` id
   from *any other id that resolved to `nothingEntry`*. The latter is treated
   as corrupted — obfuscated garbage, a trimmed entry, or a renamed action —
   and we return the preference's declared `defaultValue` (e.g. `PageUp` for
   `upClickGesture`) and rewrite the pref so the migration happens exactly
   once.

Explicit `"Noop"` bindings still resolve to `Noop`, so a user who intentionally
set a gesture to "Nothing" keeps that choice.

## Key Files

- `app/src/main/java/info/plateaukao/einkbro/browser/BrowserActionCatalog.kt`
  — remap `GestureType.TouchPagination` → `ToggleTouchTurnPage` at line 175.
- `app/src/main/java/info/plateaukao/einkbro/preference/PreferenceDelegates.kt`
  — `BrowserActionPreference.getValue` now falls back to `defaultValue` when
  the effective id isn't `"Noop"` but still resolves to `nothingEntry`.
- `app/src/test/java/info/plateaukao/einkbro/browser/BrowserActionCatalogTest.kt`
  — new tests cover the `"18"` remap and `entryOf("ToggleTouchPagination")`
  returning `nothingEntry`.

Prior related fix: `762d9729` added the `-keepnames class BrowserAction$* { }`
rule in `app/proguard-rules.txt`. The release R8 mapping confirms
`BrowserAction$PageUp`, `$PageDown`, `$RemoveAlbum`, `$Noop`, etc. are no
longer renamed, so future stored ids are stable.

## Lessons Learned

- **`::class.simpleName` is not a stable persistence key under R8.** Even
  with a `-keepnames` rule pinned today, any historical snapshot that ran
  without it can write garbage into user prefs that no future build can
  recover. For identifiers that outlive a single install, declare an
  explicit stable string alongside the type rather than reflecting on the
  class name.
- **When you delete from a catalog that also serves as a migration target,
  follow the references.** Trimming the catalog is fine; remapping
  `migrateLegacyId` to point legacy codes at surviving actions is what keeps
  older installs from silently losing bindings.
- **`entryOf` returning a sentinel on miss is a quiet data-loss vector.**
  Lookup-or-default is fine for rendering, but preference migration needs
  to distinguish "the user said Noop" from "we can't resolve this id" —
  otherwise every unrecognized value decays into Noop over time.
