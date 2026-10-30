2026-10-30

# Keep editor actions above system bars and the keyboard

Issue #648 reported that the Custom CSS editor's Save button was hidden by the optional navigation bar on a Boox Go 10.3 Gen II Lumi. The same failure reproduced in v16.7.1 on an Android 16 tablet emulator: the full-screen editor laid out its actions underneath the navigation bar and its title underneath the status bar. Opening the software keyboard also covered the editor actions.

The shared CSS and JavaScript editor filled the dialog window with only fixed padding. Commit 2ef54e7d9 adds Compose safeDrawingPadding to account for system bars, display cutouts, and the IME. The full-screen dialog theme explicitly requests adjustResize so keyboard insets can keep the actions visible. The weighted text area uses the remaining space.

The locally signed release build passed. On the Android 16 tablet emulator, Save and Cancel remained visible with three-button navigation, gesture navigation, and in portrait and landscape layouts. With the software keyboard and caret visible, a test word was entered by tapping the actual keyboard keys, saved using the visible Save button, and successfully reopened in the editor. This validated the editor callback; the outer site-settings OK flow was not part of that save check. No physical Boox device was tested.

Issue: https://github.com/plateaukao/einkbro/issues/648
Commit: https://github.com/plateaukao/einkbro/commit/2ef54e7d9
