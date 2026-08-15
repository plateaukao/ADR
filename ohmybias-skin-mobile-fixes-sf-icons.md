2026-08-16

# ohmybias-skin：手機版重疊/溢位修正＋iOS 工具列 SF Symbols 風圖示

使用者在手機上實測回報三個問題，兩個是版面 bug、一個是 iOS 擬真度不足。
（涵蓋 commits `41d939d`、`6e6badd`。）

## 壞在哪、為什麼、怎麼修

**1. 預覽區的「邊距」蓋到按鈕。** 手機版 sticky 預覽用
`box-shadow: 0 0 0 16px var(--paper)` 外擴環蓋住 main 左右 padding 的縫 —— 但
外擴環是四面外擴的：上緣削掉頂列按鈕的下緣、下緣在捲動時提早吃掉設定分頁
按鈕，看起來像有一圈看不見的邊距壓在按鈕上。改成**負邊距＋補回 padding**
（`margin: 0 -16px; padding: 4px 16px 8px`）——遮蓋範圍就是元素本身的盒子，
邊界乾淨，捲動內容剛好消失在元素下緣。

**2. 「100%」透明度標籤溢出面板。** `input[type=range]` 在 Chrome 有約 129px
的**內建最小寬**；`flex: 1` 的 basis 是 0 但 `min-width: auto` 讓它縮不下去，
把後面的百分比標籤硬推出 132px 的容器、再推出整個面板卡（實測
`rowScrollW 467 > rowW 434`）。修法一行：滑桿加 `min-width: 0`（配色 alpha、
邊框寬、字級三處滑桿都有同一雷）。教訓：這問題其實在第一輪 500px 截圖就露餡，
當時被當成「可接受的貼邊」放過 —— 視覺驗證看到貼邊就該量 `scrollWidth`。

**3. iOS 工具列圖示不像 SF Symbols。** 一開始用 unicode 近似字（⚙︎、{ }、⎘），
使用者指出 Ryan 設計器顯示的就是 SF Symbols 造型。查證：該設計器是 Gemini
Canvas app（sandbox iframe 拿不到 DOM），但從像素比對其圖示（heart.square、
number.square、chevron.down.circle…）是精確的 SF 外形 —— 網頁要做到這件事
只能用 SF Symbols **複刻集**（Apple 官方字型授權禁止內嵌網頁）。解法：vendor
MIT 授權的 **Framework7 Icons**（刻意仿 SF Symbols）中 7 個同名 SVG path 進
`icons.js`（gearshape/chevron.down/heart.fill/face.smiling/doc.on.clipboard/
arrow.left/right），`currentColor` 跟著 toolbarColor 變色，維持零依賴；
`curlybraces` 該集沒有，保留手繪。Android 平台維持 App 實際的文字字樣。

另有一個純視覺 commit（`615122e`）：移除按鈕鍵帽硬陰影，見
[ohmybias-skin-flat-buttons](ohmybias-skin-flat-buttons.md)。
