2026-08-11

# EinkBro: Home page repositioned as a general mobile browser

The project site (docs/, GitHub Pages) framed EinkBro as an "Android Browser
for E-Ink Devices" in its title, hero tagline, and lead copy. That framing no
longer matches the product: EinkBro ships on Google Play for all Android
devices and on the Apple App Store via the iOS port, and its core features
(tap/volume-key paging, reader mode, EPUB export, zero animations) appeal
beyond e-paper hardware.

Both the English and zh-TW home pages now lead with "Small and Fast Mobile
Browser" and describe the experience as "built for all mobile platforms",
keeping the same feature pitch. The GitHub Pre-release (snapshot) button was
also dropped from the download row, leaving the stable channels: Google Play,
App Store, GitHub Releases, and F-Droid.

The copy edits were prepared in the working tree in an earlier session; this
session reviewed and committed them (`08790bedc`) after they were noticed
missing from the live site — GitHub Pages only rebuilds on push, so uncommitted
docs edits never publish.
