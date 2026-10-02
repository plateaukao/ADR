2026-10-02

# Transportation: fix bus shortcut warm launches

Opening a home-screen bus shortcut while Taipei Transportation was already running could briefly show only the bottom tabs. The previous shortcut intent used CLEAR_TASK, which destroyed the existing activity and repeated startup. Pinned-shortcut maintenance also ran before catalogue loading on the same worker, delaying the route screen.

The app now uses NEW_TASK, CLEAR_TOP and SINGLE_TOP and handles incoming shortcut intents in onNewIntent. It restores the route and the direction captured when the shortcut was created, clears stale arrival state and requests fresh estimates. Route restoration uses an exact catalogue key lookup. Existing pinned shortcuts receive the corrected intents automatically, and catalogue loading runs before shortcut maintenance.

Commit 86a66a0 contains this fix and version 0.2.1 (version code 3). Release build, release lint and parser/catalogue checks passed. A runnable emulator check verifies both directions of 綠7 and switching to 0南 without recreating the activity. Actual launcher taps verified warm and cold starts, saved direction and live arrivals. Cold starts show the catalogue loading message before the route appears.

The signed release was installed on Palma 2 Pro, and the user reported that the shortcut appeared to work. The device disconnected before the final automated checks on that device; those checks completed on the emulator. App data and existing shortcuts were preserved.
