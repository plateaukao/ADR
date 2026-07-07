2026-07-07

# EinkBro: fullscreen system bars on API 30+ — transient swipe + symmetric restore

Browsing fullscreen (`FullscreenDelegate.hideStatusBar`) called
`insetsController.hide(...)` without setting `systemBarsBehavior`. With the
default behavior, a single edge swipe re-shows the system bars
*permanently* — the user is stuck with bars in "fullscreen" until toggling
the mode. The app's own video-fullscreen path
(`ViewUnit.setCustomFullscreen`) already sets
`BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE`; browsing fullscreen now does the
same, so a swipe reveals the bars transiently and they auto-hide again.

The pair was also asymmetric: `hideStatusBar()` hides the navigation bars
too when edge-to-edge is enabled, but `showStatusBar()` only re-showed the
status bars — after leaving fullscreen the nav bars stayed hidden. Restore
is now symmetric.

Compile-verified; the change replicates the already-working pattern from
the video path. (Browsing fullscreen isn't reachable from the default
emulator toolbar/menu config, so no live drive.)
