2026-08-03

# EinkBro iOS: removing the Android-only "Use AI in dictionary search" switch

The Gen AI settings screen carried a "Use AI in dictionary search"
(`字典查詢時，使用 AI`) toggle, ported wholesale from Android along with the rest
of `ChatGptSettings`. On iOS it was decorative: the switch wrote
`AiConfig.externalSearchWithGpt` and nothing ever read it back.

The pref only means something inside Android's `ACTION_PROCESS_TEXT` dictionary
flow — select text anywhere in the system, hand it to EinkBro, and have it
looked up (optionally through an LLM instead of a dictionary URL). iOS has no
equivalent hand-off, and the flow was never ported, so the switch was an
always-inert control promising a behavior the app does not have. Removed it from
`buildChatGptSettingItems`, with a comment at the removal site explaining why the
gap is deliberate rather than an oversight.

`externalSearchWithGpt` itself stays declared in `AiConfig`, next to its equally
unread siblings `externalSearchWithPopUp` and `isExternalSearchInSameTab`. The
preference layer is a deliberate mirror of the Android original so the two trees
can be diffed file-by-file — deleting individual keys from it buys nothing and
costs that property. `docs/SETTINGS_AUDIT.md` already listed this cluster under
"Android dict/PROCESS_TEXT flows not ported"; it now also records that the UI
row is gone while the prefs remain, which is the distinction a future porter
would otherwise have to rediscover.

Commit `bcfccde`.
