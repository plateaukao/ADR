# EinkBro — Free-Form Agent Moves Into Chat-With-Web

## Problem

The free-form custom task (added in the previous task-runner commit) ran
inside a one-shot `TranslationViewModel` popup. The translation popup's
design assumed a single request/response cycle — once the agent called
`finish`, the conversation was over. Users had no way to ask follow-up
questions like *"tell me more about #2"* or *"now read them in English"*
without re-running the entire task from scratch, losing all prior
context.

Meanwhile, EinkBro already had **Chat With Web** — a persistent chat tab
backed by `chat.html`, `ChatWebInterface`, and `chatStream`, with proper
multi-turn history and a real chat UI. It just had no way to invoke
tools during a conversation.

## Root Cause

Two features with adjacent needs built separately:

- **Free-form agent**: knew how to dispatch tools but lived in a
  single-shot popup.
- **Chat With Web**: knew how to do multi-turn conversation but was
  text-only, with no tool-calling wiring.

The right answer was always to fuse them. Blockers that made the first
implementation take the popup path:

1. `OpenAiRepository` had no tool-calling support at all — non-streaming
   `chatWithTools` had to be added first (done in the previous commit).
2. `ChatWebInterface.chatHistory` was `List<ChatMessage>`, which has no
   `tool_call_id` / `tool_calls` fields — couldn't carry an agent
   conversation in that history directly.
3. `chat.html` was designed around plain text streaming — needed to
   verify that tool-call progress rendering would fit without JS
   changes.

Plus several device-testing regressions from the previous shipment
(translation popup race, `TranslateDialogFragment` auto-firing
`translate()` into a task-mode session, `explicitNulls` emitting
`tool_call_id: null` on user messages causing OpenAI to silently drop
tools, no TTS streaming in the template, no locale default for summary
language) that were bundled into this same commit.

## Solution

**Agent mode is now a sticky flag on `ChatWebInterface`.** When the
class is constructed with `agentMode = true` plus the required deps
(context, webViewCallback, browserState, ttsViewModel, initialSnapshot),
every user message routes through a ReAct-style loop instead of the
regular `chatStream` path:

```
sendMessage("open the top 3 stories and read each aloud")
    │
    ▼
runAgentTurn(userMessage)
    │
    ▼  jsHelper.startMessageStream() — opens assistant bubble
agentLoop(userMessage)
    │
    ▼  toolHistory: MutableList<ToolChatMessage>  (parallel to chatHistory)
    │     first turn seeds with system prompt + snapshot hint
    │
    ▼
loop up to 12 times:
    ├── chatWithTools(toolHistory, AgentToolSchema.tools, …)
    │
    ├── for each tool_call: appendBubble("🔧 tool_name(args)") +
    │                        dispatchAgentTool(call) +
    │                        toolHistory += tool-role message
    │                        (BrowserToolsImpl does the actual work)
    │
    └── if no tool_calls: append text, finish bubble, return
```

**Originating page capture.** The chat tab itself becomes the new active
tab, so `browserState.ebWebView` no longer points at the page the user
wanted summarized. Before opening the chat tab, `runCustomTask`
snapshots `{url, title, reader-mode text, extracted links}` into a new
`InitialPageSnapshot` data class. `BrowserToolsImpl` gains constructor
injection for this snapshot and exposes it through four new methods
(`initialPageUrl`, `initialPageTitle`, `initialPageText`,
`initialPageLinks`). Two new agent tools — `get_initial_page_links` and
`read_initial_page` — surface the snapshot to the LLM, and the system
prompt tells the agent to call those first when the user refers to
*"this page"* / *"these articles"* / *"the top stories"*.

**Tool progress in the chat bubble.** Rather than extending `chat.html`
with special tool-pill rendering, each agent turn writes a single
assistant bubble that grows via sequential `sendStreamUpdate` calls —
first the tool call header (`🔧 \`tool_name\` — {args}`), then the
model's final text after the `finish` tool. The existing JS delta-append
code handles this without modification.

**Non-streaming agent turns.** Each LLM call in the agent loop is
non-streaming (`chatWithTools`). Streaming tool-call deltas would
require extending `ChatDelta` with a partial-args accumulator, which is
disproportionate when the user already watches tool progress stream in
as the loop dispatches each call. The only thing the user waits on per
turn is the *text* portion of a single LLM reply, which is short in
practice.

**Lifecycle.** `ChatWebInterface` gains a lazy `agentTools:
BrowserToolsImpl` with an `agentToolsInitialized` flag set on first tool
dispatch. `disposeAgent()` tears down the off-screen WebView only if
the flag was ever set. `EBWebView.destroy()` calls `disposeAgent()` so
closing the chat tab releases the off-screen WebView without touching
regular chat tabs.

**Also fixed in this commit** (from device testing of the previous
shipment):

- **Popup race**: `runTaskById` / `runCustomTask` now call
  `taskRunner.run(...)` *before* `setupTaskStream`, so the collector's
  first emission is the fresh Running state instead of the previous
  task's leftover Done value.
- **Auto-translate leak**: `TranslateDialogFragment.onCreateView` calls
  `translationViewModel.translate()` unconditionally whenever the popup
  opens. In task mode that fired an LLM query against empty input and
  the reply ("please provide text") overwrote the task progress. Added
  an `isTaskMode` flag on `TranslationViewModel`; `translate()` early-
  returns when set; `setupGptAction` clears it so other GPT features
  still work.
- **`explicitNulls` tool drop**: a dedicated `toolJson` with
  `explicitNulls = false` so `tool_call_id: null` / `tool_calls: null`
  on user / system messages are omitted from the wire payload. OpenAI
  was silently dropping the `tools` field when those null fields were
  present.
- **Per-article TTS streaming**: new `BrowserTools.speak(text, title)`
  method plumbed into `TtsViewModel.readArticle` (which already queues
  or plays). `ReadArticleListTask` calls it once per article in the
  ordered consumer so the user hears summary 1 while the LLM is still
  working on summary 2.
- **Locale-default summary language**: new
  `BrowserTools.defaultLanguageName()` returning
  `Locale.getDefault().getDisplayName(Locale.ENGLISH)`. The template
  summary prompt injects *"Reply in $language unless the article
  content requires otherwise"* so zh-rTW users get Traditional Chinese
  summaries automatically.
- **Pipelined fetch/summarize**: `ReadArticleListTask` now launches a
  producer coroutine that serially fetches pages (one off-screen
  WebView) and fans out `async` summary calls per page. A list of
  `CompletableDeferred<ArticleResult>` lets the ordered consumer stream
  summaries into both the markdown result and TTS as each one lands,
  rather than waiting for the full batch.
- **`speak` tool for free-form agent**: added to `AgentToolSchema` so
  the LLM can honor user requests like *"read it out loud"*.
- **Stronger agent system prompt**: explicit instruction to fetch via
  tools rather than asking the user to paste content, and to start
  with `get_initial_page_links` / `read_initial_page`.

## Key Files

**Modified**

- `browser/ChatWebInterface.kt` — biggest change. Agent-mode
  constructor params, `runAgentTurn` / `agentLoop` / `dispatchAgentTool`,
  parallel `toolHistory: MutableList<ToolChatMessage>`, lazy
  `agentTools: BrowserToolsImpl`, `disposeAgent()`.
- `view/EBWebView.kt` — `setupAiPage` gains agent-mode params,
  `runAgentPrompt(prompt)` helper, `destroy()` calls
  `chatWebInterface?.disposeAgent()`.
- `activity/delegates/AiChatDelegate.kt` — new
  `chatWithWebAgent(prompt, snapshot)` method mirroring the new-tab
  branch of `chatWithWeb` but wiring agent fields.
- `activity/BrowserActivity.kt` — `runCustomTask` snapshots the current
  tab (url/title/rawText + parsed links) and calls `chatWithWebAgent`.
  TaskRunner wiring for the custom path removed. AiChatDelegate
  construction now passes `ttsViewModel`.
- `data/remote/OpenAiRepository.kt` — dedicated `toolJson` with
  `explicitNulls = false`, request/response logging under
  `OpenAiRepository` tag.
- `task/BrowserTools.kt` — `InitialPageSnapshot` data class + four
  `initialPage*` methods + `speak(text, title)` +
  `defaultLanguageName()`.
- `task/BrowserToolsImpl.kt` — new constructor param for snapshot +
  ttsViewModel; implements new methods.
- `task/AgentToolSchema.kt` — `get_initial_page_links`,
  `read_initial_page`, `speak` tool defs; system prompt updated.
- `task/TaskRunner.kt` — `ttsViewModel` plumbed through to
  `BrowserToolsImpl` for the template path's TTS streaming.
- `task/tasks/ReadArticleListTask.kt` — pipelined fetch/summarize with
  per-index `CompletableDeferred`; streams TTS per article in input
  order.
- `viewmodel/TranslationViewModel.kt` — `setupTaskStream`,
  `setupGptAction` cancel the task collector, `isTaskMode` guard in
  `translate()`.

**Deleted**

- `task/tasks/FreeFormAgentTask.kt` — logic lives in
  `ChatWebInterface.dispatchAgentTool` now.

Commit: `18b6f27c`

## Lessons Learned

- **Two code paths with adjacent needs converge naturally.** The
  previous commit shipped free-form agent and chat-with-web as separate
  features. The moment a user asked for follow-up questions, the right
  answer was to merge them. The key enabling primitives (`chatWithTools`
  + `BrowserToolsImpl`) were written in a way that transplanted cleanly
  — keep tool surfaces decoupled from their execution context.

- **Parallel history types beat mutating the existing one.**
  `ChatWebInterface` already had a `chatHistory: MutableList<ChatMessage>`
  for plain chat. Agent mode needs `toolHistory:
  MutableList<ToolChatMessage>` because `ToolChatMessage` has nullable
  `content` + optional `tool_calls` + `tool_call_id` that `ChatMessage`
  doesn't have. Rather than retrofitting `ChatMessage` to carry tool
  fields (which would have rippled through Gemini, streaming, and
  every existing call site), the two histories live side by side and
  the mode flag picks one.

- **`explicitNulls = false` is not optional for OpenAI tool-calling.**
  OpenAI rejects — or silently ignores the tools array when — user /
  system messages carry `tool_call_id: null` or `tool_calls: null`. The
  spec says those fields should only be present on the correct roles.
  A dedicated `toolJson` Json instance with `explicitNulls = false`
  costs a few lines and avoids a mystery symptom (the model
  "conversationally asking for content it should have fetched").

- **`TranslateDialogFragment.onCreateView` firing `translate()`
  unconditionally was a non-obvious trap.** The popup is a generic
  container and other features (translation, GPT actions) depend on
  that auto-translate behavior — you can't just remove it. An
  `isTaskMode` flag that makes `translate()` a no-op while a task
  stream is active is the minimal fix that preserves the other
  consumers.

- **A dialog-open race is easy to miss in a one-shot design.** The
  first task run worked perfectly because `_progress.value` was `null`
  (filter out, wait for Running). The second run failed visually
  because the previous task's Done state was still in the StateFlow
  when the new collector attached. Calling `taskRunner.run()` *before*
  `setupTaskStream` makes the collector's first emission the fresh
  Running state. Cheap fix; easy to forget; only visible on second+
  invocations.

- **Delta-append streaming can carry tool progress as plain markdown.**
  I expected to need `chat.html` changes to render tool calls nicely
  (pills, cards, icons). Turns out the existing `updateStreamMessage`
  concatenating chunks into one markdown bubble is fine — tool-call
  headers as `🔧 \`name\` — args` lines are readable enough and
  completely avoid touching the JS. When a simple wire format works,
  don't build UI for it.

- **Snapshotting the originating page upfront is cleaner than
  "current tab" tricks.** The chat tab becomes the new active tab, so
  `activeTab*` no longer points at the page the user wanted
  summarized. Capturing the snapshot at entry (URL, title,
  reader-mode text, link list) before opening the chat tab, and
  exposing it through zero-cost `initialPage*` tools, means the agent
  never needs a round-trip just to find out what the user was looking
  at — *and* the originating page can be navigated away from without
  losing context.
