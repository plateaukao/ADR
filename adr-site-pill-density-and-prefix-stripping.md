# ADR Site: Tighter Pills and Title Prefix Stripping

## Problem
In the calendar viewer (`docs/`), each entry was rendered as a "pill" containing an uppercase project label followed by the title — e.g. `MANDROID_FINDER track-devices event stream`. Two related issues:

1. In month view the cells are narrow (six per row, plus weekend slots), so the project label could swallow most of the width before the title even started, leaving titles aggressively truncated.
2. In every view the title text very often *also* started with the project name (`einkbro: Foo`, `EinkBro — Foo`, `mmgo-mac — ...`), so the project was effectively shown twice — once in the colored label and again as the first word of the title.

## Root Cause
`appendPills` always rendered `<span class="proj">{project}</span>{title}` for every view. ADR titles in `manifest.json` were authored independently of the viewer and tend to lead with the project name as a human-readable prefix. Neither concern had a render-time mitigation.

## Solution

### Compact month-view pills
`appendPills` now takes an `opts.compact` flag. Month view passes `compact: true`, which:

- Drops the `<span class="proj">` text entirely; the project is communicated by the colored `border-left` and the hover tooltip (`{project} — {title}`).
- Adds `.pill-compact { border-left-width: 4px; padding-left: 8px }` so the color stripe stays as a strong-enough signal without the text.

Week, day, and list views keep the full project label since they have room.

### Strip the duplicate project prefix from titles
A small helper `stripProjectPrefix(title, project)` removes a leading occurrence of the project name plus optional separator. It is applied to *all* views (month, week, day, list), because in every view the project is already shown as a separate label or color.

The separator regex is intentionally conservative:

```js
new RegExp(`^${escaped}(?:\\s*[:—–]|\\s+-)?\\s+`, "i");
```

- Matches: `einkbro: Foo`, `EinkBro — Foo`, `einkbro - Foo`, `einkbro Foo` (case-insensitive).
- Does **not** match: `mmgo-mac — Initial SwiftUI App` (project is `mmgo`). The plain hyphen here is not preceded by whitespace, so neither the `[:—–]` branch nor the ` -` branch consumes it, and the trailing `\s+` cannot match a hyphen either. The title is left intact.
- If the regex would strip the entire title (e.g. degenerate input), `|| title` falls back to the original.

The viewer still receives the original title in the hover tooltip and in the entry detail page.

## Key Files
- `docs/app.js` — added `stripProjectPrefix`; gave `appendPills` an `opts.compact` mode that omits the project span and uses a richer tooltip; applied stripping in `appendPills` (month/week/day) and in `renderList` (list view).
- `docs/style.css` — added `.pill-compact { border-left-width: 4px; padding-left: 8px }`.

## Lessons Learned
- When the same data has two visual encodings (a colored stripe *and* a text label), one of them is usually doing the real work; in narrow layouts you can drop the redundant one and lean on the survivor by making it slightly more prominent.
- Title prefixes that duplicate a sibling label are easier to fix at render time than to police at authoring time. A small, conservative stripper is preferable to one that "tries hard" — leaving an occasional duplicated prefix untouched is much better than mangling a title like `mmgo-mac — ...` into `mac — ...`.
- For substring matching against authored data, anchor on real separators (`:`, em/en dashes, whitespace-bounded hyphens) rather than allowing any non-letter run, so hyphenated identifiers stay intact.
- Keeping the original title in the tooltip and entry view is a cheap insurance policy: even if the stripping rule misfires for a future title format, the canonical text is one hover or click away.
