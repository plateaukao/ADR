# NerLan Android — navigation tearing down screen state (re-fetch on back)

## Problem

On the Android app, opening a program and pressing back **re-fetched the whole
program catalog** from the network and **reset the language filter** (and scroll
position). Switching between the bottom tabs did the same — returning to 節目
reloaded it from scratch.

## Root Cause

`MainScreen` did manual navigation by **swapping composables**:

```kotlin
when (tab) {
  0 -> programsDetail?.let { ProgramDetailScreen(...) } ?: ProgramListScreen(...)
  ...
}
```

Two swaps destroyed state:
- `detail ?: list` — opening a program composed the detail *instead of* the list,
  so `ProgramListScreen` left composition.
- `when (tab)` — only the active tab was composed at all.

When a screen leaves composition, its `remember { }` state is discarded. So on
return it was rebuilt fresh: `groups` was empty again, so `LaunchedEffect(Unit)`
re-ran the `ChannelPlusApi.programs()` fetch, and `selectedLanguage`/scroll reset
to defaults. (iOS doesn't hit this — its `NavigationStack` keeps the list alive
beneath a pushed detail.)

## Solution

Keep everything composed; only draw what's active. In Compose, **composition
holds `remember` state, and it's independent of layout/draw**, so a screen can
stay composed (state intact) while not being shown.

- A `TabContainer(active) { content }` wraps each tab. Its content is always
  composed, but its `Modifier.layout` only measures+places the child when
  `active`; inactive tabs return zero size and aren't placed — not drawn, not
  hit-tested, but never removed from composition.
- The program detail is rendered **overlaid on top of its still-composed list**
  (the detail's `Scaffold` is opaque) instead of replacing it.

Result: switching tabs or opening/closing a program no longer re-fetches or
resets filters/scroll.

## Key Files

- `app/src/main/java/com/example/nerlan/ui/MainScreen.kt` — `TabContainer` keep-
  alive host; program detail overlaid rather than swapped.

## Lessons Learned

- Manual `when`/`?:` navigation in Compose silently destroys off-screen state.
  To preserve it, keep screens composed (the layout-skipping keep-alive trick),
  hoist the heavy state out, or use a nav backstack that retains entry state.
- A network fetch guarded by `if (data.isEmpty())` inside a `LaunchedEffect(Unit)`
  looks idempotent but isn't protective once the whole composable is torn down
  and recreated — the guard state resets with it.
- When porting iOS↔Android, replicate the *state lifetime* the other platform's
  navigation provides, not just the visual flow.
