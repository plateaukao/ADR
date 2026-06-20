# NerLan — remember transcript translate view-mode (cached-only)

## Summary

The transcript translate view-mode — original / original+translation /
translation-only — used to reset to *original* every time a transcript opened, so
the user had to re-tap the globe each time. It's now a **remembered preference**.
On open the preferred mode is reapplied, but **only when a matching translation is
already cached**; otherwise the original is shown and no translation is started.
Applied to both the iOS and Android apps.

## Approach

- **Persist the mode.** iOS: `@AppStorage("transcriptTranslateMode")`. Android: a
  `transcriptTranslateMode` field in `SettingsStore` (SharedPreferences). The globe
  cycle writes the chosen mode to it (including back to 0), and the deferred apply
  after an on-demand translation finishes writes it too.
- **Cached-only restore on open.** On appear, if the preference is a translated
  mode *and* `AIContentStore.translation(id)` exists with `language ==`
  the current target language, switch to that mode and load the cached sentences;
  otherwise stay on the original. This reuses the same cache/language check the
  globe button already used.
- **Never auto-generate.** The restore path only reads the cache — it never calls
  `translate(...)`. Generation still happens solely on an explicit globe tap (which
  needs an API key), preserving the long-standing "opening a transcript never
  silently starts a paid job" guarantee.

Why cached-only rather than auto-translating to honor the preference: a transcript
can be long and translation is a paid OpenAI call; silently spending on open —
possibly for an episode the user only glanced at — is exactly what the original
reset-to-original design avoided. Remembering the preference but gating it on an
existing cache keeps the convenience without the cost.

## Trade-offs

- If the preference is translation-only but no cached translation exists, the user
  sees the original until they tap the globe to generate. Intentional (no surprise
  spend), and once generated it sticks for next time.
- The cache is per target language, so changing the Settings language falls back to
  original on the next open until that language is generated.
- The preference is global across episodes (one setting), not per-episode — matches
  how font-size is remembered.

## Key Files

- `NerLan/Sources/Views/TranscriptView.swift` — `translatePreference` (`@AppStorage`),
  `restoreTranslatePreference()` on appear, persistence in `cycleTranslate` / the
  job-finished handler.
- `app/.../data/SettingsStore.kt` — `transcriptTranslateMode` flow + setter.
- `app/.../ui/TranscriptDialog.kt` — initial `translateMode` from preference ∧ cached
  translation; persistence in `cycleTranslate` and the pending-mode `LaunchedEffect`.
