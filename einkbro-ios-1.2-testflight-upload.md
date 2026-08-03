2026-08-04

# EinkBro iOS 1.2 (build 5) uploaded to App Store Connect

Version 1.2 went up with the documented headless recipe (see `einkbro-ios-first-appstore-upload.md`): bump `CFBundleVersion` 4→5 (commit `7e395c0`, tag `v1.2-5`), `xcodegen generate`, Release archive to `~/Library/Developer/Xcode/Archives/2026-08-04/EinkBro-1.2-5.xcarchive`, then `-exportArchive` with `method: app-store-connect` / `destination: upload` under the Xcode-logged-in account — no API key. "Upload succeeded"; the build is processing on ASC and will appear in TestFlight shortly.

What 1.2 carries over store version 1.1 (the 0.2.0 build-4 upload):

- **Chat with Web rebuilt on the shared Android chat.html** — chats live in real browser tabs, sessions persist to the database, and the in-page session panel lists/restores/deletes saved conversations. Restoring a session also restores the model's context (history + the original page text).
- Gen AI key/model verification from the settings screen; Gemini 3 reasoning filtered out of replies.
- Edge-to-edge bottom toolbar with home-indicator gesture deferral; dark-mode new-tab flash fix; closing a tab loads the revealed tab.
- About row reads the live bundle version (was stuck at 0.1.0); Android-only dictionary-AI switch removed.

Remaining manual steps in ASC once processing finishes: pick build 5 for the 1.2 store version, paste the release notes, and (if external testers are used) submit for TestFlight review.
