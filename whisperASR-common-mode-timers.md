2026-07-08

# WhisperASR: keep recording timers firing while a modal alert is up

When the Zoom meeting monitor detects the call ended, it shows an `NSAlert` via `runModal()` asking whether to stop recording. Modal sessions spin the run loop in the modal-panel mode — and `Timer.scheduledTimer` schedules into the *default* mode only. So while that alert sat open (which can be minutes if the user is away), three timers froze:

- the recording duration display stopped counting,
- the audio-stall watchdog stopped checking — a stalled SCStream would not auto-restart until the alert was dismissed,
- the meeting monitor itself stopped polling.

Audio capture was unaffected (it runs on its own dispatch queue); only the main-run-loop timers stalled.

All three timers are now created unscheduled and added to `RunLoop.main` in `.common` modes via a shared `commonModeTimer` helper — the common-mode set includes the modal-panel and event-tracking modes on AppKit, so the clock, watchdog, and monitor keep running during the alert (and during menu tracking/window drags, which had the same, shorter-lived effect).
