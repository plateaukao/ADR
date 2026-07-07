2026-07-08

# NerLan: PDF renderer and handout WebView released correctly

## What was broken

Two teardown defects in the study-material viewers:

- **PDF viewer.** `PdfDocument.close()` (from `awaitDispose` when the viewer is
  dismissed) closed the `PdfRenderer` and its file descriptor immediately —
  but a `renderPage` could still be blocked inside native `page.render` on the
  IO dispatcher, holding the render mutex. `PdfRenderer.close()` with an open
  page throws `IllegalStateException`; the `runCatching` swallowed it, so the
  renderer was never actually closed (native leak), and the descriptor was
  closed underneath live native rendering — undefined behavior.
- **Handout dialog.** The `AndroidView`-hosted WebView had no `onRelease`;
  closing the dialog only detached the view, leaving the native WebView alive
  until finalization.

## Fix

- `PdfDocument` gets a `closed` flag (checked inside the render mutex — renders
  after close return null) and `close()` now acquires the same mutex before
  releasing the renderer and descriptor, asynchronously on IO so dismissing
  mid-render never blocks the UI thread and never tears down under a live
  render.
- The WebView gets `onRelease = { it.destroy() }`.

## Verification

The catalog on the emulator had no PDF-bearing episode, so the PDF path is
compile-verified; its normal render path is unchanged (the null short-circuit
only triggers after close). The WebView path was driven end-to-end with a
fabricated handout file: the AI 講義 dialog rendered it and closed cleanly with
`destroy()` in place — same process, no crash.

Commit: `e750b04` in nerlan-android.
