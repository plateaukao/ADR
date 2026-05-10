# Statusbar feature for fullscreen / no-toolbar mode

## Context

EinkBro lets users hide the toolbar (`config.ui.shouldHideToolbar`) or toggle fullscreen via `FullscreenDelegate.toggleFullscreen()` (which sets `binding.appBar.visibility = GONE`). When the toolbar is gone, the user loses at-a-glance information that lives in the toolbar — current time, page info, etc. We want an optional, slim **statusbar** that appears only in those no-toolbar scenarios, with user-configurable contents and a top/bottom position. This mirrors how the toolbar is already configurable, so the implementation should reuse existing patterns rather than invent new ones.

## Approach summary

Add a new ComposeView (`statusBar`) to `MainActivityLayout` constrained to either parent top or parent bottom, driven by a small `StatusbarViewController`. Persist user choices in `UiConfig`. Reuse the existing rendering primitives (`CurrentTimeText`, `PageInfoIcon`-style text, existing touch drawables) instead of building new ones. Wire visibility to the same lifecycle hooks that hide/show `appBar`.

## Files to modify

- `app/src/main/java/info/plateaukao/einkbro/preference/UiConfig.kt` — new prefs
- `app/src/main/java/info/plateaukao/einkbro/view/MainActivityLayout.kt` — add `statusBar` ComposeView + constraints
- `app/src/main/java/info/plateaukao/einkbro/activity/delegates/FullscreenDelegate.kt` — show/hide statusbar with `toggleFullscreen()` / `showToolbar()`
- `app/src/main/java/info/plateaukao/einkbro/activity/BrowserActivity.kt` — instantiate `StatusbarViewController`, hook into existing page-info update path (search for `composeToolbarViewController.updatePageInfo` callsites)
- `app/src/main/java/info/plateaukao/einkbro/activity/SettingActivity.kt` — extend `toolbarSettingItems` (around line 732–770) with statusbar entries
- `app/src/main/res/values/strings.xml` (and `values-*/strings.xml` left for Crowdin) — new string resources
- `app/src/main/java/info/plateaukao/einkbro/setting/SettingRoute.kt` — add `StatusbarConfig` route if we follow the existing nav pattern (otherwise launch the activity directly via `ActionSettingItem`, matching `ToolbarConfigActivity`)

## Files to create

- `app/src/main/java/info/plateaukao/einkbro/view/statusbar/StatusbarItem.kt` — enum of supported items (v1): `Time`, `PageInfo`, `Battery`, `Wifi`, `TouchPagination`, `VolumePagination`
- `app/src/main/java/info/plateaukao/einkbro/view/statusbar/Statusbar.kt` — the `@Composable Statusbar(items, pageInfo)` row plus per-item composables. Reuse existing composables/resources wherever possible; see "Item rendering" below
- `app/src/main/java/info/plateaukao/einkbro/view/viewControllers/StatusbarViewController.kt` — owns the ComposeView, exposes `show()`, `hide()`, `updatePageInfo(text)`, `refresh()` (re-reads config so item set/order/position changes apply without restart)
- `app/src/main/java/info/plateaukao/einkbro/activity/StatusbarConfigActivity.kt` — drag-and-drop reorder screen for statusbar items, modeled on `ToolbarConfigActivity.kt`. Reuse the same `ReorderableComposedIconBar` composable if it accepts arbitrary icon lists; if it's hard-coded to `ToolbarAction`, generalize it to take a `List<Any>` via a small adapter, or copy-and-adapt for `StatusbarItem` (decide during implementation after reading the composable — prefer generalization if the diff is small)

## Item rendering (reuse-first)

| Item | Source / composable to reuse | Notes |
|---|---|---|
| Time | `CurrentTimeText()` at `view/compose/Toolbar.kt:777` | Use as-is |
| PageInfo | Same text string passed to `PageInfoIcon` at `view/compose/Toolbar.kt:547`; render as plain `Text` (no click) | Fed from the same update path as the toolbar's PageInfo |
| Battery | `Icons.Outlined.BatteryFull` (Material) + percent text, or just icon if space-constrained | Poll `BatteryManager.BATTERY_PROPERTY_CAPACITY` every 60 s inside `LaunchedEffect` (same pattern as `CurrentTimeText`) |
| Wifi | `Icons.Outlined.Wifi` / `Icons.Outlined.WifiOff` | Read connectivity via `ConnectivityManager.getNetworkCapabilities(activeNetwork)?.hasTransport(TRANSPORT_WIFI)`. Register a `NetworkCallback` inside `DisposableEffect` so status updates live |
| TouchPagination | Existing drawables `R.drawable.ic_touch_enabled` / `R.drawable.ic_touch_disabled` (already used by `ToolbarAction.Touch` at `ToolbarAction.kt:59-67`) | Bound to `config.touch.enableTouchTurn` (`TouchConfig.kt:9`). Observe via SharedPreferences change listener so it updates when the user toggles via the toolbar |
| VolumePagination | No existing drawable — use Material `Icons.Outlined.VolumeUp` / `Icons.Outlined.VolumeOff` (consistent with icon-only approach) | Bound to `config.touch.volumePageTurn` (`TouchConfig.kt:18`) |

All items render as icons (not text) where possible — per user preference. Time and PageInfo remain text since they're numeric values. Lay out in a `Row` with `Arrangement.spacedBy(8.dp)` and small (~16.dp) icon size so the bar stays slim.

## Data model

In `UiConfig.kt` add:

```kotlin
var statusbarEnabled by BooleanPreference(sp, K_STATUSBAR_ENABLED, false)

var statusbarPosition: StatusbarPosition
    get() = StatusbarPosition.entries.getOrElse(sp.getInt(K_STATUSBAR_POSITION, 0)) { StatusbarPosition.Top }
    set(value) = sp.edit { putInt(K_STATUSBAR_POSITION, value.ordinal) }

var statusbarItems: List<StatusbarItem>
    get() {
        val s = sp.getString(K_STATUSBAR_ITEMS, defaultStatusbarItemsString).orEmpty()
        return if (s.isBlank()) emptyList()
        else s.split(",").mapNotNull { runCatching { StatusbarItem.entries[it.toInt()] }.getOrNull() }
    }
    set(value) = sp.edit { putString(K_STATUSBAR_ITEMS, value.joinToString(",") { it.ordinal.toString() }) }
```

Defaults: `Time, PageInfo, Battery, Wifi, TouchPagination, VolumePagination`, position `Top`, enabled `false`. Mirror the `toolbarActions` (de)serialization style at `UiConfig.kt:67-94` so the patterns stay consistent. Because items are reorderable, the order in the prefs list is the render order.

`StatusbarPosition` is a tiny enum (`Top`, `Bottom`) — fits the existing `ListSettingWithEnumItem` pattern (see `SettingActivity.kt:740`).

## UI integration

1. In `MainActivityLayout.create()`, add a `ComposeView(context).apply { id = R.id.status_bar; visibility = GONE }` and constrain it conditionally. Simplest: always anchor both top and bottom in the constraint set, and let `StatusbarViewController` rebuild constraints when position changes (use the existing `ConstraintSet` pattern already in `FullscreenDelegate.resetInputUrlConstraints()` at line 193). Keep `WRAP_CONTENT` height.
2. In `FullscreenDelegate.toggleFullscreen()` (line 127): when hiding `appBar`, call `statusbarViewController.show()` if `config.ui.statusbarEnabled`. In `showToolbar()` (line 144), call `statusbarViewController.hide()`. Also handle the always-hidden-toolbar case (`config.ui.shouldHideToolbar == true`) at activity start.
3. In `BrowserActivity`, find every call to `composeToolbarViewController.updatePageInfo(...)` and add a parallel `statusbarViewController.updatePageInfo(...)`. (Alternative: have `ComposeToolbarViewController` expose a StateFlow that both views observe — cleaner but bigger refactor. Recommend the simple parallel call for v1.)

## Settings UI

Append to `toolbarSettingItems` in `SettingActivity.kt:732`:

```kotlin
BooleanSettingItem(R.string.setting_title_statusbar_enabled, 0, R.string.setting_summary_statusbar_enabled, config.ui::statusbarEnabled),
ListSettingWithEnumItem(R.string.setting_title_statusbar_position, 0, 0, config.ui::statusbarPosition,
    listOf(R.string.statusbar_position_top, R.string.statusbar_position_bottom)),
ActionSettingItem(R.string.setting_title_statusbar_items, 0, R.string.setting_summary_statusbar_items) {
    startActivity(Intent(this, StatusbarConfigActivity::class.java))
},
```

`StatusbarConfigActivity` uses drag-and-drop reorder (mirroring `ToolbarConfigActivity`), persists into `config.ui.statusbarItems`, and exits via back press. On `onResume()` of `BrowserActivity`, call `statusbarViewController.refresh()` so changes apply without restart.

## Battery item details

Use `context.getSystemService(BATTERY_SERVICE) as BatteryManager` and `getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)`. Poll every 60 s inside a `LaunchedEffect(Unit)` like `CurrentTimeText` does. No broadcast receiver needed for this granularity — keeps the implementation tiny and cheap.

## Verification

1. `./gradlew assembleDebug` — must compile.
2. Install on emulator (`./gradlew installDebug`), open Settings → Toolbar Settings, enable Statusbar, choose items + position, back to browser.
3. Tap the FullScreen toolbar action (or use the gesture) → toolbar disappears, statusbar appears at the chosen edge with the configured items.
4. Scroll the page → page info text in the statusbar updates in lockstep with the toolbar's PageInfo icon when toolbar is restored.
5. Toggle wifi off/on and touch/volume pagination → statusbar icons update live without restart.
6. Toggle position Top↔Bottom in settings → return to browser → statusbar moves without restart.
7. Disable statusbar → enter fullscreen → no statusbar shown (regression check).
8. With `shouldHideToolbar = true` (toolbar always hidden), confirm statusbar is visible from app launch.
9. Use the regression skill (`/regression`) to verify no toolbar/menu regressions.

## Decisions captured from clarification

- **Item UX:** Drag-and-drop reorder, consistent with `ToolbarConfigActivity`.
- **v1 items:** Time, PageInfo, Battery %, Wifi status, Touch-pagination status, Volume-pagination status.
- **Rendering style:** Prefer existing icons over text; only Time and PageInfo stay as text because they're inherently numeric.
