2026-08-31

# OhMyBias Android：浮動鍵盤底邊框被把手蓋掉；角落提示弧改拖曳時才顯示

## 壞掉的：底邊框看不見

浮動卡片的 1dp 邊框畫在 `card.background`（GradientDrawable stroke）— background
畫在所有子視圖**底下**。卡片內容欄左右上各留 6dp inset，唯獨底部是 0（拖曳把手要貼齊
卡片底緣），而 `DragBar.onDraw` 先整片 `drawRect` 填鍵盤底色 — 底邊那段邊框就被
不透明填色蓋掉，只剩上、左、右三邊與（當時常駐的）角落粗弧看得到。

**修法**：底色與邊框分家 — 填色留在 background，1dp 邊框改畫在 `card.foreground`
（transparent 填色＋同半徑 stroke）。foreground 畫在子視圖**上面**，四邊不管內容畫什麼
都蓋不掉它。比「給內容欄墊 1dp 底 padding」乾淨：那只補得了這一邊。

## 順手的 UX：角落提示弧不再常駐

使用者不要四角常亮著提示。改為：

- 平時 `hintsVisible = false`，`CornerHandle.onDraw` 直接不畫（觸控範圍不變，四角照樣可拖）；
- 拖曳開始（底部把手或任一角的 ACTION_DOWN）亮起並取消倒數；
- 放手（UP/CANCEL）起算 3 秒後熄滅（`postDelayed` 單一 runnable，重按會重排）。

拖把手移動時四角亮起，正好提示「這卡片也能從角落縮放」；3 秒後畫面回到乾淨的圓角卡片。

## 驗證

Pixel_7_API_36：浮動狀態截圖三連 — 靜止（無弧、底邊框可見）→ 拖把手中（四角弧亮）
→ 放手 3.2 秒後（弧消失、邊框仍在）。
