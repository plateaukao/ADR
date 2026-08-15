2026-08-15

# OhMyBias iOS：移植 Android 版鍵盤高度縮放（85–140% 滑桿）

## 這次改了什麼、為什麼

Android 版早有「鍵盤高度」滑桿（85–140%，大螢幕手機可調大），iOS 版一直是寫死的
`(橫向 ? 180 : 224)pt + 候選列高`。空白鍵最大化移植（見
`ohmybias-ios-spacebar-maximization.md`）時檢查發現這項從未移植，本次補上，讓兩平台設定對齊：

- `OhMyBiasPrefs.keyboardHeightScale`（Double，0.85–1.40 夾限、預設 1.0）— 讀寫皆夾限，
  防呆值不會讓鍵盤縮到不可用。
- `KeyboardViewController.updateViewConstraints`：高度 = 基準 224pt（橫向 180pt）× 縮放 +
  候選列高。候選列高不隨縮放 — 同 Android 版，縮放只作用於按鍵區。
- 容器 app 設定頁「輸入」區新增滑桿與百分比標示，重開鍵盤生效
  （extension 於 `updateViewConstraints` 讀取 App Group UserDefaults）。

## 附帶發現

iOS `InputEngine` 的 `,,H` 說明文字提到「拖拉候選字區上緣可調整鍵盤高度」— 該互動在 iOS
extension 從未實作（上游 yabomish 的殘留）。本次未處理，留待日後決定是實作拖拉或修訂說明。

## 版本

併入 0.2.0 發佈（CHANGELOG「新增」節）。tag `v0.2.0` 指向此 commit 的前一個
（移動已推送的 tag 需 force push，暫不移動）。
