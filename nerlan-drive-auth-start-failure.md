2026-07-07

# NerLan: Google sign-in no longer hangs when the auth sheet can't present

## What was broken

`DriveAuth.signIn()` bridges `ASWebAuthenticationSession` into async/await with `withCheckedThrowingContinuation`, resuming from the session's completion handler. But `session.start()`'s Bool result was ignored. When `start()` returns `false` — the session couldn't present, typically because there's no key window yet (tapping sign-in right as the scene activates, or on Catalyst timing quirks) — **the completion handler is never called**. The continuation never resumed, `DriveSync.signIn()` awaited forever, and Settings showed 登入中… permanently (the button stayed disabled, so there was no way to retry without relaunching).

## Fix

A `PresentationFailed` error (`LocalizedError` with a user-facing message) is thrown by resuming the continuation when `start()` returns `false`. It flows through `DriveSync.signIn()`'s existing catch and surfaces as a normal `登入失敗：無法開啟 Google 登入視窗，請再試一次。` status line — the spinner stops and the user can just tap again.
