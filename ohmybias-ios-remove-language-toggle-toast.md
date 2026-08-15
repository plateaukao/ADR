2026-08-16

# OhMyBias iOS：中英切換不再彈出鍵盤中央模式提示

## 問題

點第三排的「英」鍵切換中英模式時，鍵盤中央會彈出「繁中」／「A」的 toast（黑底白字、
約 1.2 秒）。使用者反映這個提示擋在鍵盤正中央干擾視線 — 而且是冗餘的：
第三排前導鍵鍵面本身就顯示目前模式，切換結果一眼可見。

## 修法

`InputEngine.toggleEnglishMode()` 移除 `engineDidShowToast(_currentModeLabel)` 一行。
其他 toast 路徑刻意保留不動：

- 注音（`ZH`）／拼音（`PYS`/`PYT`）等特殊模式退出時的模式提示 — 這些模式沒有鍵面指示，
  toast 是唯一回饋。
- `,,` 指令的結果提示（`,,T`/`,,S` 換模式、`,,RS` 重置字頻等）— 指令執行與否需要回饋。

`setEnglishMode(_:)`（啟動還原狀態用）本來就不顯示 toast，不受影響。

測試 `testEngineSetEnglishMode` 原本斷言 toggle 後 `toasts.last == "A"`，
改為斷言 `toasts.isEmpty`。
