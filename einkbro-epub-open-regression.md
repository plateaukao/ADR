# einkbro: EPUB opening broken after delegate refactor

## Problem

Opening an EPUB file in EinkBro failed with two symptoms:

1. With network **off**, the app showed the "You appear to be offline" error screen — even though opening a local EPUB should not need network.
2. With network **on**, the EPUB reader activity flashed on screen for ~0.5s and disappeared without ever displaying the book.

No crash appeared in logcat; the `EpubReaderActivity` was simply destroyed seconds after launch with no visible error.

## Root Cause

Two independent regressions stacked on top of each other.

### 1. `BrowserActivity` bypassed the `EpubReaderActivity.dispatchIntent` override

Commit `605239a7` ("refactor: extract delegates from BrowserActivity") moved intent dispatch logic out of `BrowserActivity` into a new `IntentDispatchDelegate`. In doing so, `BrowserActivity.onCreate` and `onNewIntent` were changed to call the delegate **directly**:

```kotlin
intentDispatchDelegate.dispatchIntent(intent)
```

`EpubReaderActivity extends BrowserActivity` and overrides `dispatchIntent(intent)` to run EPUB-specific logic (`openEpubFile`, `gotoFirstChapter`). But because `BrowserActivity.onCreate` called the delegate directly instead of the polymorphic `this.dispatchIntent(intent)`, the subclass override was never invoked.

Instead, the base `IntentDispatchDelegate.dispatchIntent` ran its generic `ACTION_VIEW` content:// branch, which fell through to the `else` case at `IntentDispatchDelegate.kt:107`:

```kotlin
} else {
    epubManager.showEpubReader(viewUri)
    activity.finish()
}
```

`epubManager.showEpubReader(viewUri)` starts a **new** `EpubReaderActivity` via intent, and the current one immediately finishes. Because `EpubReaderActivity` is `singleInstance`, the relaunch was delivered to the finishing instance as `onNewIntent` — and the task collapsed with `numActivities=0` inside ~20ms of being displayed.

That's why the activity vanished with no crash, no `EpubReader` log lines, and no `Failed to open epub` exception: the override branch that *would* have logged anything never ran.

### 2. `NinjaWebViewClient` branded error page intercepted `file://` main-frame errors

Commit `a1f6b831` ("feat: elegant webview error page with retry and dragon game") added a blanket handler in `NinjaWebViewClient.onReceivedError` that redirects any main-frame error to `error_page.html`:

```kotlin
if (request?.isForMainFrame == true) {
    showErrorPage(request.url.toString(), error?.description?.toString())
}
```

`EpubReaderView.gotoChapter` loads chapters via `loadDataWithBaseURL` with a `file://` base pointing to the extracted EPUB cache directory. Any WebView-level error on that main frame (even a transient local-file one) would now redirect to the generic error page — which defaults to "You appear to be offline" when network is down. That's the first symptom.

## Solution

Two small fixes:

**`BrowserActivity.kt:964` and `:994`** — call the polymorphic `dispatchIntent(intent)` method so subclass overrides actually run:

```kotlin
// onCreate
dispatchIntent(intent)
intentDispatchDelegate.shouldLoadTabState = false

// onNewIntent
override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    dispatchIntent(intent)
}
```

**`NinjaWebViewClient.kt:286`** — restrict the branded error page to `http`/`https` main-frame errors so local `file://` EPUB chapter loads are left alone:

```kotlin
if (request?.isForMainFrame == true) {
    val scheme = request.url.scheme
    if (scheme == "http" || scheme == "https") {
        showErrorPage(request.url.toString(), error?.description?.toString())
    }
}
```

## Key Files

- `app/src/main/java/info/plateaukao/einkbro/activity/BrowserActivity.kt` — `onCreate` and `onNewIntent` now use polymorphic dispatch
- `app/src/main/java/info/plateaukao/einkbro/browser/NinjaWebViewClient.kt` — `onReceivedError` scopes error page to http/https
- `app/src/main/java/info/plateaukao/einkbro/activity/EpubReaderActivity.kt` — unchanged; its `dispatchIntent` override now runs again
- `app/src/main/java/info/plateaukao/einkbro/activity/delegates/IntentDispatchDelegate.kt` — unchanged, but its content:// `else` branch was the trap

## Lessons Learned

- **Extracting logic into a delegate can silently break subclass polymorphism.** When a base class method is `open` specifically so subclasses can override the handling, callers inside the base class must still go through the polymorphic method — not reach past it to the delegate. The refactor preserved the *shape* of `BrowserActivity.dispatchIntent` (still delegating one level deep) but the `onCreate` call site stopped using it. A grep for `intentDispatchDelegate.dispatchIntent` at refactor time would have flagged two suspicious direct calls.
- **Error handlers should be scoped by URL scheme, not blanket main-frame checks.** `loadDataWithBaseURL` with a `file://` base means "local content rendered as if it came from this origin" — WebView treats it as a main-frame navigation and can raise `onReceivedError` on it. Any global error-interception logic needs to exclude non-network schemes, otherwise it will stomp local content loads (EPUB chapters, offline viewers, help pages, etc).
- **When an activity "disappears with no crash," look for `finish()` in the dispatch path before suspecting the WebView or lifecycle.** The logcat showed `numActivities=0` within ~20ms of `Displayed` — that's the fingerprint of self-finishing, not a crash. Grepping the intent handling path for `finish()` landed on the bug immediately.
