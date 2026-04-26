---
project: einkbro
commit: 485c8cab
date: 2026-04-23
---

# einkbro — OpenAI In Place translation was breaking page layout

## Problem

After invoking "OpenAI In Place" (or "Gemini In Place") translation on a page, the web layout was visibly mangled: paragraphs gained large vertical gaps, and on complex list pages (e.g. livedoor News) each article card's title/date text was wrapped into narrow vertical columns overlapping its image and the next card.

## Root Cause

Two separate bugs in the shared JS injected for in-place translation.

1. **Unused placeholder `<p>` elements added between every paragraph.**
   `translate_by_paragraph.js:injectTranslateTag` always inserts an empty `<p>` after each to-be-translated element, because the *non-in-place* flow writes the translated text into that sibling `<p>`. The non-replace variant `WebViewJsBridge.translateByParagraphInPlace` hides those placeholders via injected CSS (`.to-translate + p:not(.translated) { height:0; ... }`). But the Replace variant `translateByParagraphInPlaceReplace` — used by OPENAI_IN_PLACE / GEMINI_IN_PLACE — injects no CSS, and the in-place branch of `myCallback` never populates the placeholder, so every `<p>` stayed empty with default `<p>` margin (~1em top + 1em bottom), doubling vertical spacing across the page.

2. **Whitespace text nodes rewritten as visible characters.**
   `translate_by_paragraph.js:shouldTranslateAsBlock` only inspects an element's **direct** children for block-level tags. A livedoor article card is `<li><a style="display:flex"><div class="image"><img></div><div class="body"><h3>title</h3><time>date</time></div></a></li>`. The `<li>`'s only direct child is `<a>` (treated as inline), so the whole `<li>` was tagged as a single translatable block. `text_node_monitor.js:myCallback` then walks *every* text node inside with a TreeWalker — including pure-whitespace text nodes sitting between flex children (`\n    ` between `<div.image>` and `<div.body>`) — and splits the translated response proportionally across all of them. Those whitespace nodes became visible Chinese characters, which in a `display:flex` container render as anonymous flex items and push the real `<div>` children into narrow columns. DOM inspection confirmed the `<li>` stayed at 76px height while its `<a>` grew to 117px and overflowed into the next card.

## Solution

Two small JS-only changes:

- `translate_by_paragraph.js` — early-return in `injectTranslateTag` when `window._translateInPlace` is true; the placeholder `<p>` is only needed by the non-in-place flow.
- `text_node_monitor.js` — in the in-place branch of `myCallback`, filter the TreeWalker's output to skip text nodes whose `textContent.trim()` is empty. Source-formatting whitespace is preserved and no longer turns into visible characters that participate in flex/block layout.

No Kotlin changes; the fixes are pure JS assets shipped in the APK.

## Key Files

- `app/src/main/assets/translate_by_paragraph.js` — guard placeholder `<p>` insertion behind `!_translateInPlace`
- `app/src/main/assets/text_node_monitor.js` — skip whitespace-only text nodes in the in-place walker
- `app/src/main/java/info/plateaukao/einkbro/view/WebViewJsBridge.kt` — context: `translateByParagraphInPlaceReplace` (no CSS), `translateByParagraphInPlace` (CSS injected)
- `app/src/main/java/info/plateaukao/einkbro/activity/delegates/TranslationDelegate.kt` — context: `OPENAI_IN_PLACE`/`GEMINI_IN_PLACE` → `translateInPlaceReplace` routing

## Lessons Learned

- **Visual-only bugs benefit enormously from live DOM inspection.** Screenshots alone suggested "extra vertical margin" (bug #1), which I fixed — but the real damage (bug #2) only became visible after attaching via `chrome://inspect` → DevTools CDP (`adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>`) and running `Runtime.evaluate` to dump element rectangles, computed styles, and `data-original-html`. The data showed `<li>.height=76, <a>.height=117` — obvious overflow — in a way screenshots never could.
- **TreeWalker with `SHOW_TEXT` includes whitespace-only nodes.** When you intend to mutate "content", filter these out explicitly. Treating whitespace as content is a latent footgun whenever the surrounding context is a flex/grid container, because anonymous flex items materialize out of bare text.
- **Checking only direct children for structural decisions is brittle.** `shouldTranslateAsBlock`'s direct-children check misclassified containers whose sole direct child is an `<a>` wrapping block content. A deeper `querySelector(blockTags.join(','))` check would be more accurate, but was out of scope for this fix since the whitespace-skip already prevents the visible damage.
- **Two code paths sharing the same JS but one injecting CSS and one not** is a fragile pattern. Whenever `translate_by_paragraph.js` is re-used, mirrored invariants need to hold in both call sites. The placeholder-skip guard makes the JS self-sufficient regardless of whether CSS was injected.
