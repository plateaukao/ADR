2026-08-09

# ADR site: viewer nav top-only, list-view day labels, mobile month counts

Three small declutter/density changes to the calendar site, all aimed at
giving content back the screen space that chrome was eating.

## What changed

**Viewer: prev/next only at the top.** The markdown viewer had ‹ › buttons in
the header *and* a duplicated pair in a footer bar. The footer bought little —
the top buttons and the ←/→ keyboard shortcuts already cover navigation — while
permanently reserving a strip of every article. The `.viewer-foot` block is
gone from `index.html` and its CSS removed. One subtlety: the footer used to
carry the `env(safe-area-inset-bottom)` padding, so with it gone, `#viewer-body`
now includes that inset in its own bottom padding — otherwise the last lines of
an article would sit under the iPhone home indicator.

**List view: one date label per day.** Each row used to lead with a 96px date
column (56px on phones), so a day with five articles printed "May 25" five
times — pure repetition, and on a phone that column was a fifth of the screen.
`renderList` now tracks the day as it walks the (sorted) entries and emits a
single muted `.list-day-label` above the first article of each day; rows became
full-width single-column. The separator line moved with the semantics: it used
to sit between rows, now it sits between days (on the label, suppressed on the
first label after the month heading).

```
before                          after
May 25 | 2x UI scale for Sony   May 25
May 25 | get DPT-CP1 drawing    2x UI scale for Sony
May 25 | pencil.koplugin port   get DPT-CP1 drawing
                                pencil.koplugin port
```

**Month view on phones: a count, not bars.** At phone width a month day cell
is ~50px wide — not enough for even one word, so the pills had already been
degraded to 6px anonymous color bars (capped at 4, with a "+N more" below).
That told you almost nothing. The bars are now hidden entirely at the existing
`max-width: 600px` breakpoint and replaced by one centered accent-colored
number: how many articles that day has. Tapping the cell still opens the day
view, which is where titles were readable anyway.

`renderMonth` always appends the `.day-count` element and CSS decides which
representation shows — so rotating or resizing across the breakpoint needs no
re-render, and the desktop look is untouched.

## Key files

- `docs/index.html` — removed the `.viewer-foot` block
- `docs/app.js` — `renderList` day-grouping labels; `renderMonth` count element
- `docs/style.css` — `.list-day-label`, single-column `.list-row`, mobile
  month-cell count, safe-area padding moved into `#viewer-body`

## Verification

Playwright against a local `http.server`: 113 list rows collapsed to 36 day
labels with no leftover date cells; viewer has exactly one prev/next pair and
prev still navigates; at 390×844 the month grid shows 0 pills and 17 day
counts, and tapping a cell opens the day view. No console errors.
