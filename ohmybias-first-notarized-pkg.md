2026-08-14

# OhMyBias：首個公證 pkg 出爐（附一個 bash 全形括號小坑）

Developer ID Installer 憑證建好後，`./release.sh` 首次全程跑通：建置 → 簽 app → pkgbuild/productbuild → productsign → Apple 公證（**Accepted**）→ staple。產出 `OhMyBias-0.2.0.pkg`（731KB），三重驗證全過 — `pkgutil --check-signature`（trusted by the Apple notary service）、`stapler validate`、`spctl -t install`（accepted, source=Notarized Developer ID）。使用者從此雙擊安裝，結尾由 Installer 建議登出（可稍後）。

順手修了結尾才炸出的小蟲：macOS 內建 bash 3.2 在 `set -u` 下，`"$PKG_OUT（雙擊安裝…"` 的全形括號多位元組字元被誤併入變數名，報 `PKG_OUT�: unbound variable`。變數後緊接 CJK 全形字時要寫 `${PKG_OUT}` 明確界定。pkg 本體不受影響（錯誤發生在最後一行提示訊息）。
