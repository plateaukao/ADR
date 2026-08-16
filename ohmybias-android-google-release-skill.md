2026-08-16

# ohmybias-android：google-release 專案 skill — Play 發佈流程固定下來

首次 Play 上架（見 `ohmybias-android-play-store-release-prep.md`）走完後，把整條
發佈流程寫成專案 skill（`.claude/skills/google-release/SKILL.md`），之後任何
session 說「發 Play 版」就能照表操課，不必重考古。

內容重點不是指令本身（GPP 的任務名 console 文件都查得到），而是**這次實際踩過、
下次一定再踩的坑**：

- `~/.secrets/ohmybias-keystore.properties` 缺檔時 build **不會失敗**，會默默退回
  debug 簽章 — 所以流程裡強制在上傳前 `keytool -printcert` 驗 AAB 憑證
  （必須是 2018 Daniel Studio upload key）。
- 服務帳戶權限是**逐 app 授予**：新 app 的 `PERMISSION_DENIED` 不是憑證壞掉，
  是要使用者去 console 加權限 — 且只有使用者能做（Claude 被 classifier 擋在
  `~/.secrets` 與帳戶操作之外）。
- `publishPlayReleaseBundle` 只傳 bundle＋release notes；商店文案與圖檔是另一個
  任務 `publishPlayReleaseListing` — 「上傳成功但 console 空白」的答案。
- Play 版與 GitHub 版是兩條獨立通道（`.g` applicationId、不同 keystore），
  skill 開頭先劃清界線，避免把 tag/gh release 流程混進來。

版本紀律也寫死：versionCode 單調遞增、GitHub 與 Play 共用同一組版本號、
production 永遠明確指定（`--promote-track production`），不設預設。
