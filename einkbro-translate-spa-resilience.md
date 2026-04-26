# einkbro — In-place translation survives SPA re-renders and lazy hydration

## Problem
On `news.daum.net` (and similar SPA news sites) configured to auto-translate via OpenAI in-place, the page kept showing the original Korean. The pipeline appeared to fire — translation requests went out and many were even cache hits — but the visible text never changed.

## Root Cause
Three independent bugs stacked on the same path:

1. **Multiple `onPageFinished` callbacks per load.** WebView's docs explicitly state `onPageFinished` may fire repeatedly when the page does client-side navigation. daum.net pushes a hash route (`#1`) and then triggers `location.reload()`; the WebView fires `onPageFinished` 4-5 times per user load, alternating URL between `/tech` and `/tech#1` and bouncing through `progress=10/80/100`. The first call fires while the page is essentially empty. `translate_by_paragraph.js` was a hidden toggle: first call marks elements, second call swaps `body.innerHTML` back to `originalInnerHTML` and stashes the in-flight (still untranslated) DOM as `translatedInnerHTML`. By the time async OpenAI responses came back, the original element IDs were no longer in the DOM.

2. **`IntersectionObserver` doesn't reliably fire for elements already visible at observation time.** When markers were attached after lazy hydration completed, the visible top-of-page navigation links never got "intersection" callbacks even though they were on screen. Combined with (1) above, even content the user *could* see often didn't translate.

3. **SPA element replacement losing translations between request and response.** daum.net's framework recreates nav/article elements during normal interaction. `myCallback(elementId, …)` did `document.getElementById(id)`; if the framework replaced the element after the request was sent, the lookup returned `null` and the translation was discarded silently. Three identical cache-hit log entries for "연예" with no resulting translation made this visible in logcat.

## Solution
Three layered fixes, one per bug:

1. **Make the JS idempotent and gate on real completion.**
   - `translate_by_paragraph.js`: dropped the toggle. Re-runs are no-ops when state is consistent; if `body.classList.contains("translated")` but no `.to-translate` markers exist (page wiped them via SPA hydration), reset and re-translate from scratch. `fetchNodesWithText` now skips already-marked subtrees and skips children with `class="translated"` (those are the by-paragraph mode's translation-output `<p>` siblings — re-marking them caused recursive translation of translations).
   - A `MutationObserver` re-runs the marker scan with a 300ms debounce as new content streams in.
   - `WebContentPostProcessor` only calls `showTranslation()` when `view.progress >= 100`, suppressing the early `progress=10/80` callbacks that would otherwise mark a near-empty page.

2. **Initial visibility scan in `bindObserverToTargets`.** After observing each new marker, immediately check if it's already on screen (with the same 400px rootMargin as the IntersectionObserver). If so, kick off the translation directly. Tracked via a `_translateRequested` `WeakSet` to prevent double-fires.

3. **Text-based fallback for `myCallback`.** Plumbed `originalText` through `JsWebInterface.evaluateJavascript("$callback('$id', '$origText', '$translation')", …)` so the JS-side handler can recover. When `getElementById` returns `null`, scan `.to-translate:not([data-original-html])` for any element whose normalized text matches the original; apply the translation to that one. A `_translateTextCache` keyed on normalized text also lets future re-renders apply translations instantly without a native round-trip.

## Key Files
- `app/src/main/assets/translate_by_paragraph.js` — idempotent script; MutationObserver; skip-translated-siblings guard.
- `app/src/main/assets/text_node_monitor.js` — initial visibility scan; text-cache; text-match fallback in `myCallback`.
- `app/src/main/java/info/plateaukao/einkbro/browser/JsWebInterface.kt` — pass `originalText` to the JS callback.
- `app/src/main/java/info/plateaukao/einkbro/browser/WebContentPostProcessor.kt` — gate auto-translate on `progress >= 100`.

## Lessons Learned
- **WebView's `onPageFinished` is not a single "load complete" signal.** For client-side-routed pages it can fire many times at varying progress. Either gate on `progress == 100` and design the JS to be re-entrant, or use Page-domain CDP events directly. Don't trust a single `onPageFinished` to mean the page is done.
- **`IntersectionObserver` initial-fire timing is unreliable for elements observed when they're already intersecting.** Especially right after `MutationObserver`-driven mutations. Always pair with an explicit visibility scan if you can't tolerate missed entries.
- **Element IDs are not durable on SPA pages.** Any "request → async callback → look up by ID" pattern is fragile. Pass enough context (here: `originalText`) to recover when the ID is gone, and keep a JS-side cache so re-renders don't pay the round-trip again.
- **Hidden toggle behaviour in shared code is dangerous.** The original `translate_by_paragraph.js` flipped state every invocation — fine for explicit user re-tap, catastrophic for any automatic re-injection. If you need both modes, separate them rather than overload by call count.
