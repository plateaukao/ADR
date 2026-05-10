# Extract BrowserConfig, TabConfig, UiConfig from ConfigManager

## Problem

ConfigManager was a 623-line god object directly owning ~56 SharedPreferences-backed properties spanning unrelated concerns (browser behavior, tab management, UI layout), plus domain-toggle methods, bookmark/epub helpers, and clear settings. Adding any new setting required touching this single file, and the lack of domain boundaries made it hard to reason about which settings belong together.

## Root Cause

A previous refactoring (commit 3149bbef) extracted AI, TTS, Translation, Touch, and Display configs into sub-configs and removed the forwarding delegate layer, but left the remaining ~56 properties directly on ConfigManager. These properties naturally fall into three domains (browser, tab, UI) but were never separated.

## Solution

Created three new sub-config classes following the established pattern (class takes `SharedPreferences`, owns constants in companion object):

- **BrowserConfig** (91 lines) -- 32 properties: JS, adblock, cookies, images, desktop mode, user agent, search engine, save data, video settings, etc.
- **TabConfig** (103 lines) -- 15 properties: save tabs, history mode, album info, tab close behavior, background loading, etc.
- **UiConfig** (131 lines) -- 18 properties: toolbar position/actions, FAB position, statusbar, menus, bookmark grid view, etc. Takes `Context` in addition to `SharedPreferences` for layout-dependent toolbar config.

ConfigManager reduced from 623 to 305 lines. Cross-cutting concerns (`isIncognitoMode` which touches both `browser.cookies` and `tab.saveHistoryMode`) remain on ConfigManager. All 34 consumer files updated from `config.xxx` to `config.browser.xxx` / `config.tab.xxx` / `config.ui.xxx`.

## Key Files

- `app/src/main/java/info/plateaukao/einkbro/preference/BrowserConfig.kt` (new)
- `app/src/main/java/info/plateaukao/einkbro/preference/TabConfig.kt` (new)
- `app/src/main/java/info/plateaukao/einkbro/preference/UiConfig.kt` (new)
- `app/src/main/java/info/plateaukao/einkbro/preference/ConfigManager.kt` (slimmed)
- 34 consumer files across activity/, browser/, view/, viewmodel/, unit/, database/, search/

## Lessons Learned

- Bulk property migration across 34 files is best done with a Python script using regex with negative lookahead (to avoid double-prefixing already-migrated properties like `config.display.xxx`).
- When constants move from `ConfigManager.K_*` to sub-config companions, files referencing those constants need new imports -- the compiler catches these immediately.
- `UiConfig` needed `Context` unlike other sub-configs because toolbar action defaults depend on screen layout (`ViewUnit.isWideLayout`/`isLandscape`). This is an acceptable deviation from the shared-prefs-only constructor pattern.
