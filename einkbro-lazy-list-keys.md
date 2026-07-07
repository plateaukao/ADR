2026-07-07

# EinkBro: stable keys for lazy lists; data-keyed per-item remember

## What was broken

Nearly every lazy list in the app used positional identity —
`items(list.size) { index -> ... }` with no `key` — combined with item
composables that seed local state via key-less
`remember { mutableStateOf(data.field) }`. That pairing works only while
the list is static and nothing recomposes the outer scope. Three unstated
assumptions, and each was violated somewhere:

- **The list morphs (settings search).** As the user types, the filtered
  grid re-arranges, and the same grid position hands a *different* setting
  to the same composition slot. The key-less `remember` kept the previous
  setting's value: a Switch could display setting A's state while labeled
  — and writing to — setting B. A genuine correctness bug, verified on
  device before the fix by design analysis and after the fix by driving
  the search UI: narrowing "tab" → "tabs" shifts "Save tabs" up two
  positions and its toggle now keeps its own (on) state.
- **Items get deleted (GPT queries, adblock filters, highlights, saved
  pages, domain lists).** Deleting item N rebinds every following
  position: expanded/collapsed state jumped to the wrong query, and the
  adblock enable-switch showed stale state when the filters flow
  re-emitted after a download.
- **Tabs close (tab strip + overview grid).** Closing tab 2 of 10
  rebinds positions 3–10 — on e-ink, a visible flash of the whole tail
  of the strip.

## The fix

- Settings search items keyed by `"$categoryResId-${setting.titleResId}"`
  (unique within the flattened list), dividers by category; every
  `SettingItemUi` variant now uses `remember(setting)` so state follows
  the setting object, not the slot.
- Data lists keyed by their natural ids: ChatGptQuery/Article/Highlight/
  SavedPage/Filter database ids, unique domain strings for the whitelist
  screens; the adblock switch state is `remember(filter.isEnabled)`.
- `Album` gained a monotonic `val id` (body property — data-class equals,
  which covers only constructor params, is unchanged) used as the key in
  both the horizontal strip and the overview grid.
- Two focus-scope fixes rode along in the same file: each tab item reads
  the focus index through `remember(index) { derivedStateOf { ... } }`,
  so switching tabs invalidates only the two affected items instead of
  every visible tab; and the auto-scroll effect collects
  `snapshotFlow { albumFocusIndex.value }` instead of keying a
  `LaunchedEffect` on a `.value` read in the composable body (which had
  recomposed the whole strip per switch). The dead `scrollToFocusedItem`
  helper was removed.

## What was deliberately left un-keyed

History/suggestion records (`BrowseHistoryList`): `Record` has no unique
id, and the same composable renders autocomplete suggestions where a
bookmark and a history entry — or two saved bookmarks — can share both
url and time. Lazy keys must be unique or the list crashes, so positional
identity is the safer behavior there until `Record` grows a real id.

## Verification

Emulator, debug build: settings search filters correctly with keys (no
duplicate-key crash across broad queries), toggle states follow their
settings across list morphs, tab overview switches focus correctly with
the border on the newly activated tab, and tab close/switch cycles run
without crashes.
