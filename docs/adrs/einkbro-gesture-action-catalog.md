# EinkBro: Gesture bindings now cover all BrowserActions

## Problem
Gestures (multitouch, floating-button, touch-area click/long-press) could only be bound to the 23 entries in the `GestureType` enum. Meanwhile the command-pattern refactor had grown `BrowserAction` to ~60 variants, so most actions (TTS, reader mode, translation, AI, share, rotate, etc.) were unreachable from a gesture even though the plumbing was identical. The gesture picker was a flat list dialog that wouldn't scale to that many options.

## Root Cause
`GestureType` was a parallel enum that had to be hand-extended for every new action, and `GestureHandler` hard-coded a `when` mapping from `GestureType` → `BrowserAction`. The settings UI read `GestureType.entries.map { it.resId }` and used `ListSettingWithEnumItem<GestureType>`, which assumed one flat enum.

## Solution
1. **`BrowserActionCatalog`** — a new registry that groups gesture-bindable `BrowserAction`s into 13 categories (Navigation, Tabs, Content, View, Translation, TTS, Bookmarks, Search, Share, Touch, AI, Files, Dialogs & UI). Each entry has a `@StringRes` label; strings are reused from `ToolbarAction` / `MenuItemType` / `GestureType` where possible, with only 8 new labels added for actions that had no prior UI string. Parameterized actions are excluded except `ChatWithWeb()` with defaults — `ShowTranslation` already honours per-site translation config via `TwoPaneController`, so no new "translate with site config" action was needed.
2. **Pref storage switch** — `GestureTypePreference` replaced by `BrowserActionPreference`, which stores the `BrowserAction` subclass simple name. On first read, legacy `"01"…"23"` codes are mapped via `BrowserActionCatalog.migrateLegacyId` and rewritten in place, so existing user bindings survive the upgrade transparently.
3. **`GestureHandler` simplified** — it now just dispatches the already-typed `BrowserAction` (with a `Noop` short-circuit for "Nothing").
4. **New full-screen picker** — `GesturePickerScreen` (Compose) shows a sticky header with the currently selected action, a top-level "Nothing" clear option, and foldable category cards. Tapping writes via the slot's `KMutableProperty0<BrowserAction>` and pops back. Routed through the existing NavHost (`SettingRoute.GesturePicker`). A new `GestureActionSettingItem` + `GestureActionSettingItemUi` replaces `ListSettingWithEnumItem<GestureType>` in the 13 gesture rows of `SettingActivity.gestureSettingItems`.
5. **`BrowserAction.Noop`** — added as the sentinel for the "Nothing" binding; `BrowserActivity.dispatch` handles it as a no-op.

## Key Files
- `app/src/main/java/info/plateaukao/einkbro/browser/BrowserActionCatalog.kt` *(new)* — catalog, labels, legacy-code migration map
- `app/src/main/java/info/plateaukao/einkbro/browser/BrowserAction.kt` — added `Noop`
- `app/src/main/java/info/plateaukao/einkbro/preference/PreferenceDelegates.kt` — `BrowserActionPreference` replaces `GestureTypePreference`
- `app/src/main/java/info/plateaukao/einkbro/preference/TouchConfig.kt` — all 13 gesture slots now `BrowserAction`-typed
- `app/src/main/java/info/plateaukao/einkbro/view/handlers/GestureHandler.kt` — dispatch-only
- `app/src/main/java/info/plateaukao/einkbro/setting/GesturePickerScreen.kt` *(new)* — foldable-category picker + `GesturePickerState` holder
- `app/src/main/java/info/plateaukao/einkbro/setting/SettingComposeData.kt` / `SettingComposeUi.kt` — `GestureActionSettingItem` type + renderer
- `app/src/main/java/info/plateaukao/einkbro/activity/SettingActivity.kt` — gesture rows, `GesturePicker` nav route
- `app/src/main/res/values/strings.xml` — 13 category names + 8 new action labels
- `view/GuestureType.kt` — kept intact; now legacy-only, consumed solely by the migration map

## Lessons Learned
- **Check if the work is already done before designing around it.** I initially planned a new `TranslateWithSiteConfig` action until `TwoPaneController.showTranslation()` turned out to already resolve per-site mode via `ConfigManager.getTranslationMode(url)`. Five minutes of grepping saved a redundant abstraction — verify the existing command path before adding a variant.
- **Migration beats breakage when the on-disk format has to change.** Storing `BrowserAction::class.simpleName` would have silently reset every user's gesture bindings. Detecting the legacy two-char format (`firstOrNull()?.isDigit() == true`) and rewriting on read made the upgrade invisible — worth the ~20 lines of mapping code.
- **Parameterized commands need an explicit opt-in policy for gesture binding.** Of 10 `data class` variants in `BrowserAction`, only `ChatWithWeb()` survived — the rest either needed runtime context (clipboard text, current tab URL) or duplicated a parameterless sibling. The catalog explicitly lists entries, so ambiguous cases get decided at design time rather than leaking into the UI as nonsense options.
- **Don't force a new action type when the sentinel is cheaper.** `BrowserAction.Noop` (one line, one `dispatch` branch) cleanly represents "Nothing" without special-casing null throughout the pref layer, handler, and UI.
