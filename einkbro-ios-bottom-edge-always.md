2026-07-18

# EinkBro iOS: content always reaches the bottom screen edge

Committed as `011c5f0`.

Follow-up to the fullscreen bottom-edge change: the user asked whether the
content area (toolbar or webview) can always extend to the physical bottom
edge, not only in fullscreen. It can — the gap was just the layout reserving
the bottom safe-area inset for the home indicator.

`BrowserScreen`'s root insets now never include the bottom side: normal mode
keeps top + horizontal safe areas, fullscreen/hidden-statusbar modes keep
horizontal only. The bottom toolbar sits flush with the screen edge with the
home indicator drawn over its lower few points (taps there still land;
only an upward swipe belongs to the system), and in top/vertical-toolbar
layouts the page itself runs to the last pixel. Simulator-verified with the
vertical rail: page content renders to the bottom edge with no reserved
strip.
