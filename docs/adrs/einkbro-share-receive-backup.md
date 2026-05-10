# EinkBro: Share/Receive App Data over Local Network

## Problem
Users wanted to transfer app data (settings, bookmarks, history) between devices without manually exporting to a file and copying it over.

## Root Cause
The existing backup/restore only supported file-based export/import via the system file picker. There was no direct device-to-device transfer mechanism for backup data.

## Solution
Added "Share app data" and "Receive app data" options that reuse the existing UDP multicast discovery mechanism (same as "Send link"/"Receive link") but transfer binary ZIP files over TCP:

1. **Sender**: Creates backup ZIP in temp cache dir, starts a TCP ServerSocket on a random port, broadcasts `einkbro-backup:<ip>:<port>` via UDP multicast (same 239.10.10.100:54545 group), serves the file to the first TCP client
2. **Receiver**: Listens for multicast, parses the backup prefix message, connects via TCP to download the ZIP, then shows the category selection dialog before restoring

Also added GPT Settings gray-out logic: when "All Preferences" is checked in the backup/restore category dialog, "GPT Settings" is automatically disabled (grayed out at 50% alpha) since it's already contained within all preferences. Clicks on the disabled item are reverted.

## Key Files
- `app/src/main/java/info/plateaukao/einkbro/unit/ShareUtil.kt` - `startServingFile()`, `startReceivingFile()`, `getLocalIpAddress()`
- `app/src/main/java/info/plateaukao/einkbro/unit/BackupUnit.kt` - `backupToTempFile()`, File-based overloads for `getAvailableCategories()` and `restoreBackupData()`
- `app/src/main/java/info/plateaukao/einkbro/activity/SettingActivity.kt` - `shareAppData()`, `receiveAppData()`
- `app/src/main/java/info/plateaukao/einkbro/view/dialog/DialogManager.kt` - Refactored `showCategoryDialog()` with GPT disable logic

## Lessons Learned
- Android emulators each run on isolated 10.0.2.x virtual networks; UDP multicast between two emulators does not work. Must test on physical devices on the same WiFi.
- `AlertDialog.listView.getChildAt(index)` works for disabling items but only after the dialog is shown (use `setOnShowListener`).
- The existing ShareUtil uses UDP multicast for small text (URLs); for binary file transfer, a TCP server + multicast address announcement pattern works well.
