# EinkBro Architecture Cleanup

## Problem

The EinkBro codebase had accumulated several structural friction points identified in an architecture review:
1. `RecordRepository` used `runBlocking` on ~10 DAO calls, risking ANR on the main thread
2. `BaseWebConfig` (AdBlock, Javascript, Cookie) spawned raw `Thread`s with no lifecycle management
3. `ConfigManager` had ~250 lines of forwarding boilerplate delegating to sub-configs (AiConfig, TtsConfig, etc.) that added no value
4. `EinkBroApplication.instance` was a static mutable singleton bypassing DI
5. Delegate classes (TabManager, ActionModeDelegate, etc.) each took 10-16 lambda/provider constructor parameters for shared mutable state

## Root Cause

These were incremental debt from the codebase's evolution — good patterns (sub-configs, delegate decomposition, Koin DI) had been partially adopted but not completed, leaving transitional scaffolding in place.

## Solution

Five incremental changes across 65 files (+654 / -792 lines, net reduction of 138 lines):

1. **RecordRepository**: Converted all `runBlocking` methods to `suspend` functions. Updated callers (BaseWebConfig, OverviewDialogController, BrowserUnit, ClearService, BackupUnit, DataListActivity, SettingActivity) to use coroutine scopes.

2. **BaseWebConfig**: Replaced raw `Thread` + `runBlocking` init with a `CoroutineScope`-launched init block. `loadHosts()` uses `withContext(Dispatchers.IO)`. `DomainInterface` methods became `suspend`, propagated to all implementations.

3. **ConfigManager**: Updated 266 call sites across 37+ files from `config.gptApiKey` to `config.ai.gptApiKey` (and similarly for tts, translation, touch, display). Removed all forwarding properties and 70+ companion constant aliases, cutting ConfigManager roughly in half.

4. **EinkBroApplication**: Removed `companion object { lateinit var instance }`. `ViewUnit.dpToPixel` now uses `Resources.getSystem()`. `FileHelper` uses Koin-injected `Context`.

5. **BrowserState**: Introduced a shared state class holding `ebWebView`, `binding`, `currentAlbumController`, `longPressPoint`, `searchOnSite`, `mainContentLayout`, `progressBar`, `composeToolbarViewController`, `fabImageViewController`. All 9 delegates now receive this single object instead of individual provider lambdas. BrowserActivity's fields delegate through BrowserState to keep state in sync.

## Key Files

- `app/src/main/java/info/plateaukao/einkbro/database/RecordRepository.kt` — suspend conversion
- `app/src/main/java/info/plateaukao/einkbro/browser/BaseWebConfig.kt` — coroutine init
- `app/src/main/java/info/plateaukao/einkbro/preference/ConfigManager.kt` — forwarding removal
- `app/src/main/java/info/plateaukao/einkbro/EinkBroApplication.kt` — singleton removal
- `app/src/main/java/info/plateaukao/einkbro/activity/BrowserState.kt` — new shared state class
- `app/src/main/java/info/plateaukao/einkbro/activity/BrowserActivity.kt` — delegate wiring update
- `app/src/main/java/info/plateaukao/einkbro/activity/delegates/*.kt` — all 9 delegates simplified

## Lessons Learned

- Forwarding properties/constants that exist solely to avoid updating call sites become permanent debt — better to do the mechanical grep-and-replace migration and delete them.
- `runBlocking` in repository classes is particularly dangerous in Android because callers may be on the main thread; always prefer `suspend` and let the caller choose the scope.
- A shared state object for related mutable fields is cleaner than passing 15+ lambdas, especially when most are just `{ fieldName }` providers — the indirection adds no value over direct field access.
- When removing a static singleton, `Resources.getSystem()` is a good alternative for display metrics that doesn't require a Context at all.
