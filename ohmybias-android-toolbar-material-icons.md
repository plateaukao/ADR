2026-08-19

# OhMyBias Android：工具列圖示化 — Material Symbols 取代文字字樣

## 這個改動做什麼

候選列空閒時顯示的 sweetlime 工具列，原本按鈕都是文字字樣（「設」「複」「↶」「→」…），
只有語音輸入一顆用系統內建圖示。這次把可圖示化的按鈕全面換成 **Material Symbols
Outlined 24px** 向量圖示（Apache-2.0，fonts.google.com/icons），觀感與一般鍵盤
（Gboard 等）的工具列一致。

實測 release APK（minify + shrinkResources）成本：**873,842 → 884,238 bytes
（+10,396，約 +1.2%）** — 15 個 compiled vector drawable 壓縮後各 357–738 bytes
（共約 7.8 KB），resources.arsc +944、dex +256、其餘 zip entry 開銷。

## 圖示對應

| 按鈕 | 原字樣 | 圖示 |
|---|---|---|
| 設定 | 設 | settings |
| 收折鍵盤 | ∨ | keyboard_hide |
| 常用語 | ♥︎ | favorite |
| 符號面板 | 符 | emoji_symbols |
| Emoji | ☺︎ | mood |
| 數字鍵盤（9）／九宮格數字（29） | 123 | 123（兩者同圖示，使用者指定） |
| 全選／複製／剪下／貼上 | 全／複／剪／貼 | select_all / content_copy / content_cut / content_paste |
| 復原／重做 | ↶／↷ | undo / redo |
| 游標左移／右移 | ←／→ | chevron_left / chevron_right |
| 語音輸入 | （系統 ic_btn_speak_now） | mic（改用自帶圖示，風格統一） |

**依語意保留文字**的四顆：米/英（按鈕本身要顯示目前輸入模式，圖示做不到）、
簡（簡繁切換沒有比字更準的圖示）、顏（顏文字）、ㄅ（注音查碼 — ㄅ 就是最好的圖示）。

## 做法與設計取捨

- **SVG 轉 VectorDrawable**：Material Symbols 的 SVG viewBox 是
  0 -960 960 960（y 座標落在 -960..0），VectorDrawable 的 viewport 沒有原點
  偏移概念，所以用 group translateY=960 包住 path 平移進 0..960。
  轉換用 Python 腳本批次做，pathData 原封不動。
- **不引依賴、不用 icon font**：專案鐵律是零第三方執行期依賴，androidx 的
  material-icons artifact（Compose 取向、體積大）與整包 icon font（1–4 MB）都
  不考慮；直接把 15 個 XML vendor 進 res/drawable/ic_tb_*.xml 最小最省。
- **tint 沿用既有機制**：CandidateBar 本來就有 iconRes 分支（ImageView +
  imageTintList 跟著皮膚 toolbarColor），這次只是把各按鈕填上 iconRes，
  深色皮膚不用另外處理。
- **內縮 6dp 改 11dp**：ImageView 是 FIT_CENTER 撐滿 46dp 列高，舊值是為系統
  麥克風點陣圖調的；24dp 向量會被放大到 34dp、壓過旁邊 19sp 文字鍵。改 11dp
  讓圖示畫 24dp — Material Symbols 的 24dp 框內建 2-3dp 留白，光學高度約
  19dp，與文字鍵同級（模擬器實拍確認）。
- **123 與九宮格同圖示**：本來九宮格（ID 29）想用 dialpad（3x3 排列較貼），
  使用者明確指定 Material 的「123」圖示，且兩顆按鈕功能同為開數字頁、極少
  同時配置，統一用 123、刪掉 dialpad drawable。

## 插曲：commit 訊息被並行 session 搶走

工作樹上的圖示改動被另一個殘留的 Claude session 以過期訊息
（「refactor: 移除 Debug 記錄功能」— 其實 6116f0d 早就做完）commit 並推上
origin/main（98ff381）。內容完全正確、只有訊息張冠李戴；修訊息需要 amend 加
force-push，留待使用者自行決定是否改寫。
