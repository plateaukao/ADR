2026-08-15

# OhMyBias 米 Android：鍵盤高度滑桿

使用者回饋：大螢幕手機上鍵面太小。原因是鍵盤本體高度固定 224dp（直向）/180dp（橫向）—
dp 與密度無關，螢幕越大鍵盤相對越小。

## 設計

設定頁「輸入」區新增**鍵盤高度滑桿（85–140%）**，以縮放比例存於偏好
（`Prefs.keyboardHeightScale`），同一比例套用直橫向基準高度 — 一個滑桿、行為可預期。
這也是補上游承諾的功能：`,,H` 說明文字（承自 Yabomish）本來就寫著
「設定頁可用滑桿調整」。

配套決策：**鍵面字級連動縮放、上限 1.2×**（`KeyboardTheme.keyFontScale`，
乘在 lowercaseSize/systemSize/swipeSize 等 cskin 字級上）。使用者抱怨的是
「格子太小」，字不跟著放大只會變成大鍵小字；封頂 1.2× 避免高倍率時撐爆鍵帽。
候選列維持 46dp 不動（同 iOS 設計，文字列沒有點按面積問題）。

## 實作陷阱：IME 視窗不會因 layoutParams 變更重量測

第一版在 `onStartInputView` 直接改鍵盤 frame 的 `layoutParams.height` 並
`requestLayout()` — 模擬器實測高度完全不變（IME 的 SoftInputWindow 不會因此
重新量測）。改走與深淺色切換相同的路徑：`onCreateInputView` 記錄
`builtBodyHeight`，`onStartInputView` 發現目標高度不同就整個重建 input view
（`setInputView(onCreateInputView())`）。重測 100% vs 140%：高度與字級皆正確放大。

滑桿正下方就是設定頁的「測試輸入」欄位 — 調完點欄位即時預覽，不用離開頁面。
