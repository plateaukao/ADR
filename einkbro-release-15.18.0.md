2026-07-19

# EinkBro 15.18.0 Release

Cut release v15.18.0, bundling the 21 commits landed since v15.17.0. The release commit bumps `versionCode` to `15_18_00` / `versionName` to `"15.18.0"`, adds the changelog entry, and — new this cycle — refreshes the docs site content in the same commit, not just its changelog.

## What shipped

**Features**

- **Google Drive sync** — back up/restore the app-data zip to the Drive `appDataFolder`; OAuth PKCE runs entirely in the browser, no Play Services.
- **Site Settings dialog** — per-site AdBlock/Cookies/JavaScript/desktop-mode tri-state overrides, tappable whitelist entries, full-screen dialog on phones.
- **Vertical (CJK) reading overhaul** — reliable enter/exit, line-snapped paging, tate-chu-yoko typography, reader layout settings apply in vertical mode.
- **Reader layout settings dialog** — long-press the reader icon; page margin/line spacing live-apply, two-column landscape; the old "Padding for Reader Mode" and "Keep Extra Content" settings moved here.
- **E-ink image optimization** — fast CSS-filter mode plus live preview dialog.
- **Search-query prefill** when editing a search-result URL.

**Fixes** — clear-on-exit really clears cookies/site storage; complete desktop Chrome fingerprint; fullscreen video honors rotation lock; geolocation grant waits for the OS permission; translation deadlock/form-corruption/priority fixes; reader mode keeps hyperlink-dense code blocks; IME opens in Compose-based dialogs.

**Renames** — "GPT Settings" → "Gen AI", "Statusbar" → "Info bar", "Start Control" → "Site Settings" (all locales).

## Docs site kept in lockstep

Beyond the usual `docs/download.html` (+ zh-tw) changelog blocks, this release also updated the guide pages so the site matches the renamed screens and new features:

- Renamed "Start Control"/"GPT Settings"/"Statusbar" everywhere they appear (TOC, section headings, cross-references in the userscript and bug-report pages) while keeping the HTML anchors (`#settings-startcontrol`, `#settings-gpt`) stable so existing links don't break.
- Documented the new Backup item (Sync with Google Drive), the reader layout settings dialog (replacing the removed "Padding for Reader Mode" / "Keep Extra Content" entries), vertical-mode behavior, and per-site content overrides.
- Index feature card for Privacy & Browsing now describes per-site overrides instead of only per-site desktop mode.

## Release mechanics

Signed APKs built locally for all ABI splits plus the universal APK (`-PuniversalApk` is opt-in since `6d99411b` — forgetting it ships a release missing the universal artifact), and the `releaseAlt` universal APK (`info.plateaukao.einkbro.a`) for side-by-side testing. All six artifacts attached to the GitHub release `v15.18.0`.
