2026-07-07

# NerLan: translation rows could shift onto the wrong sentences within a batch

## What was broken

The transcript screen shows each sentence with its translation on the row below
it. `translateSentences` sends ~40-sentence batches and instructs the model to
return exactly one line per input line; rule 3 of the prompt explicitly allows a
blank answer for an untranslatable line (e.g. punctuation-only). But the
reconciliation step did

```kotlin
raw.split("\n").map { it.trim() }.filter { it.isNotEmpty() }
```

— dropping *every* empty line, including interior ones — and then padded at the
end. If the model answered sentence 5 of a batch with a blank, sentences 6–40
each displayed the previous sentence's translation. The end-padding only
protected alignment *across* batches, not within one.

## Fix

Reconciliation now keeps interior blanks in place and strips only the padding
around the block (`dropWhile`/`dropLastWhile` on emptiness), then cuts extras
from the end / pads missing lines as before. The logic moved into an internal
`reconcileBatch(raw, expected)` function.

## Verification

The OpenAI path can't be driven end-to-end without a real API key, so the
reconciliation is covered by unit tests instead — the project's first
(`OpenAIServiceTest`, 5 cases: interior blank kept in place, surrounding padding
stripped, extras dropped, missing padded, exact match). All pass.

Commit: `fa6fa01` in nerlan-android.
