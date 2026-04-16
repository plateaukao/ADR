# Configurable statusbar for fullscreen / no-toolbar mode

## Problem

EinkBro lets users hide the toolbar (either permanently via the "Hide toolbar" setting or transiently via the fullscreen toggle). Once the toolbar is gone, the user loses at-a-glance information that normally lives there — current time, page progress, touch-pagination state, etc. There was no way to keep any of that visible without bringing the whole toolbar back.

## Root Cause

The toolbar was the *only* place surfacing status-like information. `FullscreenDelegate.toggleFullscreen()` simply hid `binding.appBar` and left the webview occupying the full screen; there was no alternate lightweight bar to take its place.

## Solution

Added an optional slim **statusbar** that becomes visible whenever the toolbar is hidden (either mode). It mirrors the toolbar configuration UX where sensible:

- **Per-user toggle** (`UiConfig.statusbarEnabled`) under *Settings → Toolbar*.
- **Top or bottom anchoring** (`UiConfig.statusbarPosition`) via a single-choice setting.
- **Reorderable items** (`UiConfig.statusbarItems`) edited in a dedicated `StatusbarConfigActivity` modeled on `ToolbarConfigActivity` — same drag-and-drop UX using `sh.calvin.reorderable.ReorderableRow`.
- **Six items for v1:** Time, PageInfo, Battery%, Wifi, Touch pagination, Volume pagination. Icons are used wherever the value is boolean/categorical (per user preference), reusing existing toolbar drawables (`ic_touch_enabled/disabled`) and Material icons (`Wifi`, `BatteryFull`, `AutoMirrored.VolumeUp/Off`).

The bar claims its own vertical space rather than overlaying the webview. `applyStatusbarConstraints()` in `BrowserActivity` rewrites ConstraintSet anchors on `twoPanelLayout` and `statusBar` every time the position changes, so the webview shrinks to sit below (Top position) or above (Bottom position) the bar. When the statusbar is `GONE`, ConstraintLayout collapses it to zero size and the constraints degrade cleanly — the webview fills the full content area with no gap.

Live updates:
- Time: `LaunchedEffect` + `delay(60_000)` loop, same pattern as `CurrentTimeText` in the toolbar.
- Battery: polled every 60 s via `BatteryManager.BATTERY_PROPERTY_CAPACITY`.
- Wifi: `ConnectivityManager.NetworkCallback` inside `DisposableEffect`, registered on a `TRANSPORT_WIFI` request.
- Touch/Volume pagination: `SharedPreferences.OnSharedPreferenceChangeListener` so the icon flips instantly when the user toggles via the toolbar or dialog.
- PageInfo: `BrowserActivity.updatePageInfo()` now forwards to both `composeToolbarViewController` and `statusbarViewController`.

Visibility is driven from three places:
1. `FullscreenDelegate.toggleFullscreen()` — show on hide, hide on restore.
2. `BrowserActivity.onResume()` — show if `appBar` is already hidden (e.g. after `shouldHideToolbar` was toggled elsewhere).
3. Pref-change listener — reacts to `K_STATUSBAR_ENABLED/POSITION/ITEMS` so settings apply without restart.

## Key Files

- `app/src/main/java/info/plateaukao/einkbro/view/statusbar/StatusbarItem.kt` — enum of 6 items + `StatusbarPosition` (Top/Bottom).
- `app/src/main/java/info/plateaukao/einkbro/view/statusbar/Statusbar.kt` — row composable and per-item renderers with live-update effects.
- `app/src/main/java/info/plateaukao/einkbro/view/viewControllers/StatusbarViewController.kt` — owns the ComposeView; `show`/`hide`/`updatePageInfo`/`refresh`.
- `app/src/main/java/info/plateaukao/einkbro/activity/StatusbarConfigActivity.kt` — drag-reorder configuration UI.
- `app/src/main/java/info/plateaukao/einkbro/preference/UiConfig.kt` — three new prefs (`statusbarEnabled`, `statusbarPosition`, `statusbarItems`) with defaults matching the toolbar serialization style.
- `app/src/main/java/info/plateaukao/einkbro/view/MainActivityLayout.kt` — adds `statusBar: ComposeView` with base (top-anchored) constraints.
- `app/src/main/java/info/plateaukao/einkbro/activity/BrowserActivity.kt` — lazy controller, `applyStatusbarConstraints()` that rewrites the layout's anchors so the bar claims its own area, pref-listener wiring, `onResume` refresh.
- `app/src/main/java/info/plateaukao/einkbro/activity/delegates/FullscreenDelegate.kt` — shows statusbar when toolbar hides, hides it when toolbar returns.
- `app/src/main/java/info/plateaukao/einkbro/activity/SettingActivity.kt` — three new entries appended to `toolbarSettingItems`.
- `app/src/main/AndroidManifest.xml`, `res/values/ids.xml`, `res/values/strings.xml` — registration and resources.

## Lessons Learned

- **ConstraintLayout + GONE views are your friend.** Anchoring `twoPanelLayout.top` to `statusBar.bottom` (and the symmetric Bottom case to `statusBar.top`) means the same constraint works whether the statusbar is visible or gone — GONE collapses the view to zero size and the constraint routes through cleanly. No need to branch on visibility.
- **Reuse the existing reorder library rather than inventing a parallel UX.** `sh.calvin.reorderable.ReorderableRow` was already pulled in for `ToolbarConfigActivity`; feeding it a different list type (`StatusbarItem`) gave us identical drag behavior for free.
- **Icon-first rendering suits E-ink.** For boolean/categorical status (wifi on/off, pagination on/off), a single icon conveys state more efficiently than text *and* matches the existing toolbar visual language. Material `AutoMirrored` variants matter for RTL locales — the deprecation warnings on `VolumeUp/Off` were a useful nudge to switch.
- **Decoupled update paths > over-engineered shared state.** Adding a second `updatePageInfo` call-site to the toolbar's existing path was cheaper and more obvious than refactoring `ComposeToolbarViewController` to expose a StateFlow both views subscribe to. The v1 tradeoff: two `mutableStateOf` fields instead of one shared source of truth; worth revisiting if a third consumer appears.
