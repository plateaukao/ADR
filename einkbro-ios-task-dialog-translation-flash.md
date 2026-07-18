2026-07-18

# EinkBro iOS: Page AI task dialog flashed a translation before task progress

## What was broken

Running a task from Page AI > Tasks opened the result popup showing *translation*
output first — an unrelated translation of leftover text — before the task's
progress lines appeared (or racing with them).

## Root cause

The result popup is the shared `TranslateDialogContent`, and it auto-runs
`translationViewModel.translate()` in a `LaunchedEffect` every time it opens.
That auto-translate is what powers the selection-translate and summarize flows:
they stage their input with `updateInputMessage(...)` and rely on the dialog to
fire the call on open.

Task mode reuses the same dialog but feeds it differently —
`setupTaskStream(taskRunner.progress)` streams rendered task progress into
`_responseMessage`. The open-time auto-translate still fired, kicking off an LLM
call on whatever input was staged last, and both writers raced for
`_responseMessage`: the translation landed first, then task emissions overwrote
it (or vice versa, depending on timing).

## The fix

A `isTaskStreamActive` flag on `TranslationViewModel`:

- `setupTaskStream(...)` sets it — the dialog's `LaunchedEffect` skips the
  auto-translate while it's on.
- `updateInputMessage(...)` clears it — every normal translate/summary flow
  stages its input through that method, so the next legitimate open behaves
  exactly as before.

Verified in the iPhone simulator: a Page AI custom task opens the dialog straight
to "Custom task — running…" with no translation flash, and finishes with the
task's own summary.
