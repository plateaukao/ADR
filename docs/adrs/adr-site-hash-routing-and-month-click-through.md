# ADR Site: Hash Routing and Month-View Click-Through

## Problem
The ADR viewer (`docs/`) had three usability gaps:

1. Each month-view day cell showed both the date and a small count badge with the number of ADRs that day. The pill list directly below the date already conveyed the same information, so the badge was redundant and visually noisy.
2. Clicking inside an empty area of a month-view day cell did nothing. There was no way to drill from a month overview into a single day's view without using the top-bar view switcher and stepping the cursor.
3. URLs were not addressable. Switching to week or day view, or paging to a specific month, did not update the URL, so views could not be linked, bookmarked, or restored on refresh. The only persisted hash state was the legacy `#<slug>` form for opening an entry overlay.

## Root Cause
The app stored `view` and `cursor` purely in an in-memory `state` object and never serialized them to the URL. The month-cell DOM had no click handler — only individual pill buttons were interactive. The duplicate count badge was a leftover from an earlier render that did not yet show pills.

## Solution

### Remove the redundant count badge
In `renderMonth`, the `daynum` head now renders only the date number. The pill list below already shows the items.

### Click-through from month cells to day view
Attach a `click` listener to each month-view day cell. When the click target is not inside a `.pill`, call `navigate({ view: "day", cursor: <that day> })`. Pill buttons still open the entry viewer because their handlers stop at the pill itself (or, equivalently, the cell-level handler bails out via `closest(".pill")`).

A scoped CSS rule `.month-grid .day-cell { cursor: pointer }` advertises the affordance without affecting week-grid cells.

### Hash-based routing
Introduce a small router with three pieces:

- `buildHash()` produces the canonical hash for the current state:
  - `#/month/YYYY-MM`
  - `#/week/YYYY-MM-DD`
  - `#/day/YYYY-MM-DD`
  - `#/list`
- `parseHash()` reverses it. A leading `/` distinguishes view routes from the legacy `#<slug>` entry-open hash, preserving backward compatibility.
- `navigate({ view, cursor }, { push })` is the single entry point for state changes: it updates `state`, syncs the view-switch button highlight, writes the hash (`pushState` for user actions, `replaceState` for replays), and re-renders.

All view-changing handlers (view-switch buttons, prev/next, today, month-cell click) were refactored to call `navigate(...)` instead of mutating `state` directly. `popstate` and `hashchange` listeners replay the parsed route so browser back/forward and manual URL edits work.

`init()` parses the initial hash: a view route restores that view; a legacy slug hash sets the cursor from the first manifest entry, writes a canonical view hash via `replaceState`, and then opens the requested entry overlay.

## Key Files
- `docs/app.js` — removed the count badge in `renderMonth`; added `buildHash` / `parseHash` / `syncViewButtons` / `navigate`; added month-cell click handler; rewired prev/next/today/view-switch to call `navigate`; added `popstate` and `hashchange` listeners; updated `init()` to parse and apply the incoming hash.
- `docs/style.css` — added `.month-grid .day-cell { cursor: pointer }`.

## Lessons Learned
- A leading-slash convention (`#/<view>/...`) is a cheap way to add hash routing without breaking older single-token hashes, because the two namespaces never collide.
- Funneling every state mutation through one `navigate(...)` function keeps URL, button highlight, and render in lockstep — easy to add more entry points (cell click) without re-deriving that wiring each time.
- For overlay-style routes (entry viewer on top of a view) it pays to decide early whether the overlay is part of the URL or not. We kept the overlay out of the canonical hash and only honor the legacy `#<slug>` form on first load, which avoids ambiguous "what view is underneath?" cases when sharing links.
- When delegating clicks on a cell that contains interactive children, `event.target.closest(".pill")` is more robust than relying on `stopPropagation` inside each child, because it keeps the bail-out logic in one place and works even if a child forgets to stop the event.
