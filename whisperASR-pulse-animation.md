2026-07-08

# WhisperASR: drive the recording pulse with a repeating animation

The red recording dot pulsed via `TimelineView(.periodic(from: .now, by: 0.1))`, hand-computing an opacity from the timestamp. That re-evaluates SwiftUI content ten times a second for the entire recording session — precisely the period when the machine is already busy with ScreenCaptureKit capture, mic mixing, and live whisper inference. Ten wakeups a second for one dot's opacity is the kind of tax that shows up in Activity Monitor's "wakes" column and, over a two-hour meeting, in the battery graph.

The replacement is a single `easeInOut(duration: 0.8).repeatForever(autoreverses: true)` opacity animation kicked off in `onAppear`. Core Animation runs it compositor-side: same visual (1.0 → 0.4 over a 1.6 s cycle), zero recurring SwiftUI work.
