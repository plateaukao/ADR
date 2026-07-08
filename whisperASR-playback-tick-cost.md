2026-07-08

# WhisperASR: lighter playback ticks — 10 Hz observer, binary-search highlight

Two multiplied costs made audio playback busier than it needed to be:

1. `AudioPlayerManager` registered its periodic time observer at 0.05 s (20 Hz). Every tick publishes `currentTime`, invalidating the player bar and the transcript view through `@Observable`.
2. Each tick, `DetailView.updateHighlight` found the segment to highlight with `lastIndex(where: { $0.start <= time })` — a linear scan over the whole transcript. On a two-hour recording with a few thousand segments that's tens of thousands of comparisons per second, forever, while playing.

The observer now ticks at 10 Hz — segments span seconds, so highlight granularity is unaffected, and a 10 fps slider still reads as smooth — and the segment lookup is a binary search over the start-time-ordered segment array (whisper emits segments sequentially, and live-transcription results are built in order, so the ordering invariant holds for every item source).
