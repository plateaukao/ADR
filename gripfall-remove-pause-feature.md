2026-10-17

# Remove Pause from Grip Fall

Opening or returning to the game could display an unwanted paused screen because tab visibility changes set the explicit pause state. The user also found the Pause feature unnecessary. The game now removes the Pause button, P shortcut, overlay, state, and pause-specific styling and documentation.

Hidden tabs simply stop advancing simulation frames and clear held inputs. Returning to the tab continues automatically without a resume action. The controls dialog temporarily suspends simulation while open and continues when dismissed, without any paused screen.

Chrome checks verify a clear initial screen, normal driving after pressing P, no simulation advance in a hidden tab, automatic continuation on return, controls-dialog behavior, and a complete successful demo landing without page errors.

Commit: [43a5c6e](https://github.com/plateaukao/gripfall/commit/43a5c6e). Pushing main updates the live [Grip Fall game](https://plateaukao.github.io/gripfall/).
