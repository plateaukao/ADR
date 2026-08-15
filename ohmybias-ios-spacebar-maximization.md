2026-08-15

# OhMyBias iOS：空白鍵最大化移植 — 只取版面部分，省略地球鍵相關功能

## 這次改了什麼

自 Android 版同名變更（見 `ohmybias-android-spacebar-maximization.md`，含完整決策流程圖與實測數據）移植版面部分到 `KeyboardView.letterRows()`：

- 工具列含 123（sweetlime 按鈕 ID 9/29）時，底列不再重複放 123 鍵。
- 逗號句號固定標準鍵寬（1.0 單位），不再採用皮膚 `spaceKeyLayout` 的 1.4/1.2 倍放大值。
- 原則同 Android：**空白鍵永遠優先吃剩餘寬度**。iOS 的排版本來就是 Auto Layout
  `.fill` distribution、空白鍵無寬度約束彈性撐滿，鍵省掉後不需額外調整。
- 順手移除了 `spaceWidth` 的手算倍率 — 空白鍵在含空白的排從不套寬度約束，該值一直是死碼。

## 刻意不移植的部分（與 Android 版的差異）

Android 版另有「隱藏 🌐 鍵」設定與工具列米/英長按開輸入法選單；iOS 版兩者都不需要：

- iOS 系統本就在鍵盤外提供切換輸入法的地球鍵（新式 iPhone 於鍵盤下方系統列），
  extension 內的 🌐 鍵已依 `needsInputModeSwitchKey` 自動隱藏 — 不顯示時等同「隱藏 🌐」的效果。
- 因此也不需要米/英長按的補位入口。技術上這條路在 iOS 也不可靠：系統輸入法列表只能由
  `handleInputModeList(from:with:)` 轉發真實觸控事件觸發，UILongPressGestureRecognizer 拿不到 UIEvent。

## 版本

隨 0.2.0 發佈（CHANGELOG、MARKETING_VERSION、tag v0.2.0；Android 版同號）。
