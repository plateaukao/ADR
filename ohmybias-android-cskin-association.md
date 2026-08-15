2026-08-16

# ohmybias-android：皮膚設計器連結＋.cskin 檔案關聯

皮膚設計器網站（ohmybias-skin）上線後補齊兩段路：App 內一鍵到設計器、
檔案管理員點 `.cskin` 直接回 App 套用。（commit `7e0c399`）

- 皮膚區新增「皮膚設計器（網頁）」按鈕，放在「匯入皮膚」上方 —
  設計 → 匯出 → 匯入的自然順序。
- `MainActivity` 加 VIEW intent-filter：`file`＋`content` scheme、
  `mimeType */*`、`pathPattern` 比對 `.cskin` 結尾（多組 pattern 是
  PatternMatcher 對檔名含多個「.」的既知繞法；`host="*"` 是 pathPattern
  生效的前提）。原匯入邏輯拆成 `readSkinSettingsJson()`／`applySkinJson()`：
  SAF 選檔維持直接套用（選檔已表達意圖），VIEW intent 進來**先解出
  skinInfo.name 跳 AlertDialog 確認**再套用 — 點檔案不等於同意換皮膚。
- 實測抓到的坑：設定頁已在最上層時，standard launchMode 會把再次投遞的
  VIEW intent 靜默丟掉（`am start` 警告 delivered to top-most instance、
  無任何反應）。改 `singleTop`＋`onNewIntent()`，冷啟與前景兩條路徑都會跳框。

模擬器驗證：Files app 實點 `omb.cskin` → chooser 列出「OhMyBias 米」→
確認框「要套用皮膚「omb」嗎？」→ 取消不變、套用後「目前皮膚：omb」；
設定頁前景時（onNewIntent 路徑）亦同；驗畢以同一流程還原原皮膚。
