# NerLan Android — Keep the screen awake while reading the transcript

## Summary

While the transcript view is on screen, the display now stays awake instead of
dimming and locking on the normal idle timeout. This applies everywhere the
transcript appears: the player sheet's caption (字幕) mode, the standalone
transcript dialog, and the large-screen study panel. As soon as the transcript is
closed, the normal screen timeout resumes.

## Approach

All three surfaces render the same shared composable, `TranscriptContent`, so the
keep-awake behavior lives in exactly one place. A `DisposableEffect` sets
`keepScreenOn = true` on the host view (`LocalView.current`) when the transcript
enters composition and clears it in `onDispose` when it leaves. Tying the flag to
the composable's lifecycle — rather than to playback state or an Activity-level
window flag — means it is impossible to leak: dismiss the dialog, toggle 字幕 off,
or navigate away and the flag is dropped automatically.

`View.keepScreenOn` (vs. manually adding `FLAG_KEEP_SCREEN_ON` to the Activity
window) is the idiomatic Compose choice and works correctly across the different
host windows involved — the bottom-sheet window, the dialog window, and the main
activity window for the panel — because the flag is honored as long as that view's
window is visible.

The wake is intentionally tied to the transcript being *shown*, not to audio
playing, so a paused read-along still keeps the screen on.

## Trade-offs

- **Awake regardless of playback.** Leaving the transcript open with the phone set
  down keeps the screen lit and will use battery. This matches the request ("when
  the transcript view is shown, keep the screen awake") and is the expected
  behavior for a read-along view; closing the transcript restores the timeout.
- **Single shared composable.** Putting the effect in `TranscriptContent` covers
  all three entry points with one change, at the cost that any future surface that
  embeds `TranscriptContent` inherits the wake automatically — which is the desired
  default here.

## Key Files

- `app/src/main/java/com/example/nerlan/ui/TranscriptDialog.kt` — the only file
  changed. Adds the `DisposableEffect` toggling `LocalView.current.keepScreenOn`
  at the top of `TranscriptContent`, plus the `DisposableEffect` / `LocalView`
  imports.
