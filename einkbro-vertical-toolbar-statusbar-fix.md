# einkbro — vertical toolbar webview collapse & stuck progress bar

Commit: `c31fa857`

## Problem

Two regressions surfaced after the statusbar feature (`2f8b2ea6`) landed:

1. **WebView disappears when toolbar is vertical.** With the toolbar set to Left or Right, the main content area (`twoPanelLayout`) had zero height and the webview was invisible.
2. **Hidden progress bar re-appears when switching toolbar position** (e.g. Right → Bottom). A GONE progress bar became VISIBLE after every position change, showing a stale/empty bar on top of the content.

## Root Cause

### 1. Webview collapse

`BrowserActivity.applyStatusbarConstraints` unconditionally re-wired `twoPanelLayout`'s top/bottom constraints against `appBar`:

```kotlin
// Top statusbar position
cs.connect(twoPanelId, top, statusBarId, bottom)
cs.connect(twoPanelId, bottom, appBarId, top)
```

That assumes `appBar` is a horizontal bar docked at top or bottom. But in vertical-toolbar mode, `ViewUnit.moveAppbarToLeft`/`moveAppbarToRight` sets the appBar's **TOP and BOTTOM both to parent**, so it spans the full height. As a result `appBar.top == parent.top`, which made `twoPanel.bottom` snap to the parent top edge — collapsing the content area to zero height.

The method ran via `StatusbarViewController.init` on first access to `statusbarViewController`, which happens in `onCreate` regardless of whether the user enabled the statusbar, so the bug affected everyone using a vertical toolbar.

### 2. Stuck progress bar visibility

`ViewUnit.setProgressBarHorizontal` / `setProgressBarVertical` reshape the progress bar on toolbar position change by:

```kotlin
val cs = ConstraintSet()
cs.clone(root)
cs.clear(progressBar.id)   // ← drops the stored Constraint entry entirely
cs.connect(...)
cs.applyTo(root)
```

`ConstraintSet.clear(viewId)` removes the `Constraint` object from the internal map. When `connect`/`constrainWidth`/etc. then touch that id, a fresh `Constraint` is created — with the default visibility of `View.VISIBLE`. On `applyTo`, the progress bar (which was GONE because no page was loading) was forcibly re-shown.

## Solution

### Fix 1 — `BrowserActivity.kt` `applyStatusbarConstraints`

Detect vertical toolbar and anchor `twoPanelLayout`'s unused vertical edge to `parent` instead of the full-height `appBar`:

```kotlin
val isVertical = config.ui.isVerticalToolbar
// StatusbarPosition.Top
cs.connect(twoPanelId, top, statusBarId, bottom)
if (isVertical) cs.connect(twoPanelId, bottom, parent, bottom)
else            cs.connect(twoPanelId, bottom, appBarId, top)
// StatusbarPosition.Bottom — mirror for the statusbar's own bottom anchor
```

### Fix 2 — `ViewUnit.kt` `setProgressBarHorizontal`/`setProgressBarVertical`

Explicitly preserve the current visibility after clearing:

```kotlin
cs.clear(progressBar.id)
// …constraints…
cs.setVisibility(progressBar.id, progressBar.visibility)
cs.applyTo(root)
```

## Key Files

- `app/src/main/java/info/plateaukao/einkbro/activity/BrowserActivity.kt` — `applyStatusbarConstraints` (lines ~392–424)
- `app/src/main/java/info/plateaukao/einkbro/unit/ViewUnit.kt` — `setProgressBarHorizontal`, `setProgressBarVertical`
- `app/src/main/java/info/plateaukao/einkbro/view/viewControllers/StatusbarViewController.kt` — calls `applyConstraints` at init and on `refresh()`

## Lessons Learned

- **Features added to a shared layout must cover every layout mode.** The statusbar constraint code assumed a horizontal toolbar; there was no test for the Left/Right case. When a new feature mutates shared ConstraintLayout constraints, walk through every toolbar position before shipping.
- **`ConstraintSet.clear(viewId)` is not just a constraint reset.** It evicts the entire `Constraint` entry, so *any* attribute backed by `Constraint` (visibility, alpha, dimensions) returns to its default on the next `applyTo`. When in doubt, prefer `cs.clear(viewId, anchor)` per anchor, or explicitly restore the attributes you care about.
- **Lazy init with side effects is a footgun.** `applyStatusbarConstraints` running on first property access made the bug trigger for users who had never enabled the statusbar. A feature flag check at the top of the init block (or constructor) would have limited the blast radius.
