2026-08-04

# EinkBro: README release badge showed Snapshot instead of the stable release

The README's release badge — the one meant to advertise the latest stable
version — was displaying "Snapshot (c124817)" instead of "Release v15.19.0".
The second badge next to it, which deliberately links to the snapshot
pre-release, was fine; the problem was that both badges effectively pointed at
the same thing.

## Root cause

The badge used badgen's plain endpoint, `badgen.net/github/release/<owner>/<repo>`,
which reports the *most recent* GitHub release of any kind. EinkBro maintains a
rolling "Snapshot" pre-release that is re-published on every CI build, so it is
always the newest release — the stable badge could therefore never show a
stable version.

## Fix

One-line README change:

- Badge image now uses badgen's `/stable` variant
  (`github/release/plateaukao/einkbro/stable`), which skips pre-releases and
  reports the latest stable release.
- The badge's link target changed from the general `/releases` list to
  `/releases/latest`, GitHub's canonical latest-stable page, matching what the
  badge now displays.

Verified by fetching both badgen endpoints: the plain one renders
"Snapshot (c124817)", the `/stable` one renders "Release v15.19.0".
