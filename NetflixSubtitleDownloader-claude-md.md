# NetflixSubtitleDownloader — add CLAUDE.md

## Summary

Added a `CLAUDE.md` to give future Claude Code sessions the architectural
context that can't be inferred from a directory listing — specifically the
three-execution-context design and the sessionStorage-based batch state machine
that span multiple files.

## Approach

This is a no-build Chrome MV3 extension (raw JS loaded directly by Chrome, no
package manager, no tests, no lint), so the doc skips build/test tooling and
focuses on the non-obvious cross-file mechanics:

- **The three isolated worlds.** Why `inject.js` runs in the page context
  (monkeypatching `JSON.parse`/`stringify`/`fetch`/`XHR` to capture subtitle
  manifests that never hit the DOM), why it reads `localStorage` instead of
  `chrome.storage`, and how it talks to `content.js` via `CustomEvent`.
- **Batch downloads as a sessionStorage state machine.** There is no service
  worker; multi-episode jobs survive full-page navigations by persisting
  progress and `window.location =`-ing to the next episode.
- **The composite language-string data model** (`en[cc]`, `zh-Hant-forced`) that
  is the user-facing identifier everywhere.
- **The settings-threading gotcha:** a new setting must be copied into
  `DEFAULTS` (popup), `settings` (content), and `localStorage` if inject.js needs
  it.

## Trade-offs

- Documents architecture rather than an exhaustive file map, to stay useful as
  the code evolves and avoid restating what a listing already shows.

## Key Files

- `CLAUDE.md` — new.
