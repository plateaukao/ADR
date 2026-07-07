2026-07-07

# EinkBro: three WebView lifecycle leaks

Follow-up to the audit's "lifecycle asymmetry" theme — things created or
registered eagerly with no matching destroy/unregister.

## 1. Two WebViews never destroyed

The second-pane translation WebView (`TwoPaneController`, created lazily
and added to the translation panel) and the Naver-dictionary WebView
(`BrowserActivity.externalSearchWebView`) both hold the activity through
their context and were never destroyed. Any `recreate()` — dark-mode
toggle, restart-required preference — leaked the old activity and its
native WebView peers until process death. Both are destroyed in
`onDestroy()` now, each guarded by a created-flag so the check doesn't
itself force the lazy initialization.

## 2. A lifecycle observer per tab, never removed

`createMultiTouchTouchListener()` registered every tab's
`MultitouchListener` as an activity lifecycle observer and never removed
it. Observers accumulated for the activity's lifetime, each one holding
its tab's (possibly destroyed) WebView via the gesture detector — so
closed tabs stayed reachable, and every lifecycle event iterated the whole
pile. The observer existed only to clear an `inSwipe` flag when the
activity stopped mid-gesture; the framework already delivers
`ACTION_CANCEL` for exactly that situation, so the flag is now cleared in
`onTouch` and the observer registration is deleted.

## 3. Delayed callbacks against destroyed WebViews

`EBWebView.reload()` posted a 2-second cache-mode reset and `loadUrl()` a
200 ms fake-progress callback; neither was cancelled in `destroy()`.
Closing a tab within the window ran them against a destroyed WebView —
undefined behavior on older vendor builds. A `isWebViewDestroyed` flag set
in `destroy()` now guards both runnables.

## Verification

Emulator: load → reload → open a second tab → close both tabs within ~2s
of loading (pending callbacks in flight); process stays alive, crash
buffer empty, remaining tab intact.
