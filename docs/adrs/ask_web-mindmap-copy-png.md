# ask_web — copy mindmap as PNG

## Summary

Adds an outlined copy icon to the mindmap toolbar in both the in-page floating panel (content script, inside Shadow DOM) and the full-tab mindmap view. Clicking it rasterizes the SVG to PNG and writes it to the clipboard via `navigator.clipboard.write` + `ClipboardItem`, so the mindmap can be pasted into Mac Notes, docs, chat, etc.

## Approach

Shared helpers live in `utils.js` (loaded in both renderer contexts): `svgElementToPngBlob(svg, bgColor)` and `copySvgToClipboardAsPng(svg, bgColor)`. The toolbar item registers the same way in both places via markmap's `Toolbar.register` API, ordered between `recurse` and `fullscreen` in the panel, last in the full-tab view.

The icon uses markmap's `Toolbar.icon(path, attrs)` factory with `stroke: currentColor; fill: none` to switch from the toolbar's default filled style to a 1.5px outlined two-rectangle copy glyph. The back rectangle is drawn as an open L-shape so it reads cleanly behind the fully-outlined front rectangle.

The non-obvious design constraint is that **Chromium taints any `<canvas>` drawn from an SVG containing `<foreignObject>`** — Blink intentionally flips the origin-clean flag because foreignObject's embedded HTML can pull in fonts/styles/etc. that constitute a side channel. Markmap renders every node label as a foreignObject wrapping XHTML (see `vendor/markmap-view.js:1222-1223`), so the obvious `XMLSerializer → <img> → drawImage → toBlob` chain fails with `SecurityError: Tainted canvases may not be exported`. No permission or flag bypasses this; it's a security boundary in every Chromium browser.

The workaround is `flattenSvgForeignObjects(svgEl, textColor)`: before rasterizing, walk the cloned SVG and replace each foreignObject with a native SVG `<text>` element using its `x`/`y` and `textContent`. Styling is applied via an injected `<style>` block at the top of the cloned SVG so the rasterizer sees a self-contained document.

For the clipboard write itself: `navigator.clipboard.write` consumes transient user activation at call time, so long async chains can blow the 5s window. The shared helper completes flatten + rasterize well under that, so a plain `await` chain works. For longer operations the same helper can be restructured to pass `Promise<Blob>` directly to `ClipboardItem`.

Error messages from rasterization/clipboard failures surface in the toolbar item's `title` tooltip (in addition to `console.error`), so future failures are debuggable without DevTools.

## Trade-offs

- **Inline label formatting in the PNG becomes plain text.** Bold, italic, code, and links inside node labels render as plain text. Layout, node positions, edges, colors, and the overall tree structure are unchanged. Acceptable for Ask Web's typical use (summaries from web pages where labels are short bullets).
- **Long wrapped labels collapse to a single line** since native SVG `<text>` doesn't wrap. Rare with markmap's defaults (`--markmap-max-width: 9999px`).
- **Requires `clipboardWrite` permission** in manifest.json for the full-tab mindmap page. The in-page panel inherits the host page's activation and would work without it, but the permission is set globally for consistency.

## Key Files

- `utils.js:404-490` — `flattenSvgForeignObjects`, `svgElementToPngBlob`, `copySvgToClipboardAsPng`. Reusable for any SVG-to-PNG-clipboard need, not just markmap.
- `mindmap.js:33-50` — `copyPng` toolbar item for the full-tab view; bg color resolved from `--bg` on `:root`.
- `content.js:1236-1252` — same toolbar item for the floating-panel mindmap; bg color resolved from `--bg-secondary` on the shadow-DOM host (`floatingWindow`).
- `content.js:1284-1288` — `flashMindmapTitle` helper for transient tooltip feedback ("Copied!" / "Copy failed: …").
- `manifest.json:6-12` — adds `clipboardWrite` to permissions.
