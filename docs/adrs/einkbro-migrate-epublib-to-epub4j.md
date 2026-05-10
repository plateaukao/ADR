# einkbro: migrate epub handling from unmaintained epublib to epub4j

## Problem

EinkBro's EPUB save / open / TOC-edit flows relied on
`com.positiondev.epublib:epublib-core:3.1`, a fork of `psiegman/epublib` whose
last release was in 2014. The upstream project is dormant. The dependency also
dragged in `slf4j-api` and an awkward `xmlpull` exclusion, plus ProGuard keep
rules to survive release builds. There was no path to bug fixes, CVE patches,
or even compile-time updates.

## Root Cause

Choosing an unmaintained library at the time (2019-ish) and never revisiting
the choice. The app's own surface area on top of epublib had stayed small —
only one file, `EpubManager.kt`, ever imported anything under
`nl.siegmann.epublib.*` — so the risk of migrating had quietly shrunk over
time, but nobody had confirmed that.

## Solution

Swapped to `io.documentnode:epub4j-core:4.2.3`, the actively maintained fork
of epublib. The rewrite was almost mechanical:

- Replaced the dependency in `app/build.gradle.kts`. Kept the `xmlpull`
  exclusion (epub4j still ships both `kxml2` and `xmlpull` transitively, and
  Android already provides `xmlpull`, so the jar would otherwise collide on
  `org.xmlpull.v1.XmlPullParser`). Dropped the `slf4j-api` and `kxml2` direct
  dependency entries — epub4j no longer uses SLF4J, and kxml2 now comes in
  transitively.
- Updated seven imports in `EpubManager.kt` to `io.documentnode.epub4j.*`.
  One small rename: `nl.siegmann.epublib.service.MediatypeService` became
  `io.documentnode.epub4j.domain.MediaTypes`. The static `getMediaTypeByName`
  method and the `JPG` fallback constant both still exist.
- Dropped the now-orphan `slf4jApi` / `slf4j-api` and `kxml2` entries from
  `gradle/libs.versions.toml`.
- Dropped `-dontwarn org.slf4j.impl.StaticLoggerBinder` from
  `app/proguard-rules.txt`, and broadened the existing kxml2 `-dontwarn` to
  cover the whole package.
- Added a `packagingOptions` exclude for
  `META-INF/services/org.xmlpull.v1.XmlPullParserFactory`: kxml2 ships this
  services file with a **non-standard comma-separated** entry
  (`org.kxml2.io.KXmlParser,org.kxml2.io.KXmlSerializer` — two class names on
  one line). R8 reads it literally as a single class name, can't find it, and
  fails with "Missing class" in release builds. The file is useless on
  Android anyway, since the platform wires up kxml2 through its own
  `XmlPullParserFactory`.

Verified with both `./gradlew assembleDebug` and `./gradlew assembleRelease`
(full R8 + ProGuard). The public API of `EpubManager` did not change, so no
call-site edits were needed in `FileHandlingDelegate`,
`IntentDispatchDelegate`, `EpubReaderView`, or `EpubParser`.

End-to-end EPUB round-trip (save → re-open → append chapter → TOC edit →
verify in a third-party reader) is still TODO on-device.

## Key Files

- `app/build.gradle.kts` — dependency swap and packaging exclude
- `app/src/main/java/info/plateaukao/einkbro/epub/EpubManager.kt` —
  imports + one `MediatypeService` → `MediaTypes` rename
- `app/proguard-rules.txt` — dropped slf4j rule, widened kxml2 rule
- `gradle/libs.versions.toml` — removed `slf4jApi` / `kxml2` entries

## Lessons Learned

- **R8's "Missing class" errors won't always budge for `-dontwarn <fully
  qualified name>`.** In this case the "class name" was a comma-separated
  pair, and only a wildcard (`-dontwarn org.kxml2.io.**`) silenced it.
  When R8 suggests a keep/dontwarn rule in `missing_rules.txt`, verify the
  rule actually works — copy-pasting the suggestion isn't guaranteed to.
- **Non-standard Java service files are a release-build landmine on newer
  R8.** Debug builds don't run R8 and will hide the issue entirely. Always
  run `assembleRelease` before claiming a dependency swap is done, even if
  the classes seem API-compatible.
- **Check the transitive deps of a "drop-in" library.** epub4j *is* a
  near drop-in for epublib at the source level, but it still pulls the same
  dodgy `xmlpull` + `kxml2` pair that the old epublib dependency block had to
  manually work around — the workaround has to carry over.
- **Active maintenance status of a dependency should be part of the same
  review checklist as license, size, and API surface.** EinkBro accumulated
  an 11-year-stale dependency because nothing ever failed loudly; the cost of
  removing it today was ~15 lines of diff, but it could have been much worse
  if the library had been deeper in the call tree.
