2026-06-21

# EinkBro: offline error page reload, retry, and auto-recovery

## What was broken

When a page failed to load offline, EinkBro showed a custom error page (with a
friendly reason and a little horse mini-game). Two things didn't work:

- **The toolbar reload button never recovered.** Pressing reload just re-showed
  the error page forever, even after the network came back.
- **Retry was unreliable.** Tapping Retry several times — especially around the
  moment connectivity returned — could leave the user stuck on the error page.

## Root cause

The error page was displayed with a real navigation:

```kotlin
ebWebView.loadUrl("file:///android_asset/error_page.html?url=...&reason=...")
```

That makes the *asset file* the WebView's current document, so `getUrl()` returns
`file:///android_asset/error_page.html`. Everything downstream then operated on
the wrong URL: the toolbar's `reload()` reloaded the static error page instead of
the failed site, and the address bar reflected the file URL. Retry worked off a
*separately* tracked `lastFailedUrl` in the presenter, and because each tap posted
its own `loadUrl`, rapid taps could race each other.

## The fix

Stop navigating to the asset. Render the error page with `loadDataWithBaseURL`
(reading the asset HTML directly), and introduce a single `errorPageUrl` flag on
`EBWebView` as the one source of truth for "an error page is currently showing for
URL X". Every recovery path consults that flag:

- `reload()` — if `errorPageUrl` is set, re-fetch the **real** URL with a forced
  network load instead of reloading the error document.
- `retryErrorPage()` — consumes the flag atomically, so repeated Retry taps
  collapse into a single reload (the second tap finds the flag already cleared).
- `albumUrl` returns `errorPageUrl` while the error page is up, so the address
  bar, bookmarks, and share all see the real failed URL.
- the error page is no longer recorded in history.

The flag is set in `showOfflineErrorPage()` and cleared in `resetState()` (which
every genuine navigation already runs), so the lifecycle stays self-correcting.

```mermaid
flowchart TD
    Fail[Main-frame load fails while offline]

    subgraph Before["Before: broken"]
        direction TB
        B2["loadUrl file://.../error_page.html"]
        B3["WebView URL becomes the file page"]
        B4{"reload or retry"}
        B5["reload re-loads the file page"]
        B6["stuck: never re-fetches the site"]
        B2 --> B3 --> B4
        B4 -->|toolbar reload| B5 --> B6
        B4 -->|retry, rapid taps race| B6
    end

    subgraph After["After: fixed"]
        direction TB
        A2["showOfflineErrorPage: set errorPageUrl + loadDataWithBaseURL"]
        A3["WebView URL stays the real failed URL"]
        A4{"toolbar reload / Retry tap"}
        A5["retryErrorPage consumes the flag once"]
        A6["loadUrl real URL, forced network"]
        A7["real site loads"]
        A2 --> A3 --> A4 --> A5 --> A6 --> A7
    end

    Fail --> B2
    Fail --> A2
```

## Auto-recovery: tried, then deliberately dropped

The first cut tried to make the page recover on its own when the network came
back. Listening for the JS `online` event was the obvious approach, but on-device
testing confirmed Android's WebView does **not** reliably fire `online`/`offline`
or update `navigator.onLine` from system connectivity changes — toggling airplane
mode back off left the page sitting on the error screen.

So that version *actively probed* the failed URL with a `fetch(url, {mode:
'no-cors'})` every 3 seconds and reloaded the instant it resolved. It worked, but
the trade was wrong for the target device: a timer that wakes the CPU/radio every
few seconds drains an idle E-ink reader's battery for a payoff (saving one tap)
that doesn't justify the cost. **The poll was removed.**

Recovery now relies on an explicit user action — tapping **Retry** or the toolbar
**reload**, both of which re-fetch the real URL — plus the free `online` listener
left in place for the WebView builds that *do* deliver the event (it costs nothing
when it never fires). No timers, no background network use.

Two smaller touches remain: the Retry button shows "Reconnecting…" and disables on
tap, and the title adapts — "You're offline" only for an actual connectivity drop,
otherwise "Can't reach this page" (DNS, refused, cert).

```mermaid
stateDiagram-v2
    [*] --> Showing: error page rendered
    Showing --> Retrying: user taps Retry / toolbar reload
    Showing --> Retrying: WebView fires 'online' (if it does)
    Retrying --> [*]: loadUrl real URL
```

## Verified on device

Tested on a physical API 32 device by toggling airplane mode: manual Retry after
reconnect loads the page, and the toolbar reload re-fetches the real URL rather
than the error document.
