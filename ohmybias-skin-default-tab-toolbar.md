2026-08-16

# 皮膚設計器開頁預設分頁改「工具列」

設計器下半部的五個分頁（佈局／工具列／滑動長按／配色／字級）原本開頁停在「配色」。
實際使用起來，進設計器最常做的第一件事是排工具列按鈕 — 配色是開著預覽慢慢調的，
不急著在第一秒展開；而工具列每加一顆新按鈕（例如這次的語音輸入）都得先切過去才看得到。
把 `app.js` 的 `activePanel` 初始值從 `'colors'` 改成 `'toolbar'`，開頁就少點一下。

分頁狀態本來就不持久化（`activePanel` 是模組層變數，不寫進 localStorage 的 `state`），
所以這個改動只影響「開新頁時停在哪」，使用者當下切到哪一頁不受影響，也不用改存檔格式。

驗證：本機 `python3 -m http.server` 重新開頁，`.on` 的分頁是「工具列」、
唯一沒有 `hidden` 的 panel 是 `#panel-toolbar`，且面板內容（10 格按鈕條）已渲染 —
`renderTabs()` 本來就會在初始化時渲染 active panel，不需要另外補呼叫。

見 [ohmybias-toolbar-mic-voice-input](ohmybias-toolbar-mic-voice-input.md)。
