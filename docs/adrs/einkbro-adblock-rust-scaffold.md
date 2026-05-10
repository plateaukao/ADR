# einkbro: scaffold adblock-rust-client module

## Problem

EinkBro's ad-blocking uses a fork of Brave's C++ `ad-block` library that the
upstream has abandoned. Rule parsing rots, no test coverage, 3.5k lines of
hand-written C++ including bloom filters and hash tables. We want to swap it
for Brave's actively maintained `adblock-rust`.

## Root Cause

The Kotlin `Client` interface is satisfied by a single native-backed class
(`AdBlockClient`) that the Kotlin code tightly instantiates via
`FilterDataLoader`. Any replacement has to compile against the same interface
so callers don't change.

## Solution

Created a new Gradle module `adblock-rust-client/` with:
- Minimal Android library `build.gradle` + manifest
- Kotlin class `AdBlockRustClient` implementing the existing `Client`
  interface with `TODO()` stubs, plus the three concrete methods
  (`loadBasicData`, `loadProcessedData`, `getProcessedData`) that
  `FilterDataLoader` calls directly. Native entry points declared
  (`nativeCreateEngine`, `nativeReleaseEngine`).
- Rust crate skeleton pinning `adblock = "0.9"` + `jni = "0.21"`, `cdylib`
  type, release profile with LTO + symbol strip.
- ProGuard keep rule for the native method names.

Wired into `settings.gradle` and `ad-filter/build.gradle` alongside (not
replacing) the old module. No runtime behavior change — nothing references
`AdBlockRustClient` yet. Verified via
`./gradlew :adblock-rust-client:compileDebugKotlin :ad-filter:compileDebugKotlin`.

## Key Files

- `adblock-rust-client/build.gradle`
- `adblock-rust-client/src/main/java/io/github/edsuns/adblockrust/AdBlockRustClient.kt`
- `adblock-rust-client/rust/Cargo.toml`
- `adblock-rust-client/rust/src/lib.rs`
- `settings.gradle`
- `ad-filter/build.gradle`

## Lessons Learned

- Keeping the old and new modules coexisting during scaffolding keeps the
  project buildable at every step, so the big-bang swap only happens when
  the Rust side is actually functional.
- `System.loadLibrary` in a Kotlin companion init block only fires on first
  class reference. Scaffolding a class that never gets instantiated at
  runtime is safe even without a shipped `.so`.
