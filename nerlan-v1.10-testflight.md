2026-08-06

# NerLan iOS v1.10 (build 12) to TestFlight

Commit `7c3d40f` on `plateaukao/nerlan`; uploaded to App Store Connect for internal testing on 2026-08-06 via the one-shot `Scripts/build_testflight.sh` (manual signing, no retries needed).

What's in this release relative to v1.9:

- **Groq URL-based transcription with learned progress rates** (`552367a`) — a Groq custom endpoint now transcribes by sending the episode's public audio URL (gated on a ≤25 MB HEAD probe, chunked-upload fallback), and progress estimates seed from measured per-server+model rates. Details in `nerlan-groq-url-transcription.md`.
- **Lock-screen resume fix** (`d266750`) — resuming from the lock screen after a long pause or an interruption no longer fails silently; see `nerlan-lockscreen-resume-fix.md`.
