2026-07-07

# NerLan: launch-time iCloud mirror-up scans the container once

## What was broken

With iCloud sync on, `AIContentStore.enableICloudSync` runs at every launch and mirrors each local artifact (transcript, handout, cues, translation — per episode) up to the container. Each `mirrorUp` call located the episode's folder via `episodeFolderLocked`, which **lists the entire container root** and calls `resourceValues(forKeys:)` on every entry to find one folder.

With about 200 fully-processed episodes that's about 800 root scans × about 200 entries ≈ 160k stat calls through the iCloud daemon, on every launch, in the overwhelmingly common case where every artifact is already uploaded and the pass is a no-op.

## Fix

`mirrorUpBatch(_:)` takes the whole artifact list, builds an `id → folder` dictionary from **one** root scan, and processes every item against it — registering any folder it creates so the same episode's later artifacts reuse it instead of creating a duplicate. The write-once skip logic (existing file or `.icloud` placeholder ⇒ don't re-upload) is unchanged.

The single-artifact `mirrorUp` is now sugar for a one-element batch, so there's one code path; `AIContentStore.enableICloudSync` collects all four kinds into a batch and makes a single call.
