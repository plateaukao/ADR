2026-08-31

# OhMyBias Android：鍵盤排距改與鍵距相同（5dp）

## 改了什麼

`KeyboardView.onLayout` 原本排距（row spacing）8dp、鍵距（key spacing）5dp，鍵陣的上下縫
比左右縫寬。使用者要求「排距與鍵距一樣」— 改成同一個值 `keySpacing = dp(5f * gap)`，
`rowSpacing = keySpacing`。取 5dp 而不是 8dp：鍵寬不變，四排各長高約 2dp，鍵面看起來是
均勻的格子。

「按鍵間距」滑桿（`Prefs.keySpacingScale`）行為不變，仍一起縮放上下留白、排距與鍵距。
浮動鍵盤與貼底鍵盤共用同一段排版，兩者都套用。

## 附帶影響

鍵盤外觀編輯器網站 ohmybias-skin 的預覽幾何是對照 `KeyboardView.onLayout` 畫的
（`preview.js`），現在排距數值與 App 不同步 — 使用者沒點名，這次不動網站。
