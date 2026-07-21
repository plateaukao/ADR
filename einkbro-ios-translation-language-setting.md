2026-07-22

# EinkBro iOS: a way to change the translation target language

On Android, the target language is changed from an on-page affordance: while
a paragraph translation is active, a small language label floats over the web
area — tap it to pick a new language (which clears and re-translates),
long-press to hide it. The iOS port has no such overlay, and its
`TranslationLanguageDialog` was a stub that always resolved to cancelled — so
the target language was stuck at the default (English) with no way to change
it. Even the language buttons inside the per-API config dialog (Google/Papago
source/target) silently did nothing, because they funneled into the same stub.

## What was done (commit `c467bde`)

Rather than porting the floating label, the picker became a real dialog and a
setting — matching the request to configure it from Settings → Misc:

- `TranslationLanguageDialog.show()` / `showPapagoSourceLanguage()` now run
  DialogManager's select-option flow over the full `TranslationLanguage`
  list (~100 entries), preselecting the current value and writing nothing on
  cancel. The dual-caption and app-locale pickers remain stubs — their
  Android versions build on platform-locale lists with no iOS counterpart.
- Settings → Misc gains a **Translation Language** item (reusing the existing
  `translation_language` string resource) that opens the picker and stores
  the choice in `config.translation.translationLanguage`
  (`sp_translate_language`).
- The per-API language config dialog needed no changes — its buttons work
  now that the dialog underneath them is real.

Translation flows read the pref at call time, so the next translate (any
mode: by-paragraph, in-place, Google URL, TTS reading language) uses the new
language immediately.

## Verification

Driven in the iPhone 16 simulator: Settings → Misc → Translation Language
shows the radio list with English preselected; choosing Japanese persists
`sp_translate_language = 2` in the app container plist.
