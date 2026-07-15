2026-07-07

# EinkBro: shared ListScaffold + locale-aware base for config activities

## Why

The audit quantified about 350 lines of near-identical chrome across ten
config/list activities: each re-built `MyTheme { Scaffold(topBar =
TopAppBar(title, back arrow, actions)) }` with three inconsistent
back-navigation styles (`finish()`, `onBackPressedDispatcher`,
NavHost-aware) and inconsistent icon tinting. Separately, only 4 of the 11
Compose activities applied the in-app UI language override in
`attachBaseContext` — users with a non-system app locale got
mixed-language screens in exactly the other seven.

## What was built

- **`LocaleAwareComponentActivity`** — abstract `ComponentActivity` base
  applying the `LocaleManager` override once; all ten activities extend
  it, and the three per-activity copies of the override were deleted.
- **`ListScaffold(title, onBack, actions, content)`** — one themed
  scaffold with a standardized `onPrimary` back arrow and title. Adopted
  by seven activities; each screen's own back behavior and action buttons
  moved over verbatim.
- **`EmptyListPlaceholder(text)`** — replaces three copies of the
  centered empty-list box.

Deliberately *not* migrated to the shared scaffold: `ToolbarConfigActivity`
(it has no Scaffold — its top bar is composed into a custom panel layout
that reflows in vertical-preview mode) and `HighlightsActivity` (dynamic
title + navigateUp-vs-finish logic driven by its NavController back
stack). Both still get the locale base class. `UserScriptListActivity`
keeps its intentionally different inline empty-state text.

Net −209 lines.

## Verification

Emulator, debug build: the ChatGPT Actions screen (ListScaffold +
placeholder path) renders its action list with Back/Delete/Add in the top
bar; the Statusbar items config screen (ListScaffold with Close/Done
actions) renders and navigates back correctly. Full project compiles
clean.
