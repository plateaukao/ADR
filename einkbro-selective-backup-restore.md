# EinkBro: Selective Backup/Restore

## Problem
The backup/restore feature exported and imported all app data (databases + shared preferences) as a single blob. Users couldn't selectively backup or restore specific data categories like just GPT settings or just bookmarks.

## Root Cause
The original implementation simply zipped all files from the databases/ and shared_prefs/ directories without any categorization or manifest.

## Solution
Redesigned the backup format to be category-based with a manifest:

- **New ZIP format** with `_manifest.json` describing included categories
- **4 categories**: All Preferences, GPT Settings, Bookmarks, History
- **Export flow**: multi-choice dialog -> file picker -> selective backup
- **Import flow**: file picker -> read manifest -> multi-choice dialog (showing only available categories) -> selective restore
- **Legacy compatibility**: old backup ZIPs without manifest are detected and restored using the old code path
- **GPT Settings**: exported as JSON key-value pairs (21 SharedPreferences keys) rather than raw XML files, enabling cross-device GPT config transfer
- **Bookmarks/History**: exported as JSON arrays for portable, selective restore without touching the entire database

## Key Files
- `app/src/main/java/info/plateaukao/einkbro/unit/BackupUnit.kt` - BackupCategory enum, selective backup/restore, GPT settings export/import
- `app/src/main/java/info/plateaukao/einkbro/database/RecordDb.kt` - listAllHistory() and replaceAllHistory() for history export/import
- `app/src/main/java/info/plateaukao/einkbro/view/dialog/DialogManager.kt` - Multi-choice category selection dialogs
- `app/src/main/java/info/plateaukao/einkbro/activity/SettingActivity.kt` - Updated flow wiring
- `app/src/main/res/values/strings.xml` - New string resources

## Lessons Learned
- SharedPreferences in this app use `PreferenceManager.getDefaultSharedPreferences()` and are injected via Koin as a singleton
- The GPT voice option key uses a different naming convention (`K_GPT_VOICE_OPTION` vs `sp_*` pattern)
- History is stored in a legacy SQLite database (Ninja4.db via RecordDb), not in the Room database
- DialogManager uses `activity` not `context` for string resolution
