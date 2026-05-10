# whisperASR — Live Transcription + Translation Improvements (Plan)

Planning document for high/medium-impact fixes to the live transcription + live translation pipeline. Captured in ADR for durability; working copy lives at `~/.claude/plans/eventual-weaving-island.md`.

## Problem

The live transcription + live translation pipeline (introduced in the most recent feature commits) has several gaps uncovered during a focused review:

- **Audio quality**: 48→16 kHz conversion in `AudioRecorder` takes every 3rd sample with no low-pass filter → aliasing above 8 kHz; degrades whisper accuracy on sibilants and high-pitched voices.
- **Wasted work**: `pendingTranslationSnapshots` in `AppState` accumulates superseded cumulative snapshots; if the API is slower than transcription the queue grows unbounded.
- **Silent failures**: `service.preloadModel()` errors are swallowed with `try?`; `transcribeChunk` has no timeout (Metal/GPU hang deadlocks the loop); translation errors retry forever with no backoff and no user feedback.
- **Poor error messaging**: `TranslationService` surfaces `HTTP 401` / `HTTP 404` indistinguishably with no body parsing; single network attempt with no transient retry.
- **Cascading re-translation**: whenever a segment near the start of the transcript shifts text (common in whisper's overlap zone), the entire transcript re-translates every chunk.

## Root Cause

Rapid feature iteration: the live path was added as a streaming extension of the existing file-transcription flow without the robustness layer (timeouts, backoff, error surfacing, queue discipline) that production recording sessions require. Downsampling was written inline instead of reusing `AVAudioConverter`.

## Solution (scope: high + medium impact)

### High-impact
1. **`Sources/AudioRecorder.swift`** — replace manual decimation loop with `AVAudioConverter` (48k mono Float32 → 16k mono Float32). `AVFoundation` already imported; `AVAudioEngine` patterns already used for mic mixing.
2. **`Sources/AppState.swift`** — coalesce `pendingTranslationSnapshots` into a single-slot `[TranscriptionSegment]?`; worker always translates the freshest snapshot.
3. **`Sources/AppState.swift`** — add observable `liveError: String?`; surface `preloadModel` failures instead of swallowing with `try?`; display via small banner in `RecordingView`.
4. **`Sources/AppState.swift`** — wrap `transcribeChunk` in `withTimeout` helper (using `withThrowingTaskGroup`) with generous but finite deadline; on timeout log + surface banner and continue the loop.

### Medium-impact
5. **`Sources/AppState.swift`** — add `liveTranslationError: String?` + exponential backoff (500 ms → 30 s cap) on repeated translation failures; pause translation on auth-class errors until next start.
6. **`Sources/TranslationService.swift`** — expand `TranslationError` with `authFailed / rateLimited / serverError`; parse OpenAI `{"error": {"message": ...}}` body for human-readable messages.
7. **`Sources/TranslationService.swift`** — transient retry (≤2 retries, 500 ms / 1.5 s backoff) for URLSession transport errors and 5xx only; never retry 4xx auth errors.
8. **`Sources/AppState.swift`** — "seal" translated segments once source text has been stable across 3 consecutive chunks (`liveTranslatedSealCount: [Int]`); bounds re-translation to the unsealed tail.

### Out of scope
SwiftUI `List` virtualization (`List` is already lazy), watchdog stall-detection timing, whisper thread-count tuning, `isChunkTranscribing` redundancy (noted as a low-impact nit).

## Key Files

- `Sources/AudioRecorder.swift` — resampling (callback at ~line 680).
- `Sources/AppState.swift` — live transcription loop (lines 200–360), translation queue (lines 440–530).
- `Sources/TranslationService.swift` — whole file (errors + HTTP call).
- `Sources/RecordingView.swift` — minimal banner to display `liveError` / `liveTranslationError`.

## Verification

No test suite. Manual verification per item (build clean, record speech, toggle invalid API key, drop network, record long sessions). Final smoke test: `swift run &` after killing existing WhisperASR, record 3 min with live translation on, stop, confirm file saves with live results preserved.

## Lessons Learned

- Intermediate review identified several agent claims that were wrong (off-by-one, missing cancellation on stop, `enqueueLiveTranslation` called unconditionally). Always verify agent findings against source before acting — confirmation bias is expensive.
- Cumulative snapshots + unbounded queue is a common anti-pattern; single-slot coalescing is the right default when each message supersedes prior ones.
- Naive every-Nth-sample decimation is only correct if the source is already band-limited below the new Nyquist frequency. `AVAudioConverter` is the right tool because it does the low-pass for you.
