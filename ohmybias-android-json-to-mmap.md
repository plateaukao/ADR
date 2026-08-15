2026-08-15

# OhMyBias 米 Android：注音/拼音/字頻 JSON → mmap 二進位

三個 lazy 載入的 JSON（`zhuyin_data.json` 351KB、`char_freq.json` 158KB、
`pinyin_data.json` 100KB）原本在**第一次**同音字/注音/拼音查詢時整包用 org.json
解析進 HashMap — 約 24k entries 上 heap，且首查有可感知的秒級延遲（模擬器驗證時
曾慢到 0.4 秒後截圖還拍不到候選）。改成 mmap 二進位後查詢直接在檔案上二進位搜尋，
零解析、零 heap。

## 格式（與既有 CINM/PHMM/BGMM 同家族，LE、可跨平台）

| 格式 | 結構 | 用於 |
|------|------|------|
| SSMM | string key（UTF-8 位元組序）→ [string]；key idx 12B/筆、val idx 6B/筆 | char_to_zhuyins（值是注音字串） |
| SCMM | 同 SSMM 但值全為單一 codepoint → 直接 u32 陣列、無 val idx（省約四成） | zhuyin_to_chars、pinyin_to_chars |
| CFMM | (codepoint u32, freq u32) 對，依 codepoint 排序 | char_freq |

`zhuyin_data.bin` 為 ZYMM 容器裝兩個區塊；產生腳本 `tools/gen_data_bins.py`
（源 JSON 留在 ohmybias-ios/Resources，Android repo 不再帶 JSON）。
`ZhuyinLookup` 讀 .bin 優先、保留 JSON fallback（升級相容）。

## 取捨（誠實版）

原 ADR 猜「可再省一些」— 實測**反了**：二進位索引熵高、比重複性強的 JSON 難壓，
APK 772KB → **832KB（+60KB）**（SCMM 已從 +90KB 收回 30KB）。但換到的是：

- 首次查詢即時（模擬器實測：ㄅㄚ 候選 0.3 秒內出現，含字根碼反查）
- 常駐 heap 大減（原三張 HashMap ~24k entries + 字串物件 → 0，mmap 頁可回收）

對輸入法（常駐程序、記憶體敏感、延遲敏感）是正確的方向。iOS 版之後可採同格式
（ZhuyinLookup 同樣是 JSON 解析進 dict，同樣吃 lazy-load 延遲與 60MB 上限預算）。

新增 `ZhuyinLookupTest` 以真實資料驗證格式與讀取器（14 JVM tests 全綠）。
