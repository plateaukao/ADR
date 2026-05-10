# Fix: Harden Video Autoplay Blocking

## Problem

The "Allow Video Autoplay" (disable) feature stopped working on sites like Instagram. Videos continued to autoplay despite the setting being off.

## Root Cause

The working snapshot (04041156, commit `a62a795a`) had **no JS autoplay blocker at all** — only the native WebView default `mediaPlaybackRequiresUserGesture = true`. This worked because the native setting returns a **rejected promise** (`NotAllowedError`) when `.play()` is called without a user gesture. Instagram's error handler sees this as a normal browser block and shows a thumbnail instead.

The JS override added in commit `fd50d3b1` broke this by returning `Promise.resolve()` when blocking `.play()`. This told Instagram's code that playback **succeeded**, causing it to:
1. Proceed with its video playback logic
2. Retry through alternative play paths (IntersectionObserver, autoplay attribute)
3. Fight against the JS `pause()` calls in a play/pause loop

## Current Solution (simplified)

Removed `.play()` override and `userGesture` tracking entirely. Let the native `mediaPlaybackRequiresUserGesture = true` handle play/block decisions. JS only strips `autoplay` attributes via `createElement` hook and MutationObserver. Script injected in both `onPageStarted` and `onPageFinished`.

## Key Files

- `app/src/main/assets/disable_video_autoplay.js` — autoplay attribute stripping only
- `app/src/main/java/info/plateaukao/einkbro/browser/NinjaWebViewClient.kt` — dual injection (onPageStarted + onPageFinished)

## TODO: IntersectionObserver interception vs user-initiated play

IntersectionObserver interception (faking `isIntersecting: false` for video containers) effectively blocks Instagram's autoplay trigger. However, it also breaks user-initiated play — when the user taps a play button, Instagram's player still thinks the video isn't visible and won't start playback. A better solution is needed that can distinguish between IO-triggered autoplay and user tap-to-play.

## Lessons Learned

- **The return value of blocked `.play()` matters**: Returning `Promise.resolve()` signals success and causes sites to retry. Returning a rejected `NotAllowedError` (same as native browser) causes sites to handle the block gracefully.
- **`userGesture` flag is fundamentally broken**: Any touch (including scrolls and Ebook page turns) sets it, opening a window for autoplay. Removing it entirely and relying on native WebView gesture tracking is simpler and correct.
- **Compare against the last known working build** to find what actually changed, rather than assuming the root cause from first principles.
- `evaluateJavascript` in `onPageStarted` races with page scripts; injecting in both `onPageStarted` and `onPageFinished` with a guard flag ensures the override takes effect.
