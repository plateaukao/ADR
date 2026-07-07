2026-07-07

# EinkBro: keep TTS progress ticks out of the TTS dialog's outer scope

## What was broken

`TtsSettingDialogFragment`'s content composable collected
`ttsViewModel.readProgress` and read `.value` in its own (outermost) scope.
While TTS is reading with the dialog open, every progress tick therefore
re-executed the entire dialog body — which also performs two config reads
inline: `config.tts.ttsLocale` (constructs a new `Locale` from
SharedPreferences per read) and `config.tts.recentUsedTtsVoices` (splits a
prefs string and `Json.decodeFromString`s each entry). A JSON parse per TTS
tick, indefinitely, on an e-ink device.

## The fix

Instead of restructuring the dialog's state handling, the fix narrows the
read scope: `TtsDialogButtonBar` — the only consumer of the progress value —
now takes `readProgress: () -> String` and invokes it inside its own body,
so the snapshot read is recorded against the button bar's recompose scope.
Ticks now recompose only the bar; the outer dialog (and its config reads)
re-executes only on real changes: voice/type selection or reading-state
transitions.

This is the same scope-narrowing idea used for the toolbar width math and
the tab-strip focus index earlier in this audit: move the state *read* to
the smallest scope that displays it, rather than caching values with
staleness risk.

## Verification

Compiles clean and installs; the dialog structure is unchanged (only the
parameter shape of a file-private composable changed). The dialog's entry
point (TTS toolbar icon) isn't present in the emulator's toolbar config, so
the tick behavior is verified by the scope rule rather than live: the only
`readProgress` read now sits inside `TtsDialogButtonBar`.
