# blog: Migrate Medium archive to self-hosted Hugo site on GitHub Pages

## Problem

Medium account export at `~/Downloads/medium-export/` held 262 published posts (2018-06 → 2026-04) plus 30 drafts and ~1,200 embedded images. The user wanted off Medium, hosted on GitHub Pages, with the post archive intact and self-contained (no reliance on Medium's CDN).

## Root cause / motivation

Two-fold:
- Vendor lock-in: Medium controls URLs, paywalls articles, and could rotate or remove CDN-hosted images at any time.
- Maintenance: a static site on GitHub Pages costs nothing, builds in seconds, and the content is just files in a git repo.

## Solution

**Stack:** Hugo (extended) + PaperMod theme via git submodule, deployed by `actions/deploy-pages` from `main`. Hugo wins over Jekyll/Astro for this use case — single Go binary, sub-second builds for ~260 posts, native CJK support, zero npm/Ruby toolchain to maintain.

**Conversion:** one Python script (`scripts/convert_medium.py`) parses each `posts/*.html` from the export and produces a Hugo-flavored markdown file plus a directory of locally-downloaded images. Key transforms:
- Title / date / canonical URL pulled from Medium's microformat markup (`h1.p-name`, `time.dt-published`, `a.p-canonical`).
- Body content limited to `section[data-field="body"]` to drop the chrome.
- `<img class="graf-image">` URLs rewritten to `/images/<medium-id>/<filename>`; downloads happen serially in a second pass after all posts are converted (Medium's CDN rate-limits parallel hits hard, returning 403s that wedge the connection until the session is recreated).
- Medium "mixtape embed" cards → plain `[title](url)` links.
- Gist embed `<script>` tags → `[View gist](url)` links.
- Slug derivation: ASCII titles use Medium's canonical slug; CJK titles fall back to the title itself with unicode word characters preserved (browsers percent-encode in URL bar but Hugo+Pages serve them fine).
- Leading `<hr>` divider and duplicate `<h3 graf--title>` that Medium prepends to every body get stripped before output.

**Hugo config:** `canonifyURLs = true` so absolute `/images/...` paths in markdown get the `/blog/` baseURL prefix at render time. `hasCJKLanguage = true` for proper Chinese word-counting and reading-time.

## Key files

- `~/src/blog/scripts/convert_medium.py` — the converter (262 posts, 1204 images, 0 failures on first full run)
- `~/src/blog/hugo.toml` — site config; baseURL = `https://plateaukao.github.io/blog/`
- `~/src/blog/.github/workflows/deploy.yml` — Hugo (pinned 0.161.1) → Pages deploy
- `~/src/blog/themes/PaperMod` — submodule pinned to a specific commit
- `~/src/blog/content/posts/*.md` — generated, frontmatter has `mediumID` + `canonicalURL` for traceability

## Lessons learned

- **Medium CDN throttles aggressively**, but only on the *path* `/max/<size>/...`; once redirected to `/v2/resize:fit:<size>/...` the response is 200. Crucially, hitting it with multiple parallel workers caused persistent 403s that survived per-request retries — the fix was sequential downloads with `SESSION.close() + make_session()` on each 403 to drop pooled connections. Don't assume "just add a retry" is enough; some rate limiters poison the whole TCP session.
- **Medium's HTML export is well-structured but lies a little.** It always prepends a `<hr>` and a duplicate `<h3 graf--title>` to the body, so naive markdownify produces every post starting with `---\n### Title\n` before the actual lede. Strip both. The duplicate title may also use `\xa0` non-breaking spaces where the `<h1>` used regular spaces, so compare normalized whitespace, not raw equality.
- **Picking slugs for CJK posts**: Medium's canonical URL slug for non-ASCII titles is the URL-encoded UTF-8 bytes spelled out as lowercase hex (eg `e5889de68ea2-...`), which is unreadable. Detect non-ASCII titles and slug from the title directly instead — keep the unicode characters; Hugo and GitHub Pages handle them correctly.
- **PaperMod requires a recent Hugo.** Brew's `hugo` was at 0.110, PaperMod needs ≥ 0.146. Pin the version in the GitHub Actions workflow so CI doesn't drift.
- **`canonifyURLs = true` is mandatory** when GitHub Pages serves the site under a sub-path (`/blog/`). Without it, absolute `/images/...` markdown paths render as `/images/...` in HTML and 404 in production while working locally with `--baseURL=/`.
