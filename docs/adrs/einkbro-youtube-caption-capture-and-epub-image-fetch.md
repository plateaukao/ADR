# einkbro: harden YouTube caption capture and EPUB image fetch

> **Status:** partially fixed. Single-language YouTube caption capture and
> save-to-epub image-fetch hangs are resolved. Dual-language caption merging
> on Supernote still fetches only the original-language track.

## Problem

Two intertwined bugs surfaced while testing save-to-epub on a Supernote:

1. **Save-to-epub stalled at 5% on pages with images** (e.g. Daum news
   articles). The progress bar reached 5% and never advanced.
2. **Saved EPUBs contained no caption text on YouTube videos**, even when
   captions were visible on screen. Often, captions on YouTube would briefly
   stop displaying altogether after we toggled CC on.

Symptom (1) blocked the flow on the Supernote but not on a Pixel emulator.
Symptom (2) was Supernote-specific in severity but had a code-level root
cause that would affect any device with a non-Pixel-like WebView UA.

## Root Cause

Three independent issues, all with the same flavor — incomplete or wrong-
shaped network plumbing:

- **`BookmarkRenderer.getResourceAndMimetypeFromUrl` set only
  `connectTimeout`, not `readTimeout`.** Once the TCP handshake succeeded,
  `connection.inputStream.readBytes()` would block until the server finished
  sending bytes. With a slow CDN and a 4-thread image pool, all four threads
  could be tied up trickling, freezing `saveImageResources` (and therefore
  the EPUB save) indefinitely. EpubManager calls this with `timeout = 5000`,
  intending a 5-second cutoff per image; without `readTimeout` that cutoff
  only governed connect.

- **`DualCaptionProcessor.fetchWithCookies` had the same
  `readTimeout` gap**, plus a hardcoded `User-Agent: ... Chrome/120.0.0.0
  ...`. YouTube's `timedtext` URLs include a per-session `signature=...` /
  `pot=...` token that's validated against the request originator's
  fingerprint. The player fetches the URL with the WebView's actual UA and
  the response is accepted. Our refetch via `HttpURLConnection` uses our
  hardcoded UA, which on a Pixel-class device is similar enough that the CDN
  doesn't care, but on Supernote (older WebView, vendor strings) sits far
  enough from "what the signature was issued for" that the CDN throttles or
  drips bytes — the response either never finishes (with no read timeout)
  or comes back empty.

- **`DualCaptionProcessor.processUrl` returned `null` on any merge
  failure when `dualCaptionLocale` was set.** When the second-language
  fetch returned bytes that wouldn't decode (timeout, malformed, throttled),
  the catch block discarded *everything*, including the original-language
  caption that had fetched fine. The result: `dualCaption` never got
  populated, EPUB save fell through to the empty reader-mode HTML, and the
  saved chapter was effectively empty.

A separate ergonomics issue was that the SPA-reset commit from earlier
(navigation triggers `dualCaption = null`) was wiping captures mid-playback.
YouTube continuously rewrites the URL with `&t=Ns` / `&pp=...` as the user
plays/seeks; each rewrite fired `doUpdateVisitedHistory(differentUrl)`,
which my equality check on raw URLs treated as "different page" and cleared
the just-captured caption.

## Solution

1. `BookmarkRenderer.getResourceAndMimetypeFromUrl`: when `timeout > 0`, set
   both `connectTimeout` and `readTimeout`.
2. `DualCaptionProcessor.fetchWithCookies`:
   - Set `readTimeout = 10_000` alongside `connectTimeout`.
   - Accept an optional `requestHeaders: Map<String, String>?`. When given,
     mirror the player's headers (User-Agent, Accept-Language, etc.),
     skipping hop-by-hop headers, `Cookie` (set fresh from CookieManager),
     `Accept-Encoding` (lets HttpURLConnection auto-decompress gzip), and
     conditional-fetch headers (avoid 304s).
   - `NinjaWebViewClient.shouldInterceptRequest` (the modern overload) now
     pipes `request.requestHeaders` through `handleWebRequest` →
     `processUrl` → `fetchWithCookies`.
3. `DualCaptionProcessor.processUrl`: fetch the original caption *first*,
   keep it as `rawCaption`, then attempt the dual-language merge. If the
   merge throws, return `String(rawCaption)` instead of `null`, so capture
   succeeds with the original-language caption and the player still gets a
   valid response body to display.
4. `NinjaWebViewClient.doUpdateVisitedHistory`: compare a normalized
   "navigation key" (scheme + host + path + YouTube `v=`) instead of the
   raw URL. YouTube's per-second URL rewrites no longer trigger a
   caption-clear; clicking through to a different video still does because
   the `v=` parameter changes.

## Key Files

- `app/src/main/java/info/plateaukao/einkbro/unit/BookmarkRenderer.kt`
- `app/src/main/java/info/plateaukao/einkbro/caption/DualCaptionProcessor.kt`
- `app/src/main/java/info/plateaukao/einkbro/browser/NinjaWebViewClient.kt`

## Outstanding

- **Dual-language caption merging on Supernote still doesn't work in
  practice.** Header forwarding fixed the original-language refetch, so
  single-language capture and EPUB save now succeed. The second-language
  fetch (`&tlang=...`), however, still doesn't produce a usable response on
  Supernote — the merge falls into the catch block and we save the
  original-language caption alone. Next investigation should:
  - Log the second-fetch HTTP status / body length on Supernote.
  - Try translating the original-language JSON locally (using a chosen
    translation provider) instead of relying on YouTube's `tlang` endpoint.
  - Or: drop the player-redirect path entirely for the second locale and
    use the WebView's own translation pipeline post-capture.

## Lessons Learned

- "Set the connect timeout" is rarely enough. Any `HttpURLConnection` that
  reads a response body must also set `readTimeout`, otherwise a slow
  trickle of bytes blocks the calling thread until the OS gives up.
- Forwarding request headers to a backend refetch is correct for signed
  URLs (caption tracks, presigned S3 URLs, etc.) but you must filter:
  - `Accept-Encoding` disables `HttpURLConnection`'s transparent gzip and
    silently breaks downstream consumers.
  - Hop-by-hop headers (`Connection`, `Transfer-Encoding`, `Host`,
    `Content-Length`) are set by the client and rejected if forwarded.
  - Conditional-fetch headers (`If-None-Match`, `If-Modified-Since`) can
    yield a 304 with an empty body, which is correct HTTP but useless when
    you need the bytes.
- When a try/catch wraps a multi-step pipeline, returning `null` from the
  catch loses earlier successes silently. Carry partial state forward and
  return the most useful subset on failure.
- Clearing per-page state on every `doUpdateVisitedHistory` requires
  normalizing the URL — modern web apps rewrite the URL constantly via
  `replaceState`, and any state keyed off raw-URL equality will churn.
