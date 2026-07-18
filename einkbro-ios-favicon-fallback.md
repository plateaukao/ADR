2026-07-18

# EinkBro iOS: favicon fetching gets candidates, redirect-aware keys, and a grid fallback

Bookmark views showed the generic earth glyph for many sites even after visiting them. Two causes: the favicon fetch was fragile, and for redirecting sites the icon was stored under a host the bookmark lookup never asks for.

On Android, `WebChromeClient.onReceivedIcon` pushes favicons to the app. WKWebView has no equivalent, so the iOS engine resolves an icon URL via injected JS and fetches it — previously a single URL, which often 404'd or pointed at an icon that wouldn't decode. The JS now returns a best-first candidate list: `rel=icon` links last-one-wins (matching Android WebView's pick, which never delivers touch icons), apple-touch-icons demoted to near-last (they bake in a white background), SVG skipped (neither Skia nor ImageIO decodes it), `/favicon.ico` as the conventional final fallback. Kotlin walks the list until one actually decodes to a bitmap, skipping non-2xx responses instead of trying to decode an HTML 404 page.

The keying fix: Android keys favicons by `originalUrl.host` — the pre-redirect host, which is exactly what a bookmark's stored URL holds. `webView.URL` is post-redirect, so a site that redirects (`example.com` → `www.example.com`) filed its icon under a host bookmarks never query. The engine now remembers the requested host at `loadUrl` time and persists the icon under both hosts, consuming the remembered value so a later cross-site link click can't file another site's icon under it.

Finally, the bookmark grid's fallback for icon-less non-folder entries becomes the app launcher icon, matching Android, instead of the earth glyph.
