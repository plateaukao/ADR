2026-08-17

# OhMyBias：「皮膚設計器」統一改稱「鍵盤外觀編輯器」

## 改了什麼、為什麼

皮膚設計網站（`plateaukao/ohmybias-skin`，GitHub Pages）連同 Android／iOS 兩個 App
裡指向它的文字，全部從「皮膚設計器」改稱「**鍵盤外觀編輯器**」。「皮膚」是工程圈的
慣用借詞，對一般使用者不如「鍵盤外觀」直白；改名讓設定頁按鈕、商店文案與網站標題
用同一個詞，使用者從 App 點過去看到的名稱前後一致。

一次改三個 repo，各自一個 commit：

- **ohmybias-skin**（`58a7ada`）：`index.html` 的 `<title>`、meta description、頁首
  `<h1>`；`README.md` 標題與內文（自稱改「本編輯器」）；`app.js`／`zip.js` 註解。
- **ohmybias-android**（`a220f5a`）：`MainActivity.kt` 設定頁按鈕文字、
  `CandidateBar.kt` 工具列 ID 註解、Play 商店 `full-description.txt` 與
  `release-notes/zh-TW/default.txt`。
- **ohmybias-ios**（`18fc6c1`）：`ContentView.swift` 設定頁連結文字
  「鍵盤外觀編輯器（網頁）」與註解。

## 刻意保留

skin repo README 提到本編輯器是 Ryan「蝦米輸入法皮膚設計器」的純化版 — 那是別人
工具的專有名稱，不隨之改動。另外「皮膚」一詞在指涉 `.cskin` 檔與匯入功能時
（「匯入皮膚（.cskin）」、「皮膚名稱」）維持原樣，這次只改「設計器」這個產品名。

## 驗證

Android `compileDebugKotlin` 通過、iOS `ContentView.swift` swiftc parse 無誤；
純字串與註解改動，無行為變化。網站推上 main 後 GitHub Pages 自動更新。
