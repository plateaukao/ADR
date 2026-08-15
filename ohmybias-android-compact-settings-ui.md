2026-08-16

# ohmybias-android：設定頁緊湊化＋收折鍵字符修正

使用者三個回饋（commit `888a9ad`）：工具列收折鍵 ⌄ 不置中、設定頁每顆按鈕
佔滿整行太浪費、整體要更緊湊更 Android。

## 收折鍵：⌄（U+2304）→ ∨（U+2228）

U+2304 DOWN ARROWHEAD 的字形貼著字面上緣畫，放在 19dp 的工具列裡與
設/米/←/→ 相比明顯偏高。U+2228 LOGICAL OR 是數學運算子、以數學軸垂直
置中，與 ←/→（同為數學運算子）同基準。設計器網站的 Android 預覽字符
同步改掉（ohmybias-skin `256db04`）；iOS 端用 SF chevron.down 不受影響。

## 設定頁：為什麼原本一顆按鈕佔一整行

直向 `LinearLayout` 給子視圖的預設 LayoutParams 就是 `MATCH_PARENT` 寬，
Material `Button` 又自帶 88dp minWidth、大 minHeight 與內距 — 兩者疊加，
每個動作都是一顆滿版大按鈕。

## 改法（純平台 API，無新依賴）

- **緊湊 outlined 按鈕**：透明底、accent 60% 細框圓角、accent 文字、
  RippleDrawable 按壓回饋、40dp 高；`minWidth=0`、`stateListAnimator=null`
  壓掉 Material 預設的大尺寸與浮起動畫。第一版曾改成純文字 ripple 列，
  被打槍「看不出是按鈕」— 教訓：動作元件要保留按鈕外觀，只調密度。
- **FlowLayout 按鈕群**：一列多顆、放不下自動換行（做法同
  CollectionPanelView 的 FlowLayout）。啟用鍵盤兩顆一列、皮膚三顆一列，
  順便縮短長標籤（皮膚設計器／匯入 .cskin／還原內建）。
- **其他緊湊化**：分類標題改 accent 色小標（sans-serif-medium 13sp）、
  開關列 48dp、動態狀態列沒內容時整列隱藏（TextWatcher 切 visibility）、
  根內距 20→16dp。
- **路徑分隔符**：啟用鍵盤說明的 U+2192 → 夾在 CJK 之間細弱難看，
  依使用者選擇改 ▸（U+25B8，Apple 文件路徑慣用）。
  插曲：使用者訊息裡貼的「正確箭頭」傳到對話已被正規化成同一個 U+2192，
  無從分辨 — 最後用選項＋預覽讓使用者點選。

改造後整頁一屏可見至「輸入」區（原本只到「聯想」）；模擬器實測按鈕
可點、功能不變。
