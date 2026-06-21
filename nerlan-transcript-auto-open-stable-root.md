2026-06-22

# NerLan: auto-open the transcript viewer from a stable root when the first chunk lands

## What was broken

Transcripts stream in per ~20-minute chunk, and the intent was for the viewer to
open as soon as the first chunk is ready rather than waiting for the whole
episode. In practice it often didn't show — the natural flow is to tap 逐字稿,
then swipe the player away to keep listening while a long episode transcribes, and
expect the transcript to pop up when it's ready. It never did.

## Root cause

The auto-open trigger lived on the transcript action button's transient
`@State` (`pendingOpen`), and fired from an `onChange(of: hasPartialTranscript)`
on that same button. SwiftUI only delivers that `onChange` while the button is in
the hierarchy. So:

- Swipe the player away → the button (and its `pendingOpen`) is destroyed → the
  partial lands with nothing observing → nothing opens.
- In a list row the same state could be lost to cell recycling.

The keep-the-player-open case worked, which is why it looked inconsistent.

## The fix

Move the trigger off the view and into the store, and present from a container
that is always alive.

- Tapping 逐字稿 on an un-transcribed episode calls
  `AIContentStore.transcribeAndOpen(record)`, which records the intent in
  `autoOpenTranscriptIds` and starts the job.
- When the **first chunk's** partial is published, the store drains the intent
  into a published `presentTranscript` signal. Single-chunk episodes reach this
  point too — before they finish synchronously — and the signal survives that.
- `ContentView`, the always-alive root, observes `presentTranscript` and opens the
  viewer: the side panel on iPad, a root sheet on iPhone. So it shows regardless
  of whether the player sheet that started it is still up.

```mermaid
sequenceDiagram
    participant U as User
    participant B as AIActionButton
    participant S as AIContentStore
    participant C as ContentView (root)
    participant V as TranscriptView

    U->>B: tap 逐字稿 (not yet made)
    B->>S: transcribeAndOpen(record)
    Note over S: record id into autoOpenTranscriptIds; start job
    U-->>B: swipe player away (button destroyed)
    S->>S: chunk 1 done, publish partial
    Note over S: drain intent into presentTranscript
    S-->>C: presentTranscript changes (Published)
    C->>C: clear presentTranscript; dismiss player if up
    C->>V: present (root sheet iPhone / side panel iPad)
```

## Design notes

- **Two root sheets can't stack.** On iPhone, if the player sheet is still up when
  the transcript becomes ready, the player is dismissed first and the transcript
  presents after the dismissal animation (a short `asyncAfter`). Audio keeps
  playing via the mini player, so closing the player sheet is invisible to
  playback. When the player is already gone (the case we set out to fix), the
  transcript presents immediately.
- **Retry routes the same way.** The failure-alert "重試" calls
  `transcribeAndOpen`, which first clears a recorded failed job (otherwise
  `processTranscript` no-ops while any job is recorded) so the rerun actually
  starts and still auto-opens.
- Intent is cleared on failure, `delete`, and `clearAll`. The now-unused
  `hasPartialTranscript` accessor (its only caller was the old button path) was
  removed.

Commit: `d341446`. Follows the per-chunk streaming work (`8991f11`) and the run-on
segmentation hardening (`b559b7b`).
