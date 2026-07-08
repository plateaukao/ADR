2026-07-08

# WhisperASR v0.6.1 — quality release from the code audit

v0.6.1 packages the day's 17-commit audit batch — all fixes, performance work, and cleanups, no features, hence a hotfix bump per the project's major.minor.hotfix scheme. Highlights of what ships:

- **Crash/data-loss fixes**: whisper model (re)loading serialized with inference; removing a transcription no longer deletes imported audio (app recordings go to the Trash); live transcripts survive a failed recording save; renames can't orphan an item's audio link.
- **Correctness**: seek works before audio metadata loads; translation UI updates land on the main actor; transcript search is Unicode-safe; clean model-not-found message.
- **Performance/power**: debounced+cached sidebar search, compositor-driven recording pulse, 10 Hz playback ticks with binary-search highlighting, 1 GB API upload cap, URLSession leak fixed.
- **Behavior**: drag-drop accepts MOV/WebM/MKV/Opus; recording timers keep running during the meeting-ended alert.

Each change has its own ADR from earlier today; this one records the release itself.

Release process (per the established flow): bumped `CFBundleShortVersionString` to 0.6.1 in `Scripts/build_release.sh` and pushed to `main`; `Scripts/release.sh` built, signed with the Developer ID identity, notarized via the `notarytool` keychain profile (status: Accepted), and stapled; verified `spctl` reports `source=Notarized Developer ID`; tagged `v0.6.1` and published with `gh release create` — asset `WhisperASR.zip` (3.0 MB), notes as plain bullets.

Published at: https://github.com/plateaukao/whisperASR/releases/tag/v0.6.1
