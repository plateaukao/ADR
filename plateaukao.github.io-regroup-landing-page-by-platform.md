2026-08-09

# Regroup landing page by platform, add NerLan and modified forks

The landing page at plateaukao.github.io listed projects under loose headings — "Apps", "macOS", "Browser extensions", "Tools", "Fun" — and the grouping had drifted from reality: WhisperASR (a macOS app) sat under "Apps" next to Android projects, and SweetLime (an Android IME) sat under "Tools". The page was also missing everything shipped in the last two months.

## What triggered this

A sweep of GitHub activity since 2026-06-09 (repos pushed + releases published) found five projects with recent releases that weren't on the page at all:

- **nerlan-android** (v1.0 → v1.8) and **nerlan** (v1.0 → v1.7) — a brand-new Android/iOS app pair: a language-learning audio player for Taiwan's National Education Radio Channel+ platform (~96 programs, 19 languages, offline downloads).
- **koreader** fork — device-specific builds: Supernote e-ink stylus v2, Huawei MatePad Paper stylus annotation v1, iReader touch fix.
- **macdown** fork (v0.8.1, v0.8.3) — adds live Mermaid rendering of `.mmd` files in the preview pane.
- **eLauncher** fork (sn1.1) — Supernote build of the e-ink-optimized launcher.

(EinkBro, WhisperASR, and SweetLime also released steadily in that window, but were already listed.)

## The new organization

Groups are now strictly by platform/kind, with a dedicated **Forks** group whose descriptions say what the fork changes rather than what the upstream project is:

- **Android** — EinkBro, SweetLime (from "Tools"), pwidgets, sony_draw, NerLan (new)
- **iOS** — NerLan (new group)
- **macOS** — WhisperASR (from "Apps"), MoePeek, mandroid-transfer, mandroid_finder, mmgo-mac
- **Extensions & plugins** — Ask Web, Netflix Subtitles, WebVTT for Calibre (absorbed from "Tools", which is gone)
- **Forks** (new) — KOReader (stylus & touch builds for Supernote / MatePad Paper / iReader), MacDown (live Mermaid preview), eLauncher (Supernote build)
- **Fun** — unchanged

Platform placement was verified against each repo's primary language on GitHub (pwidgets, sony_draw, sweetlime are all Kotlin/Java Android projects) rather than guessed from names.

## Deliberately left out

**immersive-script** and **arabic_lessons** are active but have no releases, so they stay off the page for now; immersive-script would slot into "Extensions & plugins" if that changes.
