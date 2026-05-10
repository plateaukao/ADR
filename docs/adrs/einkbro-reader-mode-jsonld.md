# einkbro — reader mode uses JSON-LD to pick the correct article container

## Problem

On certain news sites, reader mode rendered the wrong article: the header (title, byline) matched the page the user opened, but the body text belonged to a different article embedded on the same page.

## Root Cause

Some news sites embed **two full article bodies** in one DOM — the real article plus an inline "sponsored/advertorial" section, each with its own `<section>` / `article-body` container.

Mozilla Readability's `_grabArticle()` scores content blocks by text density and picks the highest scorer. When the advertorial is longer than the real article (common, since sponsored content tends to be padded), it wins. Title, byline, and excerpt still come out correct because they're sourced from `<meta>` / JSON-LD on the page — which is exactly why the mismatch was easy to miss.

## Solution

Use JSON-LD only to **identify** the correct article's DOM container, then let Readability parse that container's real HTML. An earlier attempt used JSON-LD's `articleBody` directly as reader-mode content, but `articleBody` is defined by schema.org as plain text — so it contains no images, headings, links, or block structure. Synthesizing `<p>` from plain text stripped the entire article layout.

- New asset `app/src/main/assets/jsonld_article.js` exposes `window.getReadabilityScopedDocument()`:
  - Walks `<script type="application/ld+json">` tags (single objects, arrays, `@graph` wrappers) and finds an entry whose `@type` is one of `NewsArticle` / `Article` / `BlogPosting` / `ReportageNewsArticle` / `OpinionNewsArticle` / `ReviewArticle` / `TechArticle` / `ScholarlyArticle` / `BackgroundNewsArticle` / `AnalysisNewsArticle`.
  - Takes the first ~80 normalized characters of `articleBody` as a signature, then scans candidate containers (`[itemprop="articleBody"]`, `article[id]`, `section[id*="article"]`, `[class*="article-body"]`, etc.) for the deepest element whose `innerText` contains the signature.
  - Builds a minimal `HTMLDocument` containing:
    - `<base href>` so relative URLs resolve,
    - copied `og:*` / `twitter:*` / `description` / `author` / `canonical` meta tags and JSON-LD scripts, so Readability's metadata extractor still derives title/byline/siteName correctly,
    - the cloned target container wrapped in `<article>`.
  - Returns `null` if no JSON-LD or no matching container — caller falls back to the original `document.cloneNode(true)`, preserving pre-change behavior on sites without matching structured data.
- `WebViewJsBridge.kt` loads `jsonld_article.js` alongside `MozReadability.js` in both `evaluateMozReaderModeJs` and `injectMozReaderModeJs`. The three JS templates (`replaceWithReaderModeBodyJs`, `getReaderModeBodyHtmlJs`, `getReaderModeBodyTextJs`) now pick `getReadabilityScopedDocument() || document.cloneNode(true)` as the document passed to `new Readability(...).parse()`.
- Side hardening: viewport `setAttribute` is guarded. Previous code called `document.getElementsByName('viewport')[0].setAttribute(...)` which threw `TypeError: Cannot read properties of undefined` on pages without a viewport meta, aborting the rest of the script.

## Key Files

- `app/src/main/assets/jsonld_article.js` (new) — `getReadabilityScopedDocument()` helper.
- `app/src/main/java/info/plateaukao/einkbro/view/WebViewJsBridge.kt` — asset loading + three JS templates.
- `app/src/main/assets/MozReadability.js` — unchanged; receives the scoped document when available, full document otherwise.

## Lessons Learned

- **JSON-LD `articleBody` is plain text, not HTML.** Per schema.org the field is a text value; most CMSes serialize it without paragraph tags, images, or links. Using it directly as reader-mode content is viable only as a last resort — preserving the DOM's structured HTML is strictly better, so use JSON-LD to *locate* the article, not to *replace* it.
- **Debuggable WebViews ship with DevTools over a unix socket.** `adb shell cat /proc/net/unix | grep webview_devtools_remote_<pid>` → `adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>` → CDP at `ws://localhost:9222/devtools/page/<id>`. Dramatically faster than screenshot-driven debugging for content/JS issues; should be the default for WebView bugs.
- **"Reader mode output looks wrong" is often content-farm layout, not parser bugs.** Metadata (title/byline/excerpt) can stay consistent across a site template even when the visible text block belongs to an adjacent advertorial. Diff `article.textContent` against each on-page article container before blaming Readability's scoring.
- **Readability's "longest high-density block" heuristic is fragile on sites that intentionally inflate ads.** Structured data (JSON-LD, `<meta property="og:...">`, `<article itemtype="...NewsArticle">`) disambiguates because it encodes which article the URL is *for*. Prefer it when present.
- **When feeding Readability a synthesized document, copy head metadata.** A fresh `createHTMLDocument` has no `<title>`, `og:*`, or JSON-LD, so Readability's metadata extractor falls back to the first `<h1>` it sees — which on a scoped article container is often a section heading rather than the article title. Copying `<meta>` / canonical / JSON-LD keeps title/byline/siteName correct.
- **Defensive unwrapping on asset-provided DOM.** `document.getElementsByName('viewport')[0].setAttribute(...)` looked fine for a decade of web-as-it-usually-is, but one viewport-less page disables reader mode entirely. If the rest of the script depends on a DOM lookup succeeding, guard it.
