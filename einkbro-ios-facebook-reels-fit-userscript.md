2026-09-28

# Fit Facebook Reels in desktop view

Facebook sometimes opens Reels through in-page navigation without reloading. When the feed uses desktop view, the Reel keeps Facebook's narrow desktop player even on an iPhone. Switching the site's view mode for the Reel requires a reload and interrupts browsing.

The new `scripts/facebook-reels-fit.user.js` userscript watches the current Reel path and visible video. When Facebook renders a narrow player, it scales the video wrapper and its overlays within the available screen space. It leaves a Reel that already fills the screen alone, and restores the wrapper when navigation leaves `/reel`. The script checks periodically because Facebook can replace a Reel without a page load.

The script was tested through temporary JavaScript injection in the iPhone simulator across feed-to-Reel navigation, multiple next-Reel transitions, and a return to the feed. JavaScript syntax and staged diff checks passed. Persistent installation and behavior on a physical iPhone remain to be verified. Facebook can change its page structure, so the wrapper selection may need adjustment later.
