2026-08-15

# OhMyBias 米 iOS：cskin 扁平 schema 與調色盤鏈回修正（自 Android 版移植）

Android 版在使用者的新版 `蝦米輸入法.cskin` 上抓到兩個皮膚問題並修正
（見 [[ohmybias-android-cskin-flat-schema]] 與 [[ohmybias-android-palette-fallback-chain]]）；
iOS 版有完全相同的程式碼路徑（SkinSettings 解析器與 KeyboardTheme.pal 皆源自同一設計），
同步移植：

1. **扁平 schema 支援**：`SkinSettings.apply` 同時接受新版扁平結構
   （`toolbarButtons`/`palette`/`groups`/`spaceKeyLayout` 在頂層、滑動長按開關為
   `enableSwipeUpActions` 等布林）與舊版巢狀區塊；新版鍵優先。
2. **調色盤別名鏈**：`KeyboardTheme.pal` 支援 key 鏈 — 皮膚缺 v2 鍵時先鏈回皮膚內
   相容色（`textSystem`→`textMain`、`systemBorder`→`border`、`toolbarBg`→`bg`、
   panel/bubble 鍵鏈回 `textMain`/`keySystem` 系），全缺才退內建預設 —
   避免「皮膚鍵底 + 內建字色」撞色（深色模式功能鍵標籤隱形）。`borderSize`
   改依深淺色取值。

兩邊實作保持逐行對應，之後上游修正可繼續雙向同步。測試加入扁平 schema 案例
（host 測試 68 passed；simulator build 綠）。
