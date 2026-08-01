2026-08-01

# EinkBro: audio-only mode inverts the video canvas for e-ink

Audio-only mode hides the video element (`opacity: 0`) and keeps captions visible
so a talk or podcast can play cheaply. But the player keeps painting its black
backdrop behind the hidden video, leaving a large black rectangle with white
caption text — the worst case for e-ink panels, which render large dark areas
slowly and with ghosting.

The audio-only stylesheet now inverts that canvas: the YouTube player container
(`#movie_player` / `.html5-video-player`) gets a white background, caption
segments render black-on-white with text shadows removed, and `video::cue`
covers native WebVTT captions on non-YouTube sites. `!important` rules are enough
to beat YouTube's inline caption styling.

No teardown changes were needed: every new rule lives in the same injected
`<style id="audio-only-mode-css">` tag that toggling audio-only off already
removes, so the video and player colors restore themselves. Verified on device by
sampling the player region's luminance: pure white with audio-only on, normal
video frame after toggling off.
