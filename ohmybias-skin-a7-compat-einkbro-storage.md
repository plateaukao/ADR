2026-08-16

# ohmybias-skin：舊 WebView 相容層＋Hisense A7 下載失敗的真兇（EinkBro Android 10 儲存權限洞）

使用者問「blob 下載在我的 A7（舊 Android 手機）也能用嗎？」。分兩層回答，
兩層都做了實證。

## 網站端：語法降到 ES2018（commit b284f74）

原始碼用了 optional chaining / nullish coalescing（Chrome 80+）與無綁定
catch（66+）—— 在沒更新過的舊 WebView 上會**整頁語法錯誤**，比下載壞更慘。
改寫成 ES2018（`es-check es2018` 機器驗證通過），並加兩個執行期守護：
ResizeObserver 缺席退回 window resize、DecompressionStream 缺席時匯入
DEFLATE 壓縮的 .cskin 優雅失敗（本設計器匯出用 STORE 不受影響）。
實際門檻降到約 Chrome/WebView 61（ES modules 底線，2017 年）；
blob 下載機制本身（createObjectURL + a[download]）更古老，不是瓶頸。

## 裝置端：A7 實測揪出 EinkBro 的 Android 10 專屬洞

A7 = Hisense A7 e-ink 手機（HNR320T，Android 10，WebView 138 — 很新）。
adb reverse 接本機站台、EinkBro 開頁：**頁面渲染正常、匯出的 blob 流程
整條走通**（hook 攔截、chunk 回傳都成功），最後仍跳「Download link is not
valid」。logcat 抓到真兇：

```
Failed to complete blob download: java.io.FileNotFoundException:
/storage/emulated/0/Download/我的皮膚.cskin: open failed: EACCES (Permission denied)
```

寫檔權限問題被 catch-all 誤報成「下載連結無效」。而且是 **Android 10 剛好
掉進三個條件的交集**：

1. `HelperUnit.needGrantStoragePermission` 只處理 `SDK_INT in 23..28` —
   API 29 直接回傳「不用權限」；
2. manifest 的 READ/WRITE_EXTERNAL_STORAGE 標了 `maxSdkVersion="28"` —
   API 29 上這權限根本不存在、`pm grant` 都會丟 SecurityException；
3. `requestLegacyExternalStorage="true"` 讓 Android 10 走 legacy 模式 —
   偏偏 legacy 模式用 raw `File` 寫共用 Download/ **需要**那個拿不到的權限。

Android ≤9：權限可要可給 → 正常。Android 11+：FUSE 允許免權限在 Download/
建檔 → 正常（模擬器 API 34 因此測不出來）。**唯獨 Android 10 全滅** ——
EinkBro 在 Android 10 上所有 blob／data URL 下載（raw File 寫入路徑）都會
以「下載連結無效」收場。

修法屬 einkbro 專案（擇一）：
- **A（小刀）**：manifest `maxSdkVersion` 28→29＋`needGrantStoragePermission`
  範圍改 `23..29` — 恢復 Android 10 的權限請求流程。
- **B（現代）**：API 29+ 改走 `MediaStore.Downloads` 寫入，完全免權限，
  順便把誤導的 catch-all 錯誤訊息分開（權限錯 ≠ 連結無效）。
