2026-08-19

# ohmybias-skin：Android 工具列同步 Material 圖示、網站改用 App 本尊 logo

## 這個改動做什麼

App 端（ohmybias-android `98ff381`，詳見 ADR
ohmybias-android-toolbar-material-icons）把工具列文字字樣換成 Material Symbols
Outlined 圖示後，鍵盤外觀編輯器網站的 Android 預覽與按鈕選單跟著同步 —
這正是當初立下的規矩：App 改 palette/字級/工具列鍵，`data.js` 要跟著動。

順手把網站的 favicon 與頁首 logo 從「米」文字佔位 SVG 換成 **App 本尊圖示**
（Play listing 512px 縮成 192px 的 `app-icon.png`，8.9 KB）。

## 做法

- **icons.js**：既有 `SF_ICONS`（iOS 用 SF Symbols 風）旁新增 `MATERIAL_ICONS`
  — 15 個 Material Symbols Outlined 24px inline SVG（Apache-2.0，
  viewBox `0 -960 960 960` 原樣內嵌，SVG 支援負原點不需像 VectorDrawable
  另外平移），名稱對應 App 的 `res/drawable/ic_tb_*.xml`。`glyphNode()` 查完
  SF 再查 Material，兩個 map 各自為政、單一漏斗不動呼叫端。
- **data.js**：`TOOLBAR_ITEMS` android 欄由文字改 `{ icon }`；米/英、簡、顏、ㄅ
  依語意保留文字（與 App 相同判斷）。手繪仿 `ic_btn_speak_now` 的 mic 刪除，
  換 Material mic（App 也換了）。
- **尺寸對齊**：Material 24dp 框內建留白，網站以 `.m-icon { 1.26em }`
  （= 24/19）放大，對齊 App 端「46dp 列高內縮 11dp」的光學比例，
  跟 19 單位文字鍵同級。
- **logo**：`index.html` favicon（原 data-URI SVG）與 `.brand-cap`（原文字
  span）都改 `app-icon.png`；CSS 圓角 12px 比照 Android 主畫面遮罩。

headless Chrome 實測：預覽工具列十格與選單全數正確渲染，iOS 模式不受影響
（SF 圖示未動，mic 在 iOS 本來就是 null）。
