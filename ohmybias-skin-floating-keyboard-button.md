2026-08-31

# ohmybias-skin：Android 工具列新增 33「浮動鍵盤」

## 改了什麼

App 端（ohmybias-android `f5f255a`／`22daee8`）新增工具列按鈕 ID 33「浮動鍵盤」後，
鍵盤外觀編輯器網站的按鈕表沒有這顆，匯出的 `.cskin` 排不進它。這次補齊：

- `data.js` `TOOLBAR_ITEMS` 加 `{ id: 33, label: '浮動鍵盤', android: { icon: 'picture_in_picture_alt' }, ios: null }`
  — iOS 為 null，切到 iOS 平台時選單自動不列（既有的 `it[state.platform] === null` 過濾）；
- `icons.js` `MATERIAL_ICONS` 加 `picture_in_picture_alt` 的 SVG（同 App 的
  `ic_tb_pip.xml`；App 浮動中會換成 dock_to_bottom，網站只需顯示未浮動的那顆）；
- 註解裡「需與 App 端 CandidateBar 同步」改指向 `ToolbarItems` — App 端按鈕表已抽出成該物件。

`DEFAULT_TOOLBAR` 不動：內建預設工具列沒有放浮動鍵，要用的人自己排進去。

## 驗證

本機 `python3 -m http.server` 起站，headless Chrome 截圖：Android 平台的工具列面板最後一格
出現「浮動鍵盤」與 picture-in-picture 圖示。
