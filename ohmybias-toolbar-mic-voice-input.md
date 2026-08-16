2026-08-16

# 工具列新增「語音輸入」按鈕（Android ID 32）

OhMyBias 米的工具列一直沒有語音輸入。使用者要講話輸入時得自己按 🌐 換到 Gboard 或
Google 語音輸入法，講完再換回來 — 一趟要動兩次系統輸入法選單。這次把它做成工具列上的
一顆按鈕，並同步進皮膚設計器 `ohmybias-skin`，讓使用者可以自己排到工具列的任一格。

## 作法：照抄 sweetlime 的 startVoiceInput 流程

Android 的 IME 不能自己開聽寫視窗 — `RecognizerIntent` 要一個 Activity，從
InputMethodService 拉一個 Activity 起來會把使用者正在打字的畫面蓋掉，而且辨識結果還得
自己塞回 `InputConnection`，等於重做一套語音 UI。sweetlime（`LIMEService.startVoiceInput()`）
的作法才是 Android 上的正解：**把輸入法切給系統的語音輸入法**，由它接手聽寫，
它會直接把文字送進同一個輸入框，講完自己切回來。使用者體感就是「按麥克風 → 講話 → 字出現」。

所以本專案完全照著移植，包含 `LIMEUtilities.isVoiceSearchServiceExist()` 的三段搜尋：

```mermaid
flowchart TD
    A["工具列按下 音 (ID 32)"] --> B["KeyAction.VoiceInput"]
    B --> C["engine.handleEscape() 清掉組字中的碼"]
    C --> D["voiceImeId(): 掃已啟用輸入法"]
    D --> E{"Pass 1: 已知 Google 語音 IME?"}
    E -- 是 --> I["switchInputMethod(id)"]
    E -- 否 --> F{"Pass 2: 有 mode=voice 的 subtype,<br/>或 ID 含 voice / speech?"}
    F -- 是 --> I
    F -- 否 --> G{"Pass 3: 裝了 Gboard?"}
    G -- 是 --> I
    G -- 否 --> H["候選列浮字: 找不到語音輸入法"]
    I --> J["語音 IME 接手同一個輸入框聽寫"]
```

Pass 3 的 Gboard 是退而求其次：Gboard 有內建語音但不對外提供語音專用 IME/subtype，
切過去至少讓使用者按得到 Gboard 自己的麥克風鍵。三段都沒中就用候選列的浮字提示
（不是 Toast — IME 內走既有的 `showToast()`）。

實作落在三個檔：`KeyAction.VoiceInput`、`OhMyBiasImeService` 的
`startVoiceInput()` / `voiceImeId()`、以及 `CandidateBar` 的按鈕 ID 對應表。

## 按鈕 ID 選 32

工具列按鈕 ID 是 Hamster 那套編號，App 端的對應表註解記得很清楚：0 佔位、6 剪貼本、
18-25 與 31 是 Hamster 專屬。也就是說 31 以下都被別人佔著了，本家自訂只能從 **32** 開始。
語音輸入拿 32，並在 `CandidateBar` 的註解裡寫明「32 起是本家自訂 ID，需與皮膚設計器
`data.js` 同步」，免得下一顆自訂按鈕又去踩到 Hamster 的號碼。

字樣用「音」而不是 🎤：工具列是 `TextView`，顏色跟著皮膚的 `toolbarColor` 走，
emoji 是彩色點陣、不吃 `setTextColor`，跟旁邊的 設／米／符／顏 也不同調。

iOS 版標成不支援（設計器顯示「僅 Android」）— 鍵盤 extension 沒有切換到其他輸入法的 API。

## 設計器：順手收掉重複的「符號面板」

排按鈕時會看到兩個一模一樣的「符號面板」選項 — ID 7 和 30 在 Android 與 iOS 都對到同一個
動作，這是 Hamster 編號表本來就有的重複。直接把 30 從清單刪掉會讓既有 `.cskin` 匯進來
變成空格，所以改成在 `data.js` 標 `dup: true`：解析、預覽照舊認得 30，
只是選按鈕的清單 (`app.js` 的 `renderToolbarPanel`) 跳過它。之後再遇到這種同義 ID
沿用同一個旗標即可。

## 驗證

模擬器 Pixel_7_API_34（已啟用 `com.google.android.tts/...VoiceInputMethodService`）：
推一份 `toolbarButtons: [1,3,9,32,...]` 的 `skin_settings.json` 進 `files/shared/`，
重開 App → 點測試輸入框叫出鍵盤 → 工具列第 4 格出現「音」→ 點下去，
`settings get secure default_input_method` 變成 Google 語音 IME，畫面出現它的
「Tap to pause」聽寫面板，貼在同一個輸入框上。

設計器則在本機 `python3 -m http.server` 開起來確認：Android 平台下「語音輸入」選項無
「僅 Android」徽章、放進格子後預覽工具列顯示「音」；iOS 平台下顯示為不支援；
清單只剩一個「符號面板」；主控台無錯誤。

設計器已推上 GitHub Pages（`ohmybias-skin` commit `8dfc268`）。App 端改動待 commit —
舊版 App 讀到 ID 32 會依既有規則降級成空白格，兩邊不同步也不會壞。
