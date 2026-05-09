# einkbro: Dynamic zoom factor for Save-as-PDF

## Problem

After fixing Save-as-PDF to bypass the system print spooler, fonts on the
saved A4 PDF looked oversized when viewed on a 10" device or printed on real
A4 paper. The first cut tried `Resolution(600, 600)`, then `Resolution(300, 300)`
on the assumption that "more dpi = smaller fonts." That's wrong. A
hard-coded `zoom: 0.7` tweak helped, but only by accident — different sites
need different zoom.

## Root cause

WebView's print pipeline (Chromium) computes the print layout viewport as

```
cssPx = mediaWidthInches × 96
```

independent of `PrintAttributes.Resolution`. Resolution only affects raster
fidelity; layout width is locked to 96 CSS px per print inch. For A4 that's
**794 CSS px**.

Most desktop-style sites lay out at 1024–1280 CSS px in the live WebView. When
the print pipeline forces them into a 794-px viewport, the layout is
shrink-to-fit but **font sizes don't shrink with it** — Chromium's print path
treats explicit `font-size: 16px` as 16 CSS px in the print viewport. So a font
sized for a 1280-px layout, when re-laid out at 794 px, occupies a
proportionally larger fraction of the page than the user expected.

A fixed zoom can't fix this because the right factor depends on the page's
actual layout width, which varies per site.

## Solution

Before invoking the print adapter:

1. Measure the live page's layout width via `evaluateJavascript` on
   `pdf_measure_layout.js`:
   ```js
   Math.max(window.innerWidth, documentElement.clientWidth, body.scrollWidth)
   ```
   The `max` picks up content overflow (sidebars, fixed-width tables) so
   we don't underestimate.

2. Compute zoom in Kotlin:
   ```kotlin
   val printViewportCssPx = mediaSize.widthMils / 1000.0 * 96.0
   val zoom = (printViewportCssPx / pageWidth).coerceIn(0.4, 1.5)
   ```
   `0.4–1.5` clamp guards against pathological pages (4000-px wide → unreadable
   tiny print, 200-px wide → grossly stretched).

3. Substitute into a `@media print { html { zoom: X !important } }` stylesheet
   (asset `pdf_print_style.js` with `__ZOOM__` placeholder; locale-safe
   `String.format(Locale.US, ...)` to avoid comma decimals breaking CSS), then
   inject and proceed with `adapter.onLayout` / `onWrite`.

4. On finish (success or failure), `pdf_print_cleanup.js` removes the injected
   `<style>` so the live page is untouched.

The `@media print` wrapper means the rule only applies during PDF rendering;
the user's on-screen experience is unchanged.

## Worked examples (A4, 794-px print viewport)

| Live page width | Zoom | Effect |
|----------------:|-----:|--------|
| 1280 (desktop)  | 0.620 | Shrinks to fit; fonts proportional |
| 1024            | 0.775 | Mild shrink |
| 800 (10" tablet)| 0.993 | Essentially 1:1 |
| 412 (mobile)    | 1.500 (clamped from 1.93) | Stretched but capped |

## Key files

- `app/src/main/assets/pdf_measure_layout.js` — JS that returns the live
  layout width via `evaluateJavascript`.
- `app/src/main/assets/pdf_print_style.js` — `@media print` stylesheet
  template with `__ZOOM__` placeholder.
- `app/src/main/assets/pdf_print_cleanup.js` — removes the injected style.
- `app/src/main/java/info/plateaukao/einkbro/activity/delegates/FileHandlingDelegate.kt`
  — `savePdfToUri()` now measures, computes, injects, then calls
  `startPdfRender(...)`. `finalizePdf(...)` always runs cleanup.

## Lessons learned

- "Print works on Pixel" doesn't generalize. WebView's print viewport is a
  fixed `paperInches × 96` CSS-pixel layout that has nothing to do with the
  device screen and isn't influenced by `Resolution`. Many StackOverflow
  answers conflate the two and "fix" font size by changing dpi — that's just
  rasterising the same wrong layout more sharply.
- For per-site behaviour, query the page state via `evaluateJavascript` before
  printing rather than guessing. The page already knows its own layout width;
  reading it is a single async hop and removes a class of magic numbers.
- When formatting numbers for emission into JS/CSS strings, always use
  `Locale.US` (or `Locale.ROOT`). User-locale `%.3f` will silently inject
  comma decimals on de_DE / fr_FR / etc. and break the resulting CSS in ways
  that won't show up in en_US testing.
- Per project rule: keep injected JS in `app/src/main/assets/*.js`, not as
  inline Kotlin string literals. Templates use plain `__PLACEHOLDER__`
  substitution to keep the JS independently runnable in DevTools.
