# NerLan Android — fuller punctuation in transcript segmentation

## Summary

Ports the iOS change to the Android app: the `segmentTranscript` chat prompt now
inserts the full range of punctuation (commas, question/exclamation marks —
full-width for Chinese, half-width otherwise) instead of only sentence-final
periods, while still never translating or altering the transcribed words.

## Approach

Prompt-only change in `OpenAIService.segmentTranscript`; no code paths touched.
Same rules as the iOS version — see `nerlan-transcript-punctuation.md`:
insert appropriate punctuation, keep punctuation that's already correct, never
alter content, output one sentence per line.

## Trade-offs

Slightly more model latitude than period-only, guarded by the "verbatim content"
rule; in exchange the transcript reads naturally instead of as comma-less run-ons.

## Key Files

- `app/src/main/java/com/example/nerlan/data/OpenAIService.kt`
