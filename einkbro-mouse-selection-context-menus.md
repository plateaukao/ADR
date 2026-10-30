2026-10-30

# Mouse selection and context menus

Mouse text selection in Chromium did not start Android touch ActionMode, so EinkBro could miss the selected text and its custom actions. Mouse drags could also be intercepted by pull-to-refresh.

Commit 377f80459 preserves native mouse click and drag handling, then checks selection after release. Mouse selection now shares the existing custom actions, split search, and remote search flow. Editable fields and the default native-menu preference retain native handling. Mouse drags bypass pull-to-refresh.

Right-click resolves links and images in page JavaScript and opens the existing context menu. Holding the primary mouse button cancels pending navigation and either opens the link/image menu or selects a word using Chromium word boundaries. Target lookup accounts for the visual viewport, and menu actions use the originating WebView.

Validation: the targeted MouseSelectionTest Gradle test and the Node mouse_context_target_test.js checks passed. Mouse hardware behavior was not reverified as part of this commit.
