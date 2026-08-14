2026-08-14

# OhMyBias iOS：README 對齊現況＋改用 App Icon 做 logo

README 還停在專案抽出當天的樣子：特色只列輸入引擎五條，頁首掛著一隻蝦子
emoji（🦐，沿用 Yabomish 家族的梗）。但這幾天的 commit 已經把鍵盤介面整個
翻過一輪（以 Hamster 2 的 sweetlime 皮膚為藍本），README 讀起來像另一個
專案。這次 commit（`8772bde`）把它更新到現況。

## 做了什麼

**特色改為兩節。**「輸入引擎」保留原有五條（liu.cin on-device 編譯、萌典
聯想詞、字頻學習補註 iCloud 合併、`,,` 指令、極簡資料）；新增「鍵盤介面」
一節，從 commit log（`e11e00d` 起）整理出：滑動手勢（上滑符號／下滑數字、
n/m 次選、空白切中英與拖曳游標、Enter 上滑跳注音）、長按選單（大小寫變體、
多曆法日期時間插入）、工具列與面板（⚙ 設定入口、♥ 常用語、符號/Emoji/
顏文字分類面板）、五頁鍵盤、深色主題、`.cskin` 皮膚匯入、記住中英模式。

**Logo 改用 App Icon。**頁首置中放
`Resources/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png`（米字圖示，
`7494fdc` 加入），repo 相對路徑 GitHub 直接渲染，不用另放圖檔；蝦子 emoji
移除。

**其他順手對齊。**安裝步驟加第 4 步：`,,V` 剪貼簿指令需啟用「完整取用權限」
（`RequestsOpenAccess` 已改為請求此權限）；授權表加一列鍵盤版面／符號分類
來自 sweetlime.cskin（作者 Ryan）——只具名不附連結，因為原皮膚的發布網址
無法查證，不硬塞一個猜的 URL。
