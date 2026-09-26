2026-09-26

# Fix dictionary popup ViewModel creation

EinkBro 16.7.0 crashed on the connected P7 running Android 14 when an external process-text request opened the translation popup. The device recorded three identical main-thread failures in DictActivity, ending in NoSuchMethodException for the TranslationViewModel constructor.

DictActivity used Android's default viewModels delegate, which tried to instantiate TranslationViewModel without arguments. The ViewModel requires ConfigManager and BookmarkManager, and its dependency-aware factory is already registered in Koin. Switching DictActivity to Koin's viewModel delegate supplies those dependencies and matches BrowserActivity's existing approach.

The release build passed. The fixed arm64 APK was signed using the local signing setup in ~/bin/bri, with ~/browser.keystore and alias browser. Its certificate matched the installed app, and adb install -r updated it successfully while preserving app data. Device verification with sim-use confirmed that the process-text translation popup opened, a subsequent dictionary-search intent completed, and the app process remained alive with no new crash entries.

AGENTS.md now records the local install rule: never install Play Store builds on local devices, and use the bri signing setup for local release APKs rather than the Play upload key.

Implementation commit: 3794877c4 (fix(dict): inject translation ViewModel through Koin).
