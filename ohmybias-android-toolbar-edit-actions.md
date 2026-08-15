2026-08-15

# OhMyBias 米 Android：工具列編輯按鈕依原始定義實作、選單單行顯示

兩個使用者需求：(1) cskin 工具列的全選等編輯按鈕在 Android 上其實做得到，
應依原始定義實作，不要沿用 iOS 版的替代方案 — 使用者之後會換用其他 cskin，
按鈕表要完整；(2) 系統「選擇輸入法」對話框的條目應為單行「OhMyBias 米」，
不要兩行重複也不要（嘸蝦米）副標。

## 工具列編輯按鈕

按鈕 ID 的權威定義在 `~/src/sweetlime`（LIMEService 的 cskin 工具列原始 Android
實作，`SkinSettings.TB_*`）。iOS 版因鍵盤 extension 沒有對應 API 而把這些 ID 留白
（10 全選的位置甚至被替換成 ♥ 常用語）；Android 版全數補齊、照抄 sweetlime 的做法：

| ID | 動作 | Android 實作 |
|----|------|--------------|
| 4  | 簡繁切換 | 引擎繁中 ↔ 簡中模式切換（同 `,,T`/`,,S`，含 toast） |
| 10 | 全選 | `InputConnection.performContextMenuAction(android.R.id.selectAll)` |
| 11 | 複製 | 同上 `android.R.id.copy` |
| 12 | 剪下 | 同上 `android.R.id.cut` |
| 14 | 復原 | Ctrl+Z 鍵事件（`sendKeyEvent`，EditText 內建 undo manager 接手） |
| 15 | 重做 | Ctrl+Shift+Z 鍵事件 |
| 6  | 剪貼本 | 維持佔位 — Android 無剪貼簿歷史 API，sweetlime 亦略過 |

ID 10 原本的 ♥ 常用語替代取消（♥ 本來就有自己的 ID 5）。模擬器以自訂
`toolbarButtons` 皮膚實測整條鏈：全選 → 剪下（欄位清空）→ 貼上（還原）→
復原（再清空）→ 重做（再還原），與簡繁 toast 切換。

## 輸入法選單單行

系統 IME 選單原本顯示兩行重複的「OhMyBias 米（嘸蝦米）」— 因為 method.xml 宣告了
subtype 且其 label 與 service label 相同（Android 不會自動合併）。sweetlime 的做法
是**完全不宣告 subtype**（中英切換由鍵盤內部處理，不需要 per-subtype 語言），選單
就只顯示 service label 一行。照做，並把 `ime_name` 從「OhMyBias 米（嘸蝦米）」
改為「OhMyBias 米」。驗證：選單條目現為單行「OhMyBias 米」。
