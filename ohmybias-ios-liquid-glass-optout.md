2026-08-15

# OhMyBias iOS：關閉 iOS 26 Liquid Glass（UIDesignRequiresCompatibility）

## 什麼壞了

在 iPhone 17 Pro（iOS 26）上安裝本機新編譯的版本後，介面「災難性」走樣。

## 根因

本機 Xcode 已是 26.3（iOS 26.2 SDK）。**以 iOS 26 SDK 連結的 app 會自動啟用
Liquid Glass 新設計** — SwiftUI `Form`／`NavigationStack` 的工具列與按鈕、UIKit 系統
控件全面玻璃化。本專案的設定頁與鍵盤 extension（候選列工具列的 `UIButton`、
`UIHostingController` 的設定連結）都是按舊設計調校的，玻璃化後對比與佈局全毀。

先前使用者自行以舊版 Xcode 部署時不會觸發；這次改由本機 Xcode 26 建置安裝，
等於第一次用 iOS 26 SDK 連結，新設計隨之生效。

## 修法

兩個 target（容器 app、鍵盤 extension）的 Info.plist 各加：

```xml
<key>UIDesignRequiresCompatibility</key>
<true/>
```

這是 Apple 提供的官方相容開關：以 iOS 26 SDK 編譯但維持 iOS 18 外觀。
該 key 是**過渡措施**（Apple 已預告未來 SDK 會移除）— 屆時需真正適配
Liquid Glass 或鎖定舊 SDK，此為已知的技術債。

## 驗證

裝置重建、重新安裝至 iPhone 17 Pro，由使用者確認外觀恢復。
