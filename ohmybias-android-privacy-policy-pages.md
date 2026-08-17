2026-08-17

# OhMyBias Android：隱私權政策改掛 GitHub Pages（docs/privacy.html）

Play Console 的隱私權政策 URL 原本指向 repo 的 `PRIVACY.md` blob 頁。
GitHub 故障（status 顯示 partially degraded）期間 blob 頁回 404/503，
Play 的 URL 檢查器剛好撞上，回報「not a valid privacy policy page」—
檔案本身一直都在，是 blob 服務不穩。

改掛 GitHub Pages：新增自包含的 `docs/privacy.html`（內容同 PRIVACY.md，
繁中＋英文、深色模式支援、零外部資源），使用者自行在 repo 設定開啟
Pages（deploy from branch → main → /docs）。Pages 走 Fastly CDN，
比主站 blob 頁穩定得多，適合給審查員長期抓取。發佈後 Play Console 的
隱私政策 URL 改填：

```
https://plateaukao.github.io/ohmybias-android/privacy.html
```

`PRIVACY.md` 保留在 repo 根目錄當原始文件；兩份內容同步維護。
