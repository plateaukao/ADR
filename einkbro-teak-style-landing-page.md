2026-08-07

# EinkBro: Teak-Style Docs Landing Page

The docs site's home page (`docs/index.html`) was a centered text hero — app name, tagline, and two generic buttons (User Guide / Download) — with the actual download links buried a click away. It has been redesigned after teakbrowser.app's landing page: a clean two-column hero that puts the real download actions and a device screenshot in the first viewport.

## What changed

**Hero.** Left column: title, tagline, a one-sentence pitch, and two rows of download buttons — the store buttons first (Google Play Store, Apple App Store, solid style), then the sideload row (GitHub Releases, GitHub Pre-release, F-Droid, outlined and smaller). Everything a visitor needs to install the app is visible without scrolling, on desktop and phone. Right column: a real start-page screenshot captured from a Hisense A7 (with status bar, so it reads as a genuine device screen).

**Phone bezel in pure CSS.** The screenshot sits in a frame drawn with a uniform 12px ink border, 34px outer radius, and `overflow: hidden`, which clips the image to the border's inner edge so the screen corners stay concentric circles with the outer shell. An asymmetric bezel (thicker forehead/chin, like classic phones) was tried first and abandoned: with unequal border widths the inner corner can either be circular (then the bezel band isn't parallel to the outer curve) or a parallel ellipse (then the screen corner looks squished) — both read as fake, which is why real all-screen phones have uniform bezels. Because the bezel is CSS rather than a pre-composited image, the screenshot can be recaptured and swapped as a bare PNG (`docs/images/hero_screenshot.png`, 900×1800) with no image editing.

**Features section.** The old "Screenshots" thumbnail gallery became "Features": each of the 12 screenshots now carries a bold title and a one-line description placed *above* the image (below-the-image captions made it ambiguous which text belonged to which screenshot). The caption text is plain — no card box — and the screenshot itself gets the rounded-corner-plus-hairline treatment, matching the reference site. Markup keeps `<img>` before `<figcaption>` for semantics; `flex-direction: column-reverse` flips the visual order.

**Less distraction.** Hover effects (background wash + border thickening) were removed from the six feature cards on the home page and from the download/bug-report cards — decorative motion that fights the e-ink editorial aesthetic the site is going for.

The zh-tw page received the identical structure with translated copy, sharing the same stylesheet and hero image.

## Notes

- The responsive behavior was verified at 1440px, ~500px, and a true 390px viewport. Headless Chrome enforces a ~500px minimum window width and silently crops narrower `--window-size` requests, so the 390px check was done by rendering the page inside a 390px-wide iframe (media queries follow the iframe's viewport).
- The hero screenshot was captured over adb (`screencap`) because the sim-use Android bridge in the Homebrew 0.10.0 install currently fails at `android init` with a missing resource bundle.
