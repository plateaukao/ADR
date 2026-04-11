# EinkBro Architecture Refactoring

## Problem

BrowserActivity.kt had grown to 3,220 lines with 193 methods handling 14+ concerns (tabs, translation, TTS, downloads, AI, gestures, search, reader mode, etc.). ConfigManager.kt was 1,288 lines with 147+ properties imported by 47 files. Both were becoming difficult to maintain and extend.

## Root Cause

Organic growth without architectural boundaries. BrowserActivity implemented a monolithic BrowserController interface (50+ methods). ConfigManager stored every preference as a direct property alongside property delegates and enums.

## Solution

### Phase 1: BrowserActivity Decomposition (3220 → 2682 lines)
Extracted three delegate classes using a provider/callback pattern:

- **TranslationDelegate** (285 lines): 15 translation methods including translate, translateByParagraph, translateWebView, translateImage, configureTranslationLanguage
- **TabManager** (351 lines): 17 tab management methods including addAlbum, showAlbum, removeAlbum, gotoLeftTab/Right, updateSavedAlbumInfo
- **FileHandlingDelegate** (199 lines): 10 file handling methods including initLaunchers, showFileChooser, saveEpub, saveWebArchive, savePageForLater

Each delegate takes the FragmentActivity plus lambda providers for shared state, avoiding tight coupling. BrowserActivity retains thin forwarding methods for BrowserController interface compliance.

### Phase 2: ConfigManager Reorganization (1288 → 1135 lines)
- Extracted property delegates (BooleanPreference, IntPreference, StringPreference, GestureTypePreference) to PreferenceDelegates.kt
- Extracted 13 enums (TranslationMode, FontType, DarkMode, etc.) to PreferenceEnums.kt

## Key Files

- `app/.../activity/delegates/TranslationDelegate.kt` (new)
- `app/.../activity/delegates/TabManager.kt` (new)
- `app/.../activity/delegates/FileHandlingDelegate.kt` (new)
- `app/.../preference/PreferenceDelegates.kt` (new)
- `app/.../preference/PreferenceEnums.kt` (new)
- `app/.../activity/BrowserActivity.kt` (modified, -538 lines)
- `app/.../preference/ConfigManager.kt` (modified, -153 lines)

## Lessons Learned

- The provider/callback pattern (`webViewProvider: () -> EBWebView`) works well for breaking mutable state dependencies in Activity delegates
- Context menu / action mode methods were too tightly coupled to extract cleanly - they dispatch to 15+ other BrowserActivity methods
- ConfigManager sub-config extraction (e.g., AiConfig, TranslationConfig) was deferred because it requires updating 47 consumer files - better done as gradual migration with deprecation aliases
- Keeping backward-compatible forwarding methods in BrowserActivity preserves the BrowserController interface contract without requiring changes to existing handler classes
