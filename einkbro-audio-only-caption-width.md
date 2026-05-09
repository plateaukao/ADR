# einkbro: audio-only caption width preservation

## Problem

When audio-only mode was toggled on YouTube, the caption was repositioned to the center of the (now-hidden) video canvas, but its width also changed compared to YouTube's normal at-bottom rendering.

## Root Cause

`app/src/main/assets/audio_only_mode.js` was injecting CSS that overrode every dimension of `.caption-window`:

- `top: 50% !important`
- `left: 50% !important`
- `bottom: auto !important`
- `right: auto !important`
- `transform: translate(-50%, -50%) !important`
- `margin: 0 !important`

YouTube re-renders captions every frame, recomputing inline `width` based on the caption-window's resolved position relative to the player. Forcing horizontal position via `left: 50%` plus a horizontal `translateX(-50%)` and zero margin caused YouTube's per-frame width recalculation to land on a different value than the original at-bottom layout.

A first attempt added a `MutationObserver` to capture and pin the original inline width. It did not fix the symptom — YouTube's width comes from a position-driven calculation, so the observer either fought with YouTube continuously or captured an already-wrong value.

## Solution

Stop touching anything horizontal. Only adjust the vertical axis:

```js
'.ytp-caption-window-container .caption-window {',
'    top: 50% !important;',
'    bottom: auto !important;',
'    transform: translateY(-50%) !important;',
'}',
```

YouTube keeps its inline `left`, `right`, `width`, and margins, so its width calculation is unaffected. The caption simply slides vertically to the canvas center.

## Key Files

- `app/src/main/assets/audio_only_mode.js` — CSS injected when audio-only mode is enabled
- `app/src/main/assets/audio_only_mode_off.js` — reverses the injection
- `app/src/main/java/info/plateaukao/einkbro/view/EBWebView.kt` — `toggleAudioOnlyMode()` invokes the bridge
- `app/src/main/java/info/plateaukao/einkbro/view/WebViewJsBridge.kt` — `enableAudioOnlyMode()` / `disableAudioOnlyMode()` evaluate the JS files

## Lessons Learned

- When a host page (YouTube) actively re-renders an element each frame, every CSS property you `!important`-override is an input to its next recomputation. Override only what you actually need to move.
- Reach for a `MutationObserver` only after confirming the symptom can't be resolved by reducing the override surface — observers fighting a per-frame renderer rarely win cleanly.
- For "move element X" tasks, prefer single-axis transforms (`translateY` / `translateX`) over the two-axis form when you only need one axis. The unused axis being explicit zeroes still overrides the host's inline transform.
