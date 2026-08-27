2026-08-28

# Shrink media3 in the release APK: scope the R8 keep rule to transformer

The NerLan release APK on GitHub was 5.26 MB. `classes.dex` alone was 3.84 MB, and
`androidx.media3` accounted for 2.48 MB of the 6.5 MB of uncompressed dex — 25,453
methods, 38% of all code — because `proguard-rules.pro` carried

```
-keep class androidx.media3.** { *; }
```

which pins every media3 class: no shrinking, no optimization, no obfuscation.
Narrowing that one rule took the APK from 5.26 MB to 4.43 MB (−16%).

## Why the rule existed

The rule guards against a real R8 bug (androidx/media#2535). `LogSessionId` is an
API-31 platform class. In R8-minified release builds the transcribe path crashed on
Android 10 with `NoClassDefFoundError: android.media.metrics.LogSessionId`, because
R8's optimizer (inlining, horizontal class merging) had moved a reference to that
class into a method ART verifies eagerly when a class loads — the `SDK_INT >= 31`
guard was still there, but verification happens before the guard runs. A keep rule
on `LogSessionId` itself is useless (the class doesn't exist on the device), and
pinning individual media3 classes only made R8 relocate the reference somewhere
else, so the blunt "keep everything" rule was adopted.

## What actually needs protecting

Inspecting the media3 1.9.0 AARs (`javap` over every class that mentions
`android/media/metrics/LogSessionId`) showed the two modules differ:

| module | where `LogSessionId` appears |
|---|---|
| `media3-exoplayer` | only inside `@RequiresApi(31)` nested helpers: `PlayerId$LogSessionIdApi31`, `MediaCodecRenderer$Api31`, `ExoPlayerImpl$Api31`, `FrameworkMediaDrm$Api31`, `MediaParserUtil$Api31` |
| `media3-transformer` | as a plain parameter in core signatures — `Codec.DecoderFactory.createForAudioDecoding(Format, LogSessionId)`, the `TransformerInternal`, `ExoPlayerAssetLoader`, `AudioSampleExporter` constructors, ~20 classes |

The exoplayer pattern is exactly what R8's API-level modeling is built for: a class
marked API 31 is never merged into or inlined into a lower-API class. Transformer's
pattern gives R8 nothing to respect, so any optimization touching those methods can
trip the verifier below API 31. Upstream has not changed this as of 1.9.0.

## The rule now

```
-keep,allowshrinking,allowobfuscation class androidx.media3.transformer.** { *; }
```

`-keep` without `allowoptimization` still disables optimization on the matched
classes — the only step that breaks the `SDK_INT` guards — while the two modifiers
let R8 remove unused code and rename what's left. Scoping it to the transformer
package leaves exoplayer, session, extractor, common and datasource fully processed.

Measured on the same source (unsigned builds, signing adds a few KB):

| media3 rule | APK | dex methods |
|---|---|---|
| `-keep class androidx.media3.** { *; }` (before) | 5.26 MB | 52,484 |
| `-keep,allowshrinking,allowobfuscation` on all of media3 | 4.61 MB | 43,202 |
| rule removed entirely (not safe) | 4.39 MB | 33,409 |
| scoped to `transformer.**` with the modifiers (shipped) | 4.43 MB | 34,436 |

## Verification

Verified on the Hisense A7 (Android 10, API 29) with the signed release build:
playback runs, and a full Transformer transcode of a podcast episode initialised,
ran for 48 s and released cleanly — the crash this rule guards against fired
instantly at Transformer init when it was present. That test also surfaced an
unrelated problem in the transcription pipeline (the upload was far too large for
an LTE uplink), which is written up in
[nerlan-android-transcription-speed](nerlan-android-transcription-speed.md).

The same commit removes a duplicated WorkManager/Room keep block from the rules
file; the surviving copy carries the fuller explanation.
