2026-08-15

# OhMyBias 米 Android：模擬器全功能驗證完成

`ohmybias-android` 移植的收尾 commit — 在 Pixel_7_API_34 模擬器上把 PLAN.md 的驗證清單
全數走完（一律經**軟體鍵盤實際點擊**，不用 `adb input text` 抄捷徑），加上兩個小修正與
README。至此 iOS → Android 移植宣告完成。

## 驗證涵蓋

- **`,,` 指令全套**：`,,H` 說明上屏、`,,S`/`,,T` 模式切換、`,,TO` 同音字（日[ㄖˋ]→入馹）、
  `,,PYS` 拼音查碼（ba1→八巴吧…；Enter 退出 — 與 iOS 相同，逗號在拼音模式會進 buffer）、
  `,,PIN` 選字固定排序（乎手）、`,,UNPIN`、`,,RS` 字頻重置、`,,V` 剪貼簿貼上、`,,C` 模式顯示。
- **手勢**：字母鍵上滑符號/下滑數字、Enter 上滑進注音頁、`z`/`m` 下滑句首句尾、
  空白鍵水平拖曳移動游標、⌫ 長按連刪。
- **長按選單**：字母變音符氣泡（滑動選擇）、逗號日期選單（android.icu 曆法 → 2026/08/15）。
- **面板**：符號（51 分類）、Emoji、♥ 常用語（user_phrases.txt 內容、點選上屏）。
- **設定頁**：SAF 匯入 `.cin`（系統檔案選擇器 → 已編譯 13 個字碼 → 字表狀態更新）、
  SAF 匯入 `.cskin` 皮膚（蝦米輸入法皮膚套用/還原）、聯想開關即時生效、自訂詞優先聯想
  （臺灣好 → 打臺時「灣好」排第一）。
- **字頻學習**：連選次候選三次後排序前移，SQLite 持久跨 process 重啟；`,,RS` 還原。
- **深色模式**：`cmd uimode night yes` 後鍵盤重建為深色調色盤（黑鍵灰框、功能鍵反白）。

## 修正

**composing 標籤與候選區重疊**：iOS 版候選捲動區的起點是「composing 標籤右緣 + 8pt」的
約束；Android 初版用固定 64dp 邊距，`,,PIN` 這類長 composing（`PIN:hj → 乎`）會蓋到候選。
改為 `setComposing()` 時量測標籤寬度動態推移，行為與 iOS 對齊。

另外把驗證過程學到的操作竅門記進專案 CLAUDE.md：`force-stop` 後系統會把預設輸入法退回
Gboard，測試腳本要重新 `ime set`。

## 結果

兩個 commit（`044ba86` 移植主體、`dea9054` 驗證收尾），13 個 JVM 引擎測試綠，
模擬器驗證清單 16/16 項通過。iOS 與 Android 版引擎層一對一對應，之後上游（yabomish）
修正可雙向同步；`liu.bin`/`phrases.bin`/`freq.db` 檔案格式跨平台互通。
