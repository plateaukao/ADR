2026-08-06

# ADR site: 192×192 transparent favicon

Follow-up to [einkbro-ios-favicon-size-ranking](einkbro-ios-favicon-size-ranking.md). After EinkBro iOS started ranking favicon candidates by declared size, the ADR site's best candidate became its `apple-touch-icon.png` — which, per Apple convention, is fully opaque with a near-white background baked in (iOS fills transparent home-screen icon regions with black, so generators bake a background). The result: a crisp icon sitting on a white tile that stands out against dark tab rows.

The site previously offered nothing both large *and* transparent: an SVG (browsers without SVG icon support skip it, and EinkBro can't decode SVG), transparent 32/16 px PNGs, and the opaque 180 px touch icon.

The fix adds `favicon-192.png` — rendered from `favicon.svg` at 192×192 with transparency preserved (via a small AppKit script; no SVG rasterizer CLI was installed) — declared as:

```html
<link rel="icon" type="image/png" sizes="192x192" href="favicon-192.png" />
```

192 px is the conventional PWA icon size. In EinkBro's ranking it lands in the ≥48 px bucket, ahead of the apple-touch icon, so the app now stores a crisp *and* transparent icon; other browsers that honor `sizes` benefit the same way. Existing stored icons self-heal on the next visit — no app change or reinstall involved.
