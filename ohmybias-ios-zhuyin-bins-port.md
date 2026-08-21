2026-08-22

# OhMyBias iOS：注音／拼音／字頻改讀 mmap 二進位 — Resources 610 KB JSON → 172 KB .bin，extension 零 heap

## 做了什麼

把前一個 ADR（`ohmybias-data-bins-v2-format`）的 Android 讀取端 `DataMaps.kt` 一對一移植成
`Shared/DataMaps.swift`，iOS 的 `ZhuyinLookup` 改為 `.bin` 優先、JSON 只留作 sharedDir
使用者自帶資料的回退路徑。ohmybias-ios commit `a849099`。

四個資料檔合計（含前一個 commit 的 PHM2）：

| | 之前 | 之後 |
|---|---|---|
| 裝置上（bundle 內原樣） | 1,266 KB | 439 KB（−65%） |
| deflate 後（≈ App Store 下載） | 435 KB | 266 KB（−39%） |

iOS 在裝置上省得比 Android 多，因為 JSON 在 bundle 裡是原樣放的；下載量則和 Android 一樣約省 170 KB。

## 為什麼這對 iOS 比體積更重要

鍵盤 extension 有 60 MB 上限。舊路徑用 `JSONSerialization` 把三個 JSON 解成 Swift 字典常駐 heap，
`MemoryBudget` 估 4 MB，而且 `release()` 在記憶體警告時要整包丟掉、下次進注音模式再重解析。
mmap 版是零 heap（只有觸碰到的頁面），預算降成 1 MB；`release()` 改成放掉 mmap 的 `Data`，
重載只是再 map 一次，沒有解析成本。

## 怎麼做

- `DataMaps.swift`：`CodepointKeys`（CPKT 區塊差值鍵表）、`ZhuyinTable`（ZYM2）、`PinyinTable`
  （PYM2，建檔音節數與 ZYM2 不符就視為無資料）、`CharFreqMap`（CFM2），以及 `Data` 的
  `u8` / `utf8String` / `utf16String` / `utf16Chars`（surrogate pair 合成一字）。
  邏輯與 Kotlin 版逐行對應，方便日後兩邊同步改。
- `ZhuyinLookup.swift`：`loadBins()` 走 `Data(contentsOf:options:.mappedIfSafe)`；`freqOf` /
  `zhuyinsOf` / `pinyinLookup` 三個內部查詢各自「bin 優先、字典回退」，公開 API 不變。
- 資料檔直接拿 Android assets 裡由 `tools/gen_data_bins.py` 轉出的同一份；`Resources/` 是
  folder reference（`PBXFileSystemSynchronizedRootGroup`），加 `.bin`、刪 `.json` 都不用碰 pbxproj。
- `Tests/run_tests.sh` 一併複製三個 `.bin`；`Tests/main.swift` 新增 `testZhuyinLookupBins`，
  斷言與 Android `DataBinsV2Test` 相同（非 BMP 鍵走 ext 段、三 的讀音順序、`yu2` 內嵌 vs
  `ba1` 別名、`lv`→`lü`、同頻次保持輸入順序）。

## 驗證

- host 測試 116/116（原 97 + 19）。
- `xcodebuild` app + extension（simulator）成功；appex 內有三個 `.bin`、沒有注音 JSON。
- 模擬器經 IME 實打 `,,zh` ㄅㄚ → 巴／八／吧／芭（模擬器要先 ⇧⌘K 斷開硬體鍵盤，
  軟鍵盤才會出現；這一步 osascript 被 accessibility 權限擋住，由使用者手動按）。

## 追加：容器 app 不再隨附資料檔（`7f70e26`）

量整個 `.app`（Release 裝置版）時發現 `Resources/` 被打包了**兩份**——synchronized folder 同時掛在
app 與 appex 兩個 target 上。容器 app 的 Shared 層只用 `CINTable()` 顯示「已載入」狀態；
`t2s`/`s2t` 是 lazy getter、app 從不呼叫，缺檔也只退化成空 map。於是在 `Resources` group 加一個
`PBXFileSystemSynchronizedBuildFileExceptionSet`，把六個資料檔從 `OhMyBias` target 排除，appex 原樣。

| | 原始 | bin 化後 | 再拿掉 app 那份 |
|---|---|---|---|
| `.app` 裝置上 | 4,608 KB | 3,028 KB | **2,492 KB**（−46%） |
| zip 後（≈ 下載） | 1,780 KB | 1,456 KB | **1,159 KB**（−35%） |

驗證：Release 裝置版 app 層零資料檔、appex 六個齊全；模擬器 app 啟動設定頁正常；host 測試 116/116。
