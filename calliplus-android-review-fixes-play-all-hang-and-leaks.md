2026-08-29

# CalliPlus: review fixes — play-all hang on scroll, savePhoto leak, and friends

## Where this came from

A memory-and-performance review of everything since the 4.9.1 Play release
(stroke-order animation, the tablet panes, the icon and changelog work). Ten
findings came back; one (the removed 👁 hide-glyph button) was a deliberate earlier
change, one (a NaN freeze reachable only if no layout happens in the animation's
first second) was left for later. The other eight are fixed here.

## The hang

```mermaid
sequenceDiagram
    participant Seq as StrokeAnimSequencer
    participant Grid as GridView
    participant Cell as StrokeAnimView (in a block)
    Seq->>Cell: play(charIndex) - onDone = next()
    Grid->>Grid: user flings; the block is scrapped and reused for another rule
    Grid->>Cell: getView rebinds the block
    Note over Cell: before: anim.stop() - onDone nulled, nothing fired
    Note over Seq: waits forever - scrollbar off, menu stuck on 停止
    Cell->>Seq: now: onRebound - onInterrupted (mid-stroke) or the completion (during the hold)
    Seq->>Grid: locate the character again and replay / move on
```

`StrokeAnimView` keeps its Choreographer callback alive across recycling on
purpose (a scrapped view is only temporarily detached), and `onDetachedFromWindow`
already handed a mid-stroke animation back to the sequencer. The gap was the
*rebind* path in `RuleBlockAdapter.getView`, which stopped the overlay silently
when a still-animating cell was reused for a different character, and the
~0.8 s hold after the last stroke, during which `running` was already false so
nobody treated the cell as owned. The view now tracks `holding`, exposes
`isActive`, and `onRebound()` either fires `onInterrupted` (the sequencer relocates
and replays) or delivers the pending completion immediately. `stop()` also clears
`onInterrupted`, so a recycled view cannot call back into an old run.

Verified on the tablet emulator by starting play-all, flinging the grid away, and
watching it jump back and carry on.

## The rest

- **savePhoto** (`CharPanel`): the worker thread held the Activity and a
  `ProgressDialog`, `View.post` from a detached panel never ran, and two taps ran
  two saves. Now: application context for the IO, weak activity for the UI, a
  main-looper `Handler`, always-dismiss, one save at a time, dismissed on detach.
- **Background animation**: `CharPanel.onWindowVisibilityChanged` stops the stroke
  animation when the window is hidden — one hook instead of four host `onPause`s.
- **`System.gc()`** in `PaintView.clear()` ran on every character tap in the panes.
  Gone; `eraseColor` reuses the bitmap.
- **JSON in `getView`**: finished (held) cells keep their `StrokeData` next to the
  cell, so re-binding after a scroll no longer opens the asset and parses JSON on
  the main thread (the LruCache held 96 entries against 172 files).
- **Double measure**: the stacked pane cached its control-block width and mutates
  the glyph frame's layout param in place; reassigning it from `onMeasure` had been
  forcing a second layout pass.
- **Host duplication**: `BaseActivity` now binds `R.id.char_panel` in
  `onContentChanged`, handles `onBackPressed`, and forwards preference changes; the
  two-pane layouts opt in with `app:collapseOnBack="true"`, so the pre-33
  `onBackPressed` path and the 33+ `OnBackInvokedCallback` path key on the same
  flag. Dead code removed along the way (unused `playCell` overload, no-op
  `onDestroy`, unreachable `action_faint` branch, `rawDurationMs`, `padFraction`).
