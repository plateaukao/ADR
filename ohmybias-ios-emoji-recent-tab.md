2026-08-15

# 表情面板「常用」分類移植到 iOS

## 這是什麼

把 Android 版的表情面板「常用」分類（最近使用的 emoji，見
`ohmybias-android-emoji-recent-tab.md`，含流程圖）一對一移植到 iOS。行為完全相同：
MRU 順序、去重、上限 40，存 `recent_emojis.txt`（App Group sharedDir）一行一個；
「常用」排在「表情」前、沒紀錄不顯示、只有表情面板會記錄。

方向比較特別：這個家族平常是 iOS `Shared/` 為準、Android 移植過去 — 這次反過來，
功能先在 Android 做好驗證，再回移 iOS。

## iOS 端的對應選擇

- **放 `OhMyBiasKeyboard/` 不放 `Shared/`**：與 Android 放 `keyboard/` 對稱 —
  這是鍵盤 UI 層功能，不進引擎層，`Shared/` ↔ `shared/` 的一對一映射不受影響。
  也因此不需動 `Tests/run_tests.sh`（只編 Shared/），邏輯已由 Android 版 JVM 測試覆蓋。
- **Xcode 16 folder-synced group**：檔案放進 `OhMyBiasKeyboard/` 目錄即入 target，
  不用改 pbxproj。
- **背景寫檔**：Android 的單執行緒 executor 對應 iOS 的 serial `DispatchQueue`
  （qos `.utility`）；`record()` 先改記憶體、寫檔丟 queue，點按路徑零 I/O。
- 寫檔用 `atomically: true` — 鍵盤 extension 可能隨時被系統終止，避免寫到一半的檔。

## 驗證

模擬器（iPhone 16）實測：點 emoji 上屏 → 重開表情面板出現「常用」、排第一且自動選中、
重複點按去重為單一項目。使用者於實機確認後 commit（`7c87198`），並部署至
Daniel iPhone 17 pro。
