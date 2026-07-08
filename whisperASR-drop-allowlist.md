2026-07-08

# WhisperASR: accept mov/webm/mkv/opus drops to match the file picker

The app had three different opinions about which files it accepts:

- the **Add File picker** allowed any `.audio` / `.movie` content type,
- **AudioLoader** decodes anything AVFoundation can open, plus WebM/Opus/MKV and friends via its ffmpeg fallback,
- the **drop zone** filtered on a hand-maintained extension list that predated both — so a QuickTime `.mov` or a browser-recorded `.webm` imported fine through the picker but bounced off drag-and-drop with no feedback.

The drop allowlist now includes the video containers and Opus/Ogg variants the other two paths already handle (`mov`, `m4v`, `webm`, `mkv`, `opus`, `oga`, `aif`), with a comment tying it to the picker and AudioLoader so the three stay in step.
