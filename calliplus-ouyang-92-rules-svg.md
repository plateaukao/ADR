# CalliPlus — 歐陽詢 間架九十二法 with local SVG assets

## Problem

Add a new 歐陽詢 variant of 間架九十二法 to the CalliPlus rulebook list, using a local set of 368 SVG calligraphy samples (4 per rule × 92 rules) that live outside the Android project in `~/src/ouyang/segmented_svg/`. The existing 黃自元 book follows the same 92-rule structure but references remote Flickr JPG/PNG URLs; Glide loads those natively. The new book must work entirely offline.

Secondary ask: hide 間架九十二法 (黃自元) and 大楷習字帖 (歐陽詢) because their backing Flickr images are no longer reachable.

## Root cause

Two non-obvious traps surfaced while wiring up SVG rendering:

1. **`@GlideModule` must be processed by a Kotlin-aware annotation processor.** First pass wrote `SvgModule.kt`, but the project only declares `annotationProcessor 'com.github.bumptech.glide:compiler:4.14.2'` — not `kapt`. The generated `GeneratedAppGlideModuleImpl` came back with no AppGlideModule registered, so the decoder was never wired into Glide's registry.
2. **AndroidSVG renders at the SVG's declared intrinsic size**, not the canvas size, unless `documentWidth`/`documentHeight` is set to `"100%"`. The bundled SVGs declare ~100pt × 116pt, so when rendered into a 512×512 target bitmap the strokes appeared in a small top-left corner (looked blank because the rest was white fill).

## Solution

- **Assets:** copied all 368 SVGs + `rules_zh_tw.json` into `app/src/main/assets/92_ou_svg/`.
- **Rule file (`92_ou.txt`):** generated from `rules_zh_tw.json` + filename pattern `NN_i_字.svg`. Follows the same `#type:`/`#author:`/`#bookname:`/`#rule:` headers as `92_huang.txt`; each character line uses `file:///android_asset/92_ou_svg/NN_i_字.svg` for both `smallImageUrl` and `largeImageUrl`.
- **ResourceUtils:** register the new book; remove the two entries with dead Flickr backing (`92_huang.txt` and `20_ou.txt` are kept on disk in case the image sources come back).
- **Glide SVG integration (Java, not Kotlin):** `SvgModule extends AppGlideModule` with `@GlideModule`, registering a `ResourceDecoder<InputStream, Bitmap>` via `registry.prepend(...)`. The decoder sniffs the first 512 bytes for `<?xml` / `<svg` / `<!DOCTYPE svg` signatures in `handles()`, then parses via `SVG.getFromInputStream`, calls `svg.setDocumentWidth("100%")` + `setDocumentHeight("100%")` so AndroidSVG fills the canvas viewport, and renders into a bitmap drawn from the `BitmapPool`.
- **ProGuard:** `-keep class com.caverock.androidsvg.** { *; }` + `-dontwarn`.

Verified on a Pixel 7 API 34 emulator — opening 間架九十二法 (歐陽詢) renders rule 1 (天覆者) with 宫/實/官/宇 and subsequent rules correctly.

## Key files

- `app/src/main/assets/92_ou.txt` — new rule definition (92 rules × 4 chars).
- `app/src/main/assets/92_ou_svg/` — 368 SVG samples + `rules_zh_tw.json`.
- `app/src/main/java/info/plateaukao/calliplus/glide/SvgModule.java` — AppGlideModule + `SvgBitmapDecoder`.
- `app/src/main/java/info/plateaukao/calliplus/utils/ResourceUtils.java` — `getBooks()` registration + two hidden entries.
- `app/build.gradle` — added `com.caverock:androidsvg-aar:1.4`.
- `app/proguard-project.txt` — androidsvg keep rule.

## Lessons learned

- When adding reflection/annotation-driven libraries in a mixed Java/Kotlin project, verify whether you actually need `kapt`. If the annotated class is Java, `annotationProcessor` suffices; if Kotlin, you must add `kotlin-kapt` — otherwise the processor silently ignores the class and generated output looks healthy but is empty (`Wrote GeneratedAppGlideModule with: []`). Writing the single annotation carrier in Java is an easy way to avoid adding `kapt` to a small project.
- AndroidSVG's `renderToCanvas(canvas)` respects the SVG's declared `width`/`height` rather than the canvas bounds. To scale an SVG into an arbitrary target bitmap, override with `setDocumentWidth("100%")` + `setDocumentHeight("100%")` before rendering. The viewBox then maps onto the canvas viewport.
- CalliPlus's text-file rule format (`#type:`/`#author:`/`#bookname:`/`#rule:` + `char;url;small;large;desc` lines) is the right place to plug in new rule books — downstream adapters don't need changes as long as the URL field is something Glide can resolve.
