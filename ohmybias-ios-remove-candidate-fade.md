2026-08-17

# OhMyBias iOS：候選列移除隱式淡入淡出

## 問題

使用者回報候選字出現時有淡入淡出效果，拖慢候選顯示、視覺上也分心。但翻遍 `CandidateBar` 與 `KeyboardViewController`，程式裡**沒有任何一行動畫程式碼** — 沒有 `UIView.animate`、沒有 `CATransition`。

## 根因

淡變來自 UIKit 本身：候選按鈕用 `UIButton(type: .system)` 建立，而 **system 按鈕對 `setTitle` 內建約 0.25 秒的 crossfade**（隱式動畫）。候選列每個鍵擊都會重設按鈕標題（按鈕採重用池、不重建，所以每次都走 `setTitle` 路徑），於是每一鍵候選都在淡變。切換中英文的語言鍵（米/英）同樣是 system 按鈕的 `setTitle`，也有同樣的淡變。

## 修法

把 `setCandidates` 的整段按鈕更新迴圈、以及 `setEnglishMode` 的標題切換，包進 `UIView.performWithoutAnimation { ... }` 並在區塊內 `layoutIfNeeded()`（讓版面在無動畫上下文內完成套用）。候選與「米/英」現在即時切換。

保留 `.system` 按鈕型別不改成 `.custom` — system 型別還提供按下時的 highlight 回饋，只需關掉標題更新的隱式動畫即可。
