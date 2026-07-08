2026-07-08

# WhisperASR: apply translation updates to items on the main actor

Translating a completed transcription (toolbar → Translate) mutated SwiftUI-observed state from a background thread. `AppState.translateItem()` spawned a plain `Task { ... }` from a nonisolated method — which in Swift 5 mode runs on the global concurrent executor — and inside it wrote `item.translatedSegments[...]`, and finally `item.isTranslating = false`, directly. `TranscriptionItem` is `@Observable` and those properties drive the transcript view and the toolbar spinner, so every write fired SwiftUI observation off the main thread. The rest of the codebase (live transcription, progress callbacks) carefully hops via `MainActor.run` for exactly these writes; this path predated that discipline.

The fix is minimal: the task body is now `Task { @MainActor in ... }`. The translation API calls (`TranslationService.translateSegmentsWithOpenAI`) are nonisolated async, so they still execute off the main actor during the `await`s — only the item mutations and toast calls land on main. The previous `await MainActor.run { showToast(...) }` wrappers inside the loop became direct calls.

A side benefit: the `transientFailures` counter is no longer captured by a `@Sendable` closure across executors, which removes the two "captured var in concurrently-executing code" warnings that were flagged as errors under Swift 6 language mode.
