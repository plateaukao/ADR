# NerLan — fuller punctuation in transcript segmentation

## Summary

The transcript segmentation step (a chat-model pass that turns raw ASR output
into one-sentence-per-line text) previously only added sentence-final periods.
This change broadens it to insert the full range of appropriate punctuation —
commas, question marks, exclamation marks — while still never altering the
underlying transcribed words.

## Approach

Only the system prompt in `OpenAIService.segmentTranscript` changed; no code
paths were touched. The revised rules:

1. Insert appropriate, necessary punctuation (period/question/exclamation/comma;
   full-width `，。？！` for Chinese, half-width `,.?!` for other languages) and
   break one sentence per line.
2. Preserve punctuation that is already correct — don't double up (e.g. don't
   append `。` after an existing `？`).
3. Never translate, rewrite, add, remove, reorder, or change any character;
   simplified/traditional and foreign-language text stay verbatim.
4. Output only the processed transcript, one sentence per line, no numbering or
   commentary.

The "never alter content" guarantee is retained verbatim, since the segmentation
output is what the user reads and what the handout generation consumes — the step
must stay punctuation-only.

## Trade-offs

- A more permissive punctuation instruction gives the model slightly more latitude,
  which marginally raises the risk of an over-eager edit; rule 3 (verbatim content)
  is the guardrail. The previous period-only prompt was safer but produced
  comma-less, run-on sentences that read poorly for study.

## Key Files

- `NerLan/Sources/OpenAIService.swift` — `segmentTranscript` system prompt.
