2026-07-08

# NerLan: DriveSync stopped cancelling its own uploads; file listing paginated

## What was broken

Three related defects in the Drive sync engine:

1. **The debounce contained the sync.** `requestSync()` (fired 2.5 s after any
   local change) cancelled the previous debounce job — but that job *was* the
   sync once the delay elapsed. Favoriting episode B while episode A's sync was
   uploading aborted the transfer mid-flight; the partially completed work was
   redone next round.
2. **Cancellation reported as failure.** `runSyncWithStatus` used `runCatching`,
   which caught the `CancellationException` from (1) and showed the user
   "同步失敗：JobCancellationException…" for what was routine rescheduling.
3. **No pagination.** `listFiles` requested `pageSize=1000` and never followed
   `nextPageToken`. Each episode with AI content contributes up to 4 files
   (transcript, cues, translation, handout) plus per-device stats blobs, so
   ~250 episodes overflow one page. A local file missing from the truncated
   listing was "not on Drive" → re-uploaded as a **new** file every sync (Drive
   allows duplicate names), growing the appDataFolder without bound — and
   pulls then picked an arbitrary duplicate.

## Fix

- The debounce job only delays, then launches the sync in its own job; a new
  local change reschedules the delay without touching a running sync (the
  existing mutex still serializes overlapping runs). `requestSync` is
  `@Synchronized` — it is called from the main thread, the AI store's IO scope
  and the player, and an unguarded swap could leave two live debounce jobs.
- `runSyncWithStatus` rethrows `CancellationException` and only maps real
  exceptions to a status message.
- `listFiles` loops on `nextPageToken` (with `fields=nextPageToken,…`) until
  exhausted.

## Verification

Exercising a real sync needs a signed-in Google account, which the emulator
doesn't have — `requestSync` no-ops signed out. Verified: clean build, app
startup constructs DriveSync normally, and the Settings sync section renders
with both sign-in paths. The scheduling/pagination changes are structural and
reviewed by construction.

Commit: `4658fa1` in nerlan-android.
