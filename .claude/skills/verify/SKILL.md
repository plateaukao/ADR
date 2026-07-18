---
name: verify
description: Build/launch/drive recipe for verifying changes to the ADR docs site (docs/app.js, docs/style.css)
---

# Verifying the ADR docs site

The site is static — no build step needed for JS/CSS changes. `docs/adrs/` and
`docs/manifest.json` are CI-generated but checked in, so a local server serves a
working copy of the site as-is.

## Launch

```bash
cd docs && python3 -m http.server 8642
```

## Drive

Open `http://localhost:8642/#<slug>.md` — a bare slug hash opens that ADR
directly in the viewer panel (e.g. `#einkbro-blob-download-csp-bypass.md`).
Find ADRs containing mermaid diagrams with `grep -l '```mermaid' docs/adrs/*.md`.

The Claude-in-Chrome extension may not be connected; Python Playwright is
installed with cached Chromium (`~/Library/Caches/ms-playwright`) and works
headless. Drive with `sync_playwright`, wait for
`#viewer .mermaid-block svg`, screenshot, and check `page.on("console")` for
errors. Pass `color_scheme="dark"` for the dark theme (mermaid theme is picked
at load from `prefers-color-scheme`).

## Gotchas

- `index.html`'s `?v=` cache-busters are re-stamped by `docs/build.sh` in CI on
  push — no need to bump them locally; the local server serves the files fresh.
- Do not run `docs/build.sh` locally or commit `docs/adrs/` / `docs/manifest.json`.
