2026-07-07

# NerLan: handout retry button was a silent no-op

## What was broken

When an AI-handout job fails, the action button shows an error alert with a 重試 (retry) button. That button calls `processHandout`, which guards with:

```swift
guard jobs[key(.handout, record.id)] == nil, !hasHandout(record.id) else { return }
```

A `.failed(...)` job entry is *non-nil*, so the guard made every retry return immediately — the user tapped 重試, nothing happened, and nothing ever would until they discovered the separate 重新產生 context-menu path (which routes through `delete`, clearing the job as a side effect).

The transcript flow had already been fixed for exactly this (`transcribeAndOpen` clears a `.failed` entry before calling `processTranscript`, with a comment saying why); the handout flow never got the equivalent.

## Fix

`processHandout` now removes a `.failed` job entry before the guard, mirroring the transcript path. This is safe because a failed state can only reach `processHandout` via the alert's retry button — the normal button tap shows the alert instead of starting a job, and `regenerate` clears the job through `delete` first.
