2026-08-03

# EinkBro iOS: chat-with-web merged to main, version 1.2

The `chat-with-web` branch — the shared-chat.html port with persistent sessions (`einkbro-ios-chat-html-shared-ui.md`) and the session-restore fix (`einkbro-chat-session-restore-fix.md`) — merged cleanly into `main` as `067ed76`, on top of seven commits main had gained in the meantime (edge-to-edge toolbar, tab enhancements, Gemini 3 reasoning filter, dark-mode flash fix). No conflicts; the Kotlin module compiles on the merge result.

`CFBundleShortVersionString` then jumped `0.2.0` → `1.2` (`b3f4736`) to match the next App Store Connect release. The jump from 0.x signals the feature-parity milestone this cycle closes: AI chat now shares Android's implementation outright — same chat.html, same session table, same bridge contract — rather than approximating it. `CFBundleVersion` stays at 4: build numbers only need uniqueness within a version train, and the headless archive/upload recipe bumps it at release time anyway.

Nothing is pushed; the release itself (archive, upload, TestFlight) is a separate step.
