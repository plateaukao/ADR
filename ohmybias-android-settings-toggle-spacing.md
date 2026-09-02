2026-09-02

# 設定頁開關列彼此拉開間距，減少誤觸

使用者回報設定頁「一連串開關貼太近容易點到旁邊那顆」。「輸入」段落有
八顆以上 Switch 連續排列，各自 `minHeight` 48dp 且無列間margin，觸控目標
邊對邊相接 —— 邊界附近一滑就中隔壁。

修法很小：在 `MainActivity.onCreate` 把 root 填完、包進 ScrollView 之前，
掃一遍 root 的直屬子 View，凡是 `Switch` 就上下各加 8dp margin（相鄰兩顆
間隔 16dp）、觸控高度加大到 52dp。只動開關，label＋滑桿那種邏輯群組
（各自已有 padding）不受影響，維持原本的緊湊關係。

用 post-build 掃描而非改每個 `toggle()` 呼叫點，是因為 margin 要靠 parent
的 `MarginLayoutParams`（`addView(view)` 後才由 LinearLayout 指派），集中在
一處設定比散在十幾個 addView 乾淨。
