2026-08-19

# OhMyBias iOS：移除 Debug 記錄功能

## 做什麼、為什麼

使用者問「設定裡的 Debug 記錄是幹嘛的？」— 答案是開發診斷用（把引擎載入/查表的訊息寫進 App Group 的 `debug.log`），一般使用完全用不到 — 隨即決定整個移除（iOS 與 Android 同步）。

移除也順帶消除一個潛在問題：這功能若曾被打開，`debug.log` 會持續累積（雖有 512KB 輪替），而只拿掉設定開關的「半移除」會更糟 — 已開啟的偏好值留在 UserDefaults 裡，記錄永遠寫、再也沒有 UI 能關。所以是全量移除，不是藏開關。

## 範圍

- 刪 `Shared/DebugLog.swift`（寫檔＋輪替機制）。
- 移除引擎各檔共 28 個 `DebugLog.log` 呼叫點（CINTable、InputEngine、FreqTracker、ZhuyinLookup、WikiCorpus、BigramSuggest、CINCompiler）。呼叫點多在 `catch` 內 — 移除後留下的空 `catch` 語意不變：debugMode 預設關閉時本來就等同吞掉錯誤。
- 移除 `Prefs.swift` 的 `debugMode` 偏好。
- 設定頁刪掉「進階」整區 — Debug 記錄是該區唯一項目。

裝置建置通過、83 個引擎測試全綠。舊裝置上既有的 `debug.log`/`debug.log.old` 不會主動清除，但已無任何程式再寫入。

Android 版同日在 `ohmybias-android` 以相同範圍移除（DebugLog.kt、呼叫點、`Prefs.debugMode`、設定頁「進階」區）。
