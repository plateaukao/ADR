2026-08-19

# OhMyBias Android：移除 DebugLog 除錯記錄機制

## 做了什麼、為什麼

把 `shared/DebugLog.kt` 整個刪除，連同 `Prefs.debugMode` 偏好與設定頁的
「進階 › Debug 記錄」開關。DebugLog 是移植初期為了在無 adb 環境下抓引擎
問題而加的檔案記錄器（寫 `sharedDir/debug.log`，含 512KB 輪替），對應
iOS 版同名機制。除錯期已結束：

- 引擎層問題現在都能靠 JVM 單元測試（`testDebugUnitTest`）重現，不需要
  現場檔案記錄。
- 實機除錯有 adb logcat 可用，不再需要 app 自己落地 log 檔。
- 記錄點散在鍵擊路徑上（`selectCandidate`、`commitText`、同音字查詢等），
  雖然 lambda 延遲建構讓關閉時近乎零成本，但每個 catch 區塊都拖著一行
  記錄呼叫，徒增維護噪音。

## 怎麼改

- 刪 `DebugLog.kt`；`OhMyBiasApp` 不再綁 `DebugLog.isEnabled`。
- 各處 `catch (e: Exception) { DebugLog.log {...}; ... }` 改為靜默吞例外
  （`catch (_: Exception) {}`）或原有的 fallback 行為 — 行為不變，
  只是不記錄。
- `Prefs.debugMode` 與 `MainActivity` 的「進階」區塊一併移除（該區塊
  只剩這一個開關）。

12 檔、-89/+13 行。`testDebugUnitTest` 全綠。

註：iOS 版（ohmybias-ios）與上游 yabomish 仍保有各自的 DebugLog；
此為 Android 版單方面的精簡，不影響引擎層與 iOS `Shared/` 的一對一對應
（DebugLog 本來就不在對應清單的核心狀態機內）。
