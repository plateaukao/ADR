2026-08-15

# OhMyBias 米 Android：新版 cskin 扁平 schema 支援＋adaptive icon

## 皮膚「載入失敗」的真相：settings.json schema 改版了

使用者回報 `蝦米輸入法.cskin` 載入不了。逐層排查：zip 本身正常（UTF-8 檔名旗標有設，
macOS unzip 顯示亂碼只是顯示問題）、`jsonnet/settings.json` 存在且是合法 JSON —
問題是**新版皮膚匯出器改用扁平 schema**：

| 舊版（巢狀） | 新版（扁平） |
|---|---|
| `toolbar.toolbarButtons` | `toolbarButtons`（頂層） |
| `layout.spaceKeyLayout` | `spaceKeyLayout`（頂層） |
| `swipe.globalEnabledFeatures`（字串陣列） | `enableSwipeUpActions` 等布林（頂層） |
| `globalSettings.palette` / `.groups` | `palette` / `groups`（頂層） |

我們的解析器只認舊版 → 匯入「成功」（皮膚名稱有套上）但所有配置靜默退回預設，
使用者看起來就是沒載入。這類**寬鬆解析器 + schema 演進**的組合是經典陷阱：
沒有任何錯誤，只有默默的無效。

修正：`SkinSettings.apply` 同時支援兩種 schema（新版頂層鍵優先、舊版區塊 fallback），
加入扁平 schema 的 JVM 測試案例。以使用者的實際檔案在模擬器驗證：工具列
（`[1,3,7,0,10,5,6,0,8,2]` — 含新實作的全選鍵、0/6 佔位）、調色盤、
spaceKeyLayout（寬逗號句號）全部生效。新 schema 尚有 `handedness`、
`advancedRowControl`、`overrides` 等進階鍵，超出目前配置層範圍，先忽略。

## 順帶：Android adaptive icon

同輪回報 launcher 圖示有白邊且米字太小 — 因為只有傳統方形 PNG，launcher 會把它
縮進白色圓形遮罩。改為 adaptive icon：背景層滿版橘黃漸層（取樣 iOS 圖示
#F5B85D→#E68D2C）、前景層以藍色通道從 iOS 1024px 圖示萃取米字（抗鋸齒 alpha，
佔畫布 50%，米字臉保留）、附 monochrome 層支援 Android 13 主題圖示。
App drawer 實測：滿版圓形、無白邊、米字明顯放大。
