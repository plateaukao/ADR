2026-08-16

# ohmybias-android：中英切換不再彈出鍵盤中央模式提示

切換中／英文模式（工具列米/英鍵、第三排「英」鍵、空白鍵上滑 — 三個入口都走
`KeyAction.ToggleLanguage` → `InputEngine.toggleEnglishMode()`）時，原本會在
鍵盤中央彈出「繁中」/「A」的模式 toast。這個提示是多餘干擾：工具列鍵字面
本來就會在米↔英之間切換，第三排前導鍵也會在 英↔⇧ 之間重建，狀態一目了然。

修法：拿掉 `toggleEnglishMode()` 裡的 `engineDidShowToast` 呼叫——單一移除點
即涵蓋所有切換入口。注音/拼音等特殊模式的退出提示維持不變（那些情境沒有
其他視覺回饋，toast 仍有價值）。

iOS 版同日已做相同修正（`c56ac53`），兩平台引擎層維持一對一；引擎內留註解
標明此為刻意行為，避免之後從上游同步時誤把 toast 加回來。
