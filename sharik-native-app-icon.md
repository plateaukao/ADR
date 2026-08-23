2026-08-23

# sharik-native: a 46 KB app icon with no design tools

The app needed an icon; the question was the cheapest way to get one, in
effort and in bytes. The answer borrows OhMyBias's approach (a hand-made
`icon.icns` referenced by `CFBundleIconFile`, no asset catalog) and goes a
step further on size.

- `tools/make-icon.swift` (AppKit, ~30 lines) draws the SF Symbol
  `arrow.up.arrow.down.circle.fill` in white on a flat blue rounded square
  and writes a 1024 px PNG. A gradient background was tried first; it looked
  nicer but its `.icns` was 654 KB against an 860 KB app.
- `tools/pack-icns.py` resizes the PNG into all eleven PNG-capable ICNS
  slots, quantizes each to a 256-colour palette (lossless to the eye for a
  flat icon) and writes the chunks directly, because `iconutil` re-encodes
  the PNGs and triples the size: 46 KB versus 113 KB for the same pixels.
- `make icon` regenerates `Sharik/Resources/icon.icns`; the bundle grew from
  860 KB to 908 KB.

macOS 26 applies its Liquid Glass treatment to flat icons on its own, so the
icon looks native in Finder and the Dock without an Icon Composer project.
