2026-08-15

# OhMyBias 米 Android：啟用 R8 — release APK 2.9MB → 772KB

使用者問首發 APK 為何 2.9MB、有沒有開 proguard。沒開（`isMinifyEnabled = false`）。
拆解 APK 後大小組成：

- **classes.dex：2.42MB** — 大宗。未裁剪的 Kotlin stdlib 整包進 dex，自家程式碼只佔小部分。
- 資料 assets 壓縮後約 730KB：phrases.bin（687KB→255KB）＋ zhuyin/pinyin/char_freq/t2s/s2t
  JSON（共 ~480KB）— 這是輸入法的實際 payload，是大小下限。
- 圖示與資源 ~40KB。

## 修正

開啟 R8（`isMinifyEnabled = true` + `isShrinkResources = true`，
`proguard-android-optimize.txt`）。本專案條件對 R8 很友善：

- 無反射、無序列化框架、org.json 是平台 API（不進 dex）
- manifest 進入點（Application／MainActivity／IME service）由 AGP/AAPT 規則自動保留
- `proguard-rules.pro` 留空（只放註記說明為何不需要 keep 規則）

結果：dex 2.42MB → **248KB**，APK 2.9MB → **772KB**，剩餘體積以資料檔為主。

R8 可能悄悄弄壞東西，故 release 版在模擬器完整煙霧測試：載入真實嘸蝦米 7 字表、
軟體鍵盤打字上屏（t→通）、`,,C` 指令 toast — 全部正常。v0.1.0 release 的
APK 資產已用 `gh release upload --clobber` 換成小版本。

若之後要再縮：把三個 JSON（注音/拼音/字頻，壓縮後 ~190KB）轉成 mmap 二進位
可再省一些並降低載入延遲，但收益有限，暫不做。
