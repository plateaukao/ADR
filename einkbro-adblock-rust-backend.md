# einkbro: replace C++ adblock-client with Brave adblock-rust

## Problem

EinkBro's ad-blocking was a 3,500-line C++ fork of Brave's `ad-block`
library, wrapped in ~260 lines of JNI, last touched upstream in 2017.
No tests, no easy path to pick up fixes, memory-unsafe bloom filters
and hashsets. Correct EasyList/uBlock Origin syntax coverage was
slowly rotting while Brave moved to an actively-maintained Rust
rewrite (`adblock-rust`).

## Root Cause

The old module (`adblock-client/`) was a frozen point-in-time copy of
Brave's C++ adblock engine (DuckDuckGo fork lineage). Replacing it
means:

1. A new engine backend with equivalent behavior behind the existing
   `Client` interface so nothing above the loader layer changes.
2. A new on-disk format (the DAT file written by the old engine is
   byte-incompatible with `adblock-rust`'s `Engine::serialize()`
   output, which uses flatbuffers + a 4-byte magic header).
3. Rust toolchain and Android NDK cross-compile wiring in Gradle.

## Solution

### New module: `adblock-rust-client/`

- **Kotlin** — `AdBlockRustClient` implements the existing `Client`
  interface with the same `loadBasicData` / `loadProcessedData` /
  `getProcessedData` / `matches` / cosmetic getter surface that
  `FilterDataLoader` and `InstallationWorker` call. `Client`,
  `MatchResult`, and `ResourceType` were relocated from the deleted
  C++ module into this one under their original
  `io.github.edsuns.adblockclient` package so that the JNI `find_class`
  lookup for `MatchResult` stays unchanged and Detector imports don't
  move.
- **Rust** — a ~330-line crate in `adblock-rust-client/rust/` that
  pins `adblock = "0.12"` plus `jni = "0.21"` and exposes `#[no_mangle]
  extern "system"` functions matching the Kotlin class's `external fun`
  signatures. State is held in an `EngineHandle { engine, generic_hide }`
  `Box<>` handed back to Java as a `jlong`. `loadBasicData` / `loadProcessedData`
  rebuild the engine in place; the old handle is dropped and a new one
  returned so the Kotlin `enginePtr` is reassigned atomically.
- **Build wiring** — a `buildRustLibrary` Gradle task shells out to
  `cargo-ndk -t <abi> -o src/main/jniLibs build --release` for every
  ABI in `buildAbis` (or the default four), discovering the NDK via
  `ANDROID_NDK_HOME` with a `~/Library/Android/sdk/ndk/<latest>`
  fallback. The task is wired into AGP's `merge*JniLibFolders` tasks
  so the `.so` is in place before packaging.

### Cache invalidation

`BinaryDataStore` now writes a `.format_version` marker in
`filter_data/` and compares it on init. `FILTER_DATA_FORMAT_VERSION = 2`
in `Constants.kt`. On mismatch, every file in the directory is
deleted and the marker is rewritten. `AdFilterImpl.init` inspects
`binaryDataStore.wasPurged` and, if true, iterates
`viewModel.filters.value` and calls `viewModel.download(id)` for each
subscribed filter with a non-blank URL. The `InstallationWorker` then
persists the new Rust-serialized blob at the same path.

### What stayed unchanged

- `FilterResult`, `Detector`, `FilterViewModel`, `AdFilter`,
  `AdFilterImpl`'s public methods — app code (`NinjaWebViewClient`,
  `BrowserActivity`, `TabManager`, `EinkBroApplication`) compiles
  without modification.
- The download worker, subscription UI, shared-pref filter map
  serialization (kotlinx.serialization JSON) — these never touched
  the native layer.

## Key Files

- `adblock-rust-client/rust/src/lib.rs` — JNI bindings (~330 lines)
- `adblock-rust-client/rust/Cargo.toml`
- `adblock-rust-client/build.gradle` — cargo-ndk Gradle task
- `adblock-rust-client/src/main/java/io/github/edsuns/adblockrust/AdBlockRustClient.kt`
- `adblock-rust-client/src/main/java/io/github/edsuns/adblockclient/` — relocated `Client.kt`, `MatchResult.kt`, `ResourceType.kt`
- `ad-filter/src/main/java/io/github/edsuns/adfilter/impl/BinaryDataStore.kt` — version marker + purge
- `ad-filter/src/main/java/io/github/edsuns/adfilter/impl/FilterDataLoader.kt` — uses `AdBlockRustClient`
- `ad-filter/src/main/java/io/github/edsuns/adfilter/workers/InstallationWorker.kt` — uses `AdBlockRustClient`
- `ad-filter/src/main/java/io/github/edsuns/adfilter/impl/AdFilterImpl.kt` — auto re-download on `wasPurged`
- `ad-filter/src/main/java/io/github/edsuns/adfilter/impl/Constants.kt` — `FILTER_DATA_FORMAT_VERSION`
- Deleted: entire `adblock-client/` module (3,500 lines C++ + 260 lines JNI + CMake + duckduckgo-lineage Kotlin wrapper)

## Verification on emulator-5554

1. `./gradlew assembleDebug` succeeds after `cargo-ndk` produces `.so`
   for arm64-v8a, armeabi-v7a, x86, x86_64.
2. Fresh install launch → `BinaryDataStore` logs "filter cache format
   changed (0 -> 2), purging" → AdFilterImpl auto-triggers download
   of the default AdGuard Base subscription → `DownloadWorker` and
   `InstallationWorker` both return `SUCCESS` → binary file (7.1 MB,
   ~35% smaller than the old C++ DAT) written under
   `files/filter_data/`.
3. Force-stop + relaunch → FilterDataLoader.load() deserializes the
   binary with no errors. (Proven by a temporary log + permanent
   absence of `Failed to load filter data` in logcat.)
4. Reader mode, Settings menu, Search on site, Downloads picker,
   Bookmarks, tab overview, Input URL, Back — all tested, no crashes.
5. `./gradlew assembleRelease` succeeds. Per-ABI release APKs: 6.5 MB
   (armeabi-v7a), 7.1 MB (arm64-v8a), 7.1 MB (x86), 7.4 MB (x86_64).

## Lessons Learned

- **Grep for every call site before swapping.** The initial swap only
  updated `FilterDataLoader`; `InstallationWorker` was still calling
  `AdBlockClient` via a separate import, so the on-disk binary was
  being written in the old C++ format while the loader expected the
  new Rust flatbuffer format. The "BadHeader" deserialize error only
  surfaced on app restart, not on first run (since first run uses the
  in-memory engine directly). Lesson: `grep -rn AdBlockClient\\b` on
  the whole tree before deleting the old module, and add an
  in-process serialize→deserialize probe next to the write path when
  debugging round-trip issues.
- **Host-level cargo round-trip tests are cheap and definitive.** A
  10-line standalone `adblock` crate test that serializes a small
  `FilterSet` and immediately deserializes back confirms the crate
  itself is behaving before you go hunting in JNI-land.
- **Keep shared types in the replacement module, not deleted one.**
  Moving `Client.kt` / `MatchResult.kt` / `ResourceType.kt` into
  `adblock-rust-client/` under their original package meant the final
  "delete the old module" commit was a mechanical `rm -rf` with zero
  downstream source changes. Splitting the relocation into its own
  commit would have been even cleaner.
- **ABI fallback in Gradle is worth the 20 lines.** Reading
  `ANDROID_NDK_HOME` from env with a macOS default lookup
  (`~/Library/Android/sdk/ndk/<latest>`) makes the module work
  out-of-the-box for any contributor whose Android Studio installed
  the NDK but who never set the env var.
- **Binary Kotlin build artifacts (`jniLibs/<abi>/*.so`) should be in
  `.gitignore`, not committed.** They're regenerated on every build
  and adding them to the tree would balloon `git clone` size by
  ~6 MB per commit.
