2026-07-07

# EinkBro: GPT query list and adblock list composition cleanups

## What was broken

Three composition-hygiene problems in the GPT query list, plus one in the
adblock filter list:

1. **Volume-key paging via state hammer.** `onKeyDown` wrote the key code
   into a `MutableState` read by the whole screen, then reset it to a
   sentinel 50 ms later via `postDelayed` — the code's own comment called
   it a "workaround to reset the key code so that launchedeffect can be
   triggered". Each press recomposed the entire screen twice (value, then
   sentinel). Key presses are *events*, not state: they are now a
   `MutableSharedFlow<Int>` collected in a single `LaunchedEffect(Unit)`
   with the same scroll-and-expand logic. The old effect also wrapped its
   body in a redundant `coroutineScope.launch`, now gone.
2. **Markdown parsed per recomposition.** `QueryItem` parsed the query
   text — and, when expanded, the potentially long GPT result — with
   `HelperUnit.parseMarkdown` on every recomposition (each
   expand/collapse re-parsed both). Both parses are now
   `remember`-ed by their input string.
3. **`SimpleDateFormat` allocated per item per recomposition** in the
   metadata footer; now one file-level formatter, with the formatted
   string remembered per date.
4. Same formatter pattern in `AdBlockSettingActivity`, which built a
   `SimpleDateFormat` inside the `items` lambda for every filter row.

## Verification

Compiles and installs cleanly. The scroll/expand logic inside the flow
collector is byte-for-byte the old `when` branch; the query list screen
itself was exercised earlier in the audit session. (The screen's entry
point — AI chat history — needs seeded GPT data to drive further.)
