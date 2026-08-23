2026-08-24

# sharik-android: dialog buttons were invisible on Onyx Boox

On the Boox Go 7 Color the Receive / Share dialogs showed an empty button bar:
the *Close* button existed (uiautomator listed `button2 "Close"` spanning the
full width, the Onyx dialog layout stacks buttons) but its text was white on a
white bar. Onyx's `Theme.DeviceDefault` routes `AlertDialog` buttons through
the app-wide `android:buttonStyle` — which this app sets to white-text-on-blue
pills for its main buttons — and ignores `buttonBar*ButtonStyle`, so the text
color came through without the background.

Two layers of fix: a dedicated `AppDialog` theme with borderless brand-colored
`DialogButton` styles (enough on AOSP), and, because the OEM theme still won
on the Boox, an `AlertDialog.styled()` extension that sets text color,
transparent background and no state-list animator on all three buttons right
after `show()`. Every dialog in `MainActivity` goes through it. Released as
v1.0.1.
