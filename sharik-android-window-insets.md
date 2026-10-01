2026-10-02

# Keep Sharik Android controls clear of window insets

The Share file, Share text, and Receive buttons could appear covered near the header on some phones. The app targets SDK 36 but its main layout did not handle system window insets, leaving its top controls and bottom device label exposed to edge-to-edge layout behavior on newer Android versions.

The main layout now has an outer FrameLayout with android:fitsSystemWindows enabled. The framework applies the remaining window insets to that container, while the original vertical LinearLayout keeps its 12dp content padding. Keeping these responsibilities on separate views matters because framework inset handling replaces padding on the view receiving the insets.

This uses platform Views without new dependencies, fixed header offsets, or changes to sharing and receiving behavior.

Validation: ./gradlew assembleDebug succeeded, and git diff --check passed. The debug APK was installed on the Android 16 emulator and inspected with sim-use and a screenshot. All three top buttons were fully visible below the header, the original content spacing was preserved, and the device label stayed above the navigation area. Physical OEM devices were not verified.

Implementation: [sharik-android commit 5738d4a](https://github.com/plateaukao/sharik-android/commit/5738d4a).
