# EinkBro: Apply Locale Change Without Restarting App

## Problem

When the user changed the app language/locale in Settings, the app required a full process restart (`exitProcess(0)` + relaunch). This destroyed all open WebView tabs, forcing every page to reload and losing in-page state (scroll position, form input, etc.).

## Root Cause

The locale was applied only through `attachBaseContext()`, which runs once during activity creation. The only way to re-trigger it was to recreate or restart the activity. The app used the heaviest option — killing the entire process via `restartApp()` — which destroyed all `BrowserContainer` WebView instances since they are owned by the `BrowserActivity` instance.

## Solution

**SettingActivity**: After the user picks a new locale, call `recreate()` on SettingActivity (so it re-renders with the new locale) instead of setting `config.restartChanged = true`.

**BrowserActivity**: Instead of `recreate()` (which would still destroy WebViews), use an in-place locale update:

1. Track `currentLocale` at activity creation.
2. In `onResume()`, detect if locale changed by comparing against `config.uiLocaleLanguage`.
3. Call `applyLocaleInPlace()` which:
   - Sets `Locale.setDefault()` with the new locale
   - Updates `resources.configuration` via `resources.updateConfiguration()` (deprecated but functional on all API levels)
   - Triggers Compose toolbar recomposition via `composeToolbarViewController.updateIcons()`, which causes `stringResource()` calls to re-evaluate with the new locale

This preserves all WebView instances — no page reloads, no lost state.

## Key Files

- `app/src/main/java/info/plateaukao/einkbro/activity/BrowserActivity.kt` — added `currentLocale` field, `applyLocaleInPlace()` method, and locale check in `onResume()`
- `app/src/main/java/info/plateaukao/einkbro/activity/SettingActivity.kt` — replaced `config.restartChanged = true` with `recreate()` for locale changes

## Lessons Learned

- `Activity.recreate()` is lighter than a full process restart but still destroys activity-owned objects like WebViews.
- `resources.updateConfiguration()` is deprecated but remains the practical way to update locale in-place without recreating an activity. The recommended replacement (`createConfigurationContext()`) creates a new context rather than updating the existing one.
- Compose's `stringResource()` reads from `LocalContext.current.resources`, so updating the activity's resources + triggering recomposition is sufficient to reflect the new locale in Compose UI.
- The `restartChanged` flag is shared by multiple settings (dark mode, nav position, database deletion) — locale was decoupled from it without affecting the others.
