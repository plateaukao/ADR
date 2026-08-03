2026-08-04

# EinkBro site: Google Play download card, oversized Apple logo removed

Two changes to the download page (`docs/download.html` and its zh-TW twin), commit `bd609395c`.

The iOS App Store card was rendering a giant Apple logo that filled the whole card. The inline SVG had `class="card__icon"` — a class that doesn't exist in `style.css` (the homepage's feature cards use `feature-card__icon`, which is defined). With no size constraint, the SVG expanded to the container width. Since every other download card is text-only anyway, the fix was to drop the logo rather than style it: the card now matches the rest of the grid.

The page also gained a **Google Play Store** card, now that EinkBro is on the Play Store as the `info.plateaukao.einkbro.g` edition (the separate app ID created for Play-policy compliance — no in-app self-update). Its copy notes the practical consequence of the separate ID: the Play build installs alongside the APK/F-Droid version and doesn't share its data.

A follow-up (`7c7324729`) settled the final order and naming: GitHub Releases, **GitHub Pre-release** (was "Snapshot Pre-release"), F-Droid, Google Play Store, iOS App Store — grouping the two GitHub cards together, with the zh-TW page mirroring both (GitHub 搶先版, Google Play 商店).
