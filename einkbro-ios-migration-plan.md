2026-07-16

# EinkBro iOS: feature-migration plan adopted

With the Compose UI port proven on the simulator, the next arc — turning the
catalog into a real browser — needed its platform decisions made before code.
The adopted plan lives in the repo (`docs/MIGRATION_PLAN.md`) as a feature-parity
matrix over the complete Android browser-layer inventory; this ADR records the
decisions that shape everything downstream.

## Decisions

1. **The web layer is a seam.** Android's `EBWebView` is mostly a dispatcher
   into ~40 JS/CSS assets. iOS gets a `WebViewEngine` interface in `commonMain`
   with a WKWebView actual; the JS assets ship unchanged as compose resources
   and are installed as `WKUserScript`s. A small JS prelude maps the existing
   `@JavascriptInterface` global names onto `webkit.messageHandlers`, so asset
   scripts need no edits.

2. **Accept the `shouldInterceptRequest` gap explicitly.** WKWebView has no
   per-request hook, which forces three divergences, chosen up front:
   ad-blocking moves from the Brave C++ engine to compiled `WKContentRuleList`s
   (EasyList converted, cosmetic rules via injected CSS); e-ink DEEP image
   re-encoding is dropped in favor of the existing FAST CSS-filter mode; custom
   font serving moves to a `WKURLSchemeHandler`.

3. **Persistence bottom-up, API-stable.** The in-memory `SharedPreferences`
   shim gets an `NSUserDefaults` backing (the ported preference layer doesn't
   change); the no-op Room annotation shim is replaced by real Room KMP 2.7
   with the same 14-entity schema. No cross-platform data migration — fresh
   platform, same shape.

4. **Networking to Ktor in common.** OkHttp/Jsoup usages (translation, OpenAI/
   Gemini SSE, Edge-TTS WebSocket, Instapaper, userscript fetch) become Ktor
   Darwin, shared, so service code stops being platform code.

5. **Known drops, documented not discovered:** volume-key paging (no iOS API),
   MHT open (webarchive instead), Android intent integrations (Pocket,
   colordict), forceDark (CSS-filter dark mode instead).

## Sequencing

```mermaid
flowchart LR
    P1[1 Browser shell WKWebView tabs toolbar] --> P2[2 Persistence NSUserDefaults plus Room KMP]
    P2 --> P3[3 Content pipeline reader vertical fonts filters]
    P3 --> P4[4 Privacy adblock incognito per-site]
    P4 --> P5[5 Interaction selection menus gestures]
    P5 --> P6[6 Services translate TTS AI]
    P6 --> P7[7 Files export PDF epub backup]
    P7 --> P8[8 Platform polish share scheme iPad]
```

Each phase exits through the same gate: build green, simulator verification
pass, commit + ADR. Phase 1 (browser shell) starts immediately.
