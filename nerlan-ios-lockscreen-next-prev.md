2026-08-16

# NerLan iOS: keep next/previous episode on the lock screen instead of skip buttons

## What was wrong

The lock screen and Control Center were drawing ±15 second skip buttons where
next/previous track belonged. For a sequential language course that's the wrong
pair of controls to reach for with the screen off — you want the next lesson,
not fifteen seconds further into this one.

## Root cause

`MPRemoteCommandCenter` had both sets of commands enabled with handlers, which
is correct. The problem was one extra line per command:

```swift
center.skipForwardCommand.preferredIntervals = [15]
center.skipBackwardCommand.preferredIntervals = [15]
```

`preferredIntervals` reads like a hint about *what interval to use*, but it also
tells the Now Playing UI that this app wants skip controls — and the system
gives those visual precedence over next/previous track when both are available.
Setting it to match the full player's ±15s buttons quietly cost the lock screen
its episode controls.

## Fix

Drop `preferredIntervals` entirely. The skip commands stay registered and stay
handled, so "Hey Siri, skip forward 30 seconds" and "go back 15 seconds" still
work — the handler already honors `MPSkipIntervalCommandEvent.interval` rather
than any preferred value, so Siri can ask for any amount. They're simply
voice-only now, and the lock screen goes back to next/previous episode.

The comment at the call site records the trap, since the line looks harmless
enough that it would otherwise get added back.
