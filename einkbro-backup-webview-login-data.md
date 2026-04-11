# EinkBro: Add WebView Login Data to Backup/Restore

## Problem
When users backup and restore EinkBro data, they lose all website login sessions (cookies, localStorage, IndexedDB). This forces them to re-login to every website after restoring a backup on a new device or after a reset.

## Root Cause
The backup system only included SharedPreferences, GPT settings, bookmarks, and history. The `app_webview/` directory — where Android WebView stores cookies, localStorage, and IndexedDB — was not part of the backup zip.

## Solution
Added a new `WEBVIEW_DATA` backup category that:
- Calls `CookieManager.flush()` before backup to persist in-memory cookies to disk
- Recursively zips the entire `app_webview/` directory (Cookies DB, LocalStorage, IndexedDB)
- On restore, recreates the directory structure and writes files back
- Defaults to unchecked in the backup dialog since the data can be large
- Works with both Uri-based and File-based restore paths

## Key Files
- `app/src/main/java/info/plateaukao/einkbro/unit/BackupUnit.kt` — backup/restore logic, new enum entry, `writeDirectoryToZip` helper
- `app/src/main/java/info/plateaukao/einkbro/view/dialog/DialogManager.kt` — default WEBVIEW_DATA to unchecked
- `app/src/main/res/values/strings.xml` — English string
- `app/src/main/res/values-zh-rTW/strings.xml` — Traditional Chinese string

## Lessons Learned
- Android WebView stores all session data under `app_webview/` in the app's data directory — cookies in a SQLite DB, localStorage/IndexedDB in LevelDB files.
- `CookieManager.flush()` must be called before backing up to ensure in-memory cookies are written to disk.
- The existing dialog framework auto-picks up new `BackupCategory` enum entries, so only a default-checked override was needed.
