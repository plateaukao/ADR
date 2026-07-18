2026-07-18

# EinkBro iOS: rename GPT Settings to Gen AI (port of Android 5a127f40e)

The Android EinkBro renamed its settings section from "GPT Settings" to "Gen AI" and generalized GPT/ChatGPT wording to "AI" in labels that are engine-agnostic (commit `5a127f40e`) — the app has long supported Gemini and self-hosted models alongside OpenAI, so "GPT" in those labels was misleading. This ports that commit to the iOS app for the eight locales it carries (`values`, de, es, fr, ja, ko, zh-rCN, zh-rTW).

The renamed labels: settings section title and backup category ("Gen AI"), dictionary-search toggle, action definition list ("AI action definition" / "AI Actions"), result history, summary-engine picker, drag-reorder hint, and the alternative-server model-name summary. OpenAI-specific labels (API key, model names, TTS) intentionally keep their wording, as do code identifiers and resource names — this is a label-only change, so files still diff cleanly against their Android counterparts.

Rather than hand-editing eight XML files, a script extracted the post-commit values for the 13 changed string names straight from the Android repo (`git show 5a127f40e:app/src/main/res/<locale>/strings.xml`) and substituted them into the iOS `composeResources` files. That guarantees the localized wording matches Android exactly and surfaced two quirks worth knowing: most Android locale files never localized `backup_category_database_data` (they fall back to English, so only `values` and `zh-rCN` carry it — the iOS tree mirrors this), and zh-rTW only had 9 of the 13 strings to change because some of its translations were already engine-neutral.

The working tree also held unrelated in-progress edits in the same strings.xml files (Google Drive sync strings), so the commit was staged from a patch generated against HEAD containing only the rename hunks, leaving the other work untouched.
