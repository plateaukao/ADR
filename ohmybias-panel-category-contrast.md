2026-08-15

# OhMyBias 米：面板分類標籤與選中狀態的皮膚鏈回修正（Android + iOS）

使用者回報（Android，套新版蝦米輸入法皮膚、深色）：emoji 面板整體褪色、
分類欄選中的「表情」看不清。延續 [[ohmybias-android-palette-fallback-chain]] 的
同一類問題 — 皮膚缺 panel 專屬鍵時，鏈回的別名選錯了：

- 分類標籤原鏈 `textMain` — 但這張皮膚的 textMain 是**半透明鍵面字色**
  （#D1D1D165，40% alpha），疊在同樣半透明的面板底上就是灰底灰字。
  分類標籤是小型導覽文字，改鏈皮膚的高對比 `textSub`（此皮膚深色 #FFFFFF）。
- 選中分類原本「bg 鏈 textMain、文字用 panelLeftBg」— 兩個半透明灰互疊，
  幾乎隱形。改用皮膚**保證成對**的 `candidateSelectedBg`/`candidateSelectedText`
  （選中標示本來就是這對色的語意），新增 `panelCategorySelectedText` 主題鍵。
- 面板整體的灰色罩來自皮膚自己的 `panelRightBg`（40% alpha 淺灰）— 是皮膚設計，不動。

原則同前篇：**文字與底色必須出自同一套 palette 的相容對**；半透明色尤其不能
與內建常數混搭。內建預設值不變（未匯入皮膚行為不受影響）。

Android 版使用者實機驗證通過後，同步移植 iOS（KeyboardTheme +
CollectionPanelView 同構修改；host 測試 68 passed、simulator build 綠）。
