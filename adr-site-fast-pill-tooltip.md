# ADR Site: Replace native `title` tooltip with a fast custom hover hint

## Problem
Hovering a calendar pill in the viewer (`docs/`) showed the project + full title only after the browser's built-in `title` delay (about 500–700 ms, varies by browser/OS). On a calendar where the pill text itself is aggressively truncated, that delay made the tooltip feel slow enough that users would move on before it appeared.

## Root Cause
`appendPills` set `btn.title = ...`. The `title` attribute uses the OS-level tooltip, whose delay is not exposed to the page. There is no CSS or JS hook to make it appear sooner.

## Solution
Implemented a single delegated custom tooltip:

1. Pills now publish their hint via `data-tip` instead of `title`.
2. `setupTooltip()` (called once from `init`) creates one `<div class="tt">` on `body` and attaches `mouseover`/`mousemove`/`mouseout` listeners on `document` that match `[data-tip]` via `closest`.
3. On `mouseover` it starts a 100 ms timer. If the pointer is still over the same element when the timer fires, the tooltip element gets the `data-tip` text, is positioned next to the cursor, and fades in via `opacity` (80 ms transition).
4. On `mousemove` the tooltip tracks the cursor; on `mouseout`, click, or scroll it hides immediately and the timer is cleared.
5. Position clamps to the viewport — flips above the cursor when the bottom edge would clip, and shifts left when the right edge would clip.

The delegation lets a single listener serve every pill in every view (month/week/day) without per-pill wiring, and naturally extends to anything else that wants a fast tooltip — just add `data-tip="..."` to the element.

## Key Files
- `docs/app.js` — replaced `btn.title = ...` with `btn.dataset.tip = ...` in `appendPills`; added `setupTooltip()` and called it from `init`.
- `docs/style.css` — added `.tt` (fixed-position, fade-in) and `.tt.on` (visible) rules.

## Lessons Learned
- The native `title` attribute is unstyleable and untimable. Anywhere a tooltip is part of the UX (not just an accessibility fallback), expect to replace it with a custom one — there is no shortcut.
- Event delegation on `[data-tip]` is the cheapest extension point: any future element that should have a tooltip just sets the attribute, with no JS plumbing per call site.
- A 100 ms show-delay is short enough to feel instant but long enough to avoid flicker when the pointer is just passing over a pill on its way somewhere else. Zero delay would feel jumpy on dense calendars.
- Clearing the timer on `mouseout`, `click`, and `scroll` is essential: otherwise a pending show fires after the user has already moved on, dropping the tooltip in the wrong place or over unrelated content.
