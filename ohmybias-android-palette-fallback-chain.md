2026-08-15

# OhMyBias 米 Android：皮膚調色盤缺鍵時鏈回皮膚內相容色

使用者回報：套用蝦米輸入法皮膚（深色）後，英/123/⌫/Enter 等功能鍵的標籤看不見。

## 根因

該皮膚的 palette 只定義 21 個鍵，**沒有 `textSystem`**（也缺 `systemBorder`、
`toolbarBg` 等 v2 鍵）。我們的 `KeyboardTheme.pal()` 缺鍵時直接退到**內建預設** —
而內建 sweetlime 深色設計是「功能鍵反白、配深字 #1A1A1A」。皮膚自己的深色
`keySystem` 是深灰（#D1D1D624），配上內建的深字就是**暗底暗字**：版面正常、
顏色合法，只是看不見。

這是「兩套自洽的設計各取一半」的典型錯誤：皮膚的鍵底 + 內建的字色，
單看都對，合起來就撞色。

## 修正（比照 sweetlime CskinParser 的權威 fallback）

sweetlime 原始實作缺鍵時是**鏈回皮膚內的相容色**，不是跳內建：

- `textSystem` → 皮膚的 `textMain`
- `systemBorder` → 皮膚的 `border`
- `toolbarBg` → 皮膚的 `bg`

`pal()` 改支援別名鏈（依序試 palette 的多個鍵，全缺才用內建預設）。本專案
自行擴充的 panel/bubble 鍵同理：`panelLeftText`/`panelCategoryHighlight` →
`textMain`、`bubbleShellBg` → `keySystemHighlight`、`bubbleSelectedBg` →
`keySystem` — 原則是**文字與底色必須出自同一套 palette**。`borderSize` 順帶
改為依深淺色取值（原本固定讀 light）。

未匯入皮膚時所有鍵都缺 → 全部退內建預設，行為不變（15 JVM tests 綠）。
模擬器以該皮膚深色模式實測：功能鍵標籤全部可見、觀感與字母鍵一致。
