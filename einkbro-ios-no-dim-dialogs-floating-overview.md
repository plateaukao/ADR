2026-07-17

# EinkBro iOS: undimmed dialogs, floating overview, custom-only selection menu

Third round of the day, all UI-chrome parity: EinkBro's e-ink aesthetic never
dims or hides page content behind transient UI, and the Android app enforces
that in ways the port had missed. Committed as `9455d7b`.

## No scrim on any dialog

Android's `ComposeDialogFragment` sets the window dim amount to 0 for every
EinkBro dialog. Compose Multiplatform's `Dialog`/`AlertDialog` draw a scrim by
default, and its m2 `AlertDialog` on iOS exposes no way to clear it. Editing
~60 call sites was avoided with two wrappers plus import aliasing:

- `NoDimDialog` — forwards to compose `Dialog` with
  `DialogProperties(scrimColor = Color.Transparent)` (the extended
  constructor is visible in commonMain because the project targets only iOS,
  so the skiko API gets commonized).
- `NoDimAlertDialog` — an m2-shaped AlertDialog built on `NoDimDialog`,
  matching the parameter subset the call sites use.

Each consuming file changed by exactly one line:
`import info.plateaukao.einkbro.util.NoDimDialog as Dialog` — every existing
call site resolves to the wrapper unchanged.

## Overview as a floating panel

The tab/history overview was wrapped in an opaque `fillMaxSize` Surface — a
fullscreen takeover. Android's `OverviewDialogController` overlays a
transparent layer where only the content column (sized to the album count)
and the button bar paint background, anchored at the toolbar edge, with the
page visible around it and an outside tap closing the panel. The ported
`HistoryAndTabs` already implemented all of that internally — the fix was
deleting the opaque wrapper in favor of a plain transparent Box.

## Selection shows only EinkBro's menu

On text selection iOS presented both the system edit menu and EinkBro's
custom `ActionModeMenu`. Android suppresses the default ActionMode unless
"show default action menu" is enabled; the port now mirrors that with an
`EBWKWebView` subclass overriding `canPerformAction`: when the pref is off,
all system edit actions are refused except paste/select/selectAll (so
editable fields keep working). Verified on the simulator: selecting a word
shows the custom menu (including the user's GPT actions, added earlier the
same day) with no system bar.

Known leftover: iOS 17 injects "Copy Link with Highlight" through the
`buildMenu` path, which bypasses `canPerformAction`; removing it needs a
`buildMenuWithBuilder:` override with the right menu identifier — deferred.
