# NerLan — Whisper prompt: keep Arabic in its native script (stop romanizing)

## Summary

Transcribing an Arabic language-teaching episode produced **romanized** Arabic —
e.g. `illa ayi yaoming satabqa huna，我要在這邊待到禮拜五。` — instead of the
original script `سأبقى هنا حتى يوم الجمعة，我要在這邊待到禮拜五`. Adding an
Arabic-script sample to the Whisper `prompt` for Arabic programs fixes the worst of
it: the decoder now emits Arabic script for the foreign passages while keeping the
host's Traditional Chinese. Romanization is much reduced (some English spellings
still leak through — a known, partial limitation, see Trade-offs).

## Approach

`OpenAIService.transcriptionPrompt(for:)` builds a Whisper `prompt` per program
language. Whisper treats the `prompt` as **preceding context, not an instruction**:
it continues in whatever script the prompt establishes. Every supported language
therefore seeds a short sample *in that language's native script* (Japanese kana,
Korean hangul, Thai, etc.), which anchors the decoder to keep the foreign words in
their original script.

Arabic (`阿拉伯語`) had no branch, so it fell through to the generic `else` that
emits only Chinese plus the instruction「請保留該語言文字的原始樣貌」. Because
Whisper ignores instructions and there was no Arabic-script anchor, it defaulted to
transliterating into Latin. The teaching programs are bilingual (Mandarin host +
foreign demonstrations), so no `language=` is forced — the decoder must switch
scripts per passage, which makes the prompt anchor the only lever.

The fix is one branch, matching the existing pattern, with Arabic-script phrases
(including the user's exact example sentence) so the prompt carries real Arabic
text as context:

```swift
} else if language.contains("阿拉伯") {
    sample = "阿拉伯語例句：صباح الخير. كيف حالك؟ شكرا جزيلا. سأبقى هنا حتى يوم الجمعة."
}
```

Verified on-device (build installed to the iPhone 17 Pro): Arabic now comes out in
script rather than romanized.

## Trade-offs

- **Prompt-priming, not language-forcing.** Because the content is bilingual we
  can't pass `language=ar` (that would bias the Mandarin host toward Arabic). The
  native-script sample is a softer nudge, so it improves rather than guarantees —
  some English/Latin spellings still appear. Acceptable for now; a stronger lever
  (e.g. detecting monolingual Arabic stretches, or a per-program forced language)
  was deferred.
- **Per-language enumeration.** The prompt hard-codes a sample per language, so any
  other non-Latin-script language not yet listed (Russian, Hindi, …) will hit the
  same generic fallback and romanize until it gets its own branch. The generic
  `else` still relies on an instruction Whisper won't obey — a future cleanup could
  give it at least a script-name hint, but the reliable fix is a real sample.
- **Source carries RTL text.** The Swift literal contains right-to-left Arabic;
  it's inert string data and builds fine, but it can look reordered in some editors.

Mirrors a transcription concern shared with the Android app (`plateaukao/nerlan-android`);
the same prompt branch is worth porting there.

## Key Files

- `NerLan/Sources/OpenAIService.swift` — `transcriptionPrompt(for:)`; added the
  `阿拉伯` branch with an Arabic-script sample. Related prior work:
  `nerlan-transcription-language-handling.md`.
