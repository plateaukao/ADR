<!-- added: 2026-05-03T02:01:33Z -->
---
project: einkbro
release: v15.13.0
date: 2026-05-03
---

# Release v15.13.0

## Problem

Cut a new EinkBro release covering 37 commits accumulated since v15.12.0 (2026-04-17). docs/download.html on both EN and zh-tw was also a release behind — 15.12.0 had never been backfilled.

## Root Cause

Normal accumulation of feature/fix work; docs site changelog had drifted.

## Solution

- Bumped `versionCode` to `15_13_00` and `versionName` to `"15.13.0"`.
- Added 15.13.0 entry at top of `CHANGELOG.md`.
- Backfilled 15.12.0 plus added 15.13.0 to both `docs/download.html` and `docs/zh-tw/download.html`.
- Built signed release APKs with `-PuniversalApk` (universal APK is opt-in since 6d99411b) using browser.keystore.
- Published GitHub release with all 5 ABI variants: arm64-v8a, armeabi-v7a, universal, x86_64, x86.

Release URL: https://github.com/plateaukao/einkbro/releases/tag/v15.13.0

## Key Files

- `app/build.gradle.kts` — version bump
- `CHANGELOG.md` — new entry
- `docs/download.html`, `docs/zh-tw/download.html` — backfilled 15.12.0 + added 15.13.0

## Lessons Learned

- `-PuniversalApk` flag is required to emit the universal APK in local release builds (CI sets it via the workflow). Forgetting it ships a release missing the universal artifact.
- Docs changelog tends to drift behind the app changelog; check `docs/download.html` headings against `git tag` before each release and backfill any missing version.
- The release skill at `.claude/skills/release/SKILL.md` does not yet mention `-PuniversalApk` or the docs backfill step — worth updating next time the skill is touched.
