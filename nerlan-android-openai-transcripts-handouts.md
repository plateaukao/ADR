# NerLan Android: OpenAI transcripts & AI handouts

_Android — commit `a2db33b` on `main` (plateaukao/nerlan-android); released as v1.1._

## Summary

Port of the iOS "OpenAI transcripts & AI handouts" feature to the Kotlin/Jetpack Compose Android app so the two stay in sync. With the user's own OpenAI key (set via a Settings gear in the 節目 tab), each episode gains two gated actions: **逐字稿** (transcribe → segment into a sentence-by-sentence list) and **AI 講義** (transcript → HTML study handout in a WebView). See the iOS ADR (`nerlan-openai-transcripts-handouts.md`) for the shared design; this records the Android-specific choices.

## Approach

Followed the app's existing patterns: stores hang off the `NerLanApp.instance` Application singleton (like `favorites`/`downloads`), networking is OkHttp, persistence is plain files in `filesDir`, UI is Compose with full-screen `Dialog`s (like `AttachmentViewer`). The pipeline mirrors iOS: audio → transcode → transcribe → AI segmentation (Taiwan Traditional Chinese, foreign languages kept genuine) → save; handout = transcript → chat model → save fragment.

Platform-specific decisions:

- **Audio shrink uses media3 Transformer** (`media3-transformer`, the one new dependency) instead of the iOS `AVAssetWriter`. `ChannelMixingAudioProcessor` (stereo→mono) + `SonicAudioProcessor` (→16 kHz) via `EditedMediaItem` effects, exporting AAC. media3 (1.9.0) was already the playback stack. The whole media3 `@UnstableApi` opt-in is confined to that one function, whose signature uses only stable types, so it doesn't force opt-in on every `NerLanApp.instance` caller.
- **API key in app-private `SharedPreferences`**, not the iOS Keychain. A personal app; `MODE_PRIVATE` storage is adequate and avoids the deprecated EncryptedSharedPreferences dependency.
- **Handout theming applied at display time.** The store saves the raw HTML *fragment*; `HandoutDialog` wraps it with explicit light/dark colors chosen from `isSystemInDarkTheme()` and loads it into a `WebView`. This avoids depending on `androidx.webkit` to make a WebView honor `prefers-color-scheme`.
- **Transcript list** is a Compose `LazyColumn` (cell reuse) wrapped in a `SelectionContainer` for copy — the idiomatic Android equivalent of the iOS `List` + context-menu approach; Compose selection doesn't have the per-row cost that forced `.textSelection` off on iOS.
- **Long timeouts** via a dedicated OkHttp client (300 s read/write, 30-min call) so ~30-min transcriptions don't hit the default timeout.
- Job state is a `StateFlow<Map<String, JobState>>`; jobs run on the store's `CoroutineScope`, so they survive the player sheet being dismissed and the icons reflect running/failed/ready via `collectAsState`.

## Trade-offs

- **One new dependency** (`media3-transformer`) — justified: clean, correct mono/16 kHz transcode reusing the existing media3 stack, versus a hand-rolled `MediaCodec` transcode.
- **`bri` deploy quirk:** the `~/bin/bri` script builds the signed release correctly but its install step references `app-arm64-v8a-release.apk`; this project has no ABI splits, so the real output is `app-release.apk`. Installed with `aaa install -r app/build/outputs/apk/release/app-release.apk` (replace-in-place, never uninstall — preserves on-device data). Worth fixing that one line in `bri`.
- API key in plain (app-private) prefs rather than encrypted storage — acceptable for a personal app, noted for parity awareness with the iOS Keychain choice.

## Key Files

New: `data/SettingsStore.kt`, `data/OpenAIService.kt`, `data/AudioTranscoder.kt`, `data/AIContentStore.kt`; UI `ui/AiActions.kt` (shared `AiActionButton`), `ui/SettingsScreen.kt`, `ui/TranscriptDialog.kt`, `ui/HandoutDialog.kt`.

Modified: `NerLanApp.kt` (singletons), `ui/ProgramListScreen.kt` (settings gear), `ui/PlayerSheet.kt` (AI tools row), `ui/FavoritesScreen.kt` (`RecordRow` icons, shared with Downloads); `app/build.gradle.kts` + `gradle/libs.versions.toml` (transformer dep), version bumped to 1.1 / versionCode 2.

## Release

`v1.1` GitHub releases on both repos. iOS: `bash Scripts/build_release.sh` → dev-signed `NerLan.ipa`. Android: `bri` (signed release) → `app-release.apk`. Note: iOS version lives in `project.yml` (xcodegen regenerates `Info.plist`, so a version set only in `Info.plist` is reset to 1.0 on the next build).
