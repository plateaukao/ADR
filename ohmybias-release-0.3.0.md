2026-08-14

# OhMyBias：發佈 v0.3.0

0.2.0 發佈後累積的兩項變更（詳見 [pin-only ranking](ohmybias-pin-only-ranking.md)
與 [remove freq machinery](ohmybias-remove-freq-machinery.md)）以 v0.3.0 出貨：

- 候選字排序改為「字表順序＋`,,PIN` 固定排序」，打字路徑不碰 SQLite。
- 字頻機制整組移除；`FreqTracker` 瘦身更名 `PinnedStore`（`pinned.db`），首次啟
  動自動遷移舊 `freq.db` 的固定排序並刪除舊檔；`,,RS` 移除。

版號選 **0.3.0**（minor）而非 0.2.1：這是使用者可感知的行為變更（字頻學習消失、
排序語意改變、資料檔更名），不是修補。

流程照 `release.sh` 一次到底：CHANGELOG 的 `## 未發佈` 段改為 `## [0.3.0]`（頂端
保留空的 `## 未發佈` 標記與括號警告註解）→ release commit `741ffe6` → 簽章、
pkgbuild、公證（Accepted）、staple → `gh release create v0.3.0` 附上
`OhMyBias-0.3.0.pkg`（709 KB）。

Release：<https://github.com/plateaukao/ohmybias/releases/tag/v0.3.0>
