# EinkBro — Task Runner for Multi-Step Browser Workflows

## Problem

EinkBro had all the primitives for interesting browsing automation — a
unified `BrowserAction` sealed class, reader-mode text extraction via
`EBWebView.getRawText()`, and working OpenAI/Gemini chat — but no way to
*combine* them into user-triggered multi-step workflows. A user reading
a news front page couldn't say "open each article link and summarize
each one" without manually tapping through every link.

## Root Cause

The action system dispatched single one-shot operations. There was no:
- Off-screen WebView for background page loads that don't disturb the
  active tab.
- LLM-driven agent loop (no function-calling wiring in
  `OpenAiRepository`).
- Way to stream multi-step progress into the existing translation
  popup.
- Locale-aware default language hint for LLM prompts (summaries would
  come back in English for a zh-rTW user).

## Solution

Introduced a `task/` package with a layered design:

1. **`BrowserTools` façade** — a single suspend interface exposing
   `openUrlInBg`, `currentBgPageText`, `currentBgPageLinks`,
   `activeTabText`, `activeTabLinks`, `askLlm`, plus progress sinks
   (`info` / `tool` / `error` / `finish`). Both deterministic templates
   and the free-form LLM agent call the same surface.

2. **`BrowserToolsImpl`** — owns a lazy off-screen `EBWebView`
   following the `AiChatDelegate.linkContentWebView` pattern. Uses
   `CompletableDeferred` + 30s timeout per load. Cookies are
   process-wide so auth-walled sites work automatically.

3. **`TaskRunner`** — lifecycle-scoped orchestrator in `BrowserActivity`.
   Exposes a `StateFlow<TaskProgress?>` the UI collects from, supports
   cancellation, disposes the off-screen WebView on completion.

4. **`ReadArticleListTask`** — the user's example workflow. Extracts
   links from the active tab, sends numbered `{text, href}` list to the
   LLM and asks for a JSON array of article-link indices, then iterates
   (cap 10) through each kept link: `openUrlInBg` → `currentBgPageText`
   → `askLlm` 2-sentence summary → accumulate into aggregated markdown.

5. **`FreeFormAgentTask`** — ReAct-style loop (cap 12 iterations).
   Exposes 5 tools to the LLM: `open_url`, `read_current_page`,
   `get_page_links`, `note`, `finish`. Required extending
   `OpenAiRepository` with parallel `ToolChatRequest` / `ToolChatMessage`
   / `ToolCall` / `FunctionDef` types and a non-streaming
   `chatWithTools()` method — kept separate from existing `ChatMessage`
   so Gemini and streaming paths are untouched. Gated to
   OpenAI-compatible backends.

6. **Results UI** — reuses the existing translation popup via a new
   `TranslationViewModel.setupTaskStream(progressFlow)` bridge that
   converts `TaskProgress` into the popup's existing markdown-rendering
   path. No new bottom sheet needed.

7. **TTS auto-read** — `BrowserActivity.observeTaskForTts` subscribes
   to `taskRunner.progress`, awaits the first non-Running state via
   `filterNotNull().first { … }` (no coroutine leak between runs), and
   calls `ttsViewModel.readArticle` with a markdown-stripped version.
   A tiny `markdownToSpeech` helper removes `#` headers, `**bold**`,
   backticks, standalone URL lines, and `---` so the TTS engine
   doesn't vocalize syntax noise. Template tasks only — free-form
   agent results are not auto-read since users can put "read aloud"
   in the prompt themselves.

8. **Locale-default language** — new `BrowserTools.defaultLanguageName()`
   returns the UI locale's English display name (e.g. `"Chinese
   (Taiwan)"`, `"English"`) via `config.uiLocaleLanguage` falling back
   to `Locale.getDefault()`. `ReadArticleListTask` injects `"Reply in
   $language unless the article content requires otherwise"` into the
   per-article summary prompt. Link-filter step is untouched since it
   only outputs JSON indices.

9. **Entry point** — `BrowserAction.ShowTaskMenu` is registered in the
   AI category of `BrowserActionCatalog`, so users bind it to a
   gesture via the existing picker. `TaskMenuDialogFragment` shows
   built-in templates plus "Custom task…" which opens
   `CustomTaskInputDialogFragment`.

## Key Files

**New**
- `app/src/main/java/info/plateaukao/einkbro/task/BrowserTools.kt` — façade interface
- `app/src/main/java/info/plateaukao/einkbro/task/BrowserToolsImpl.kt` — off-screen WebView backed impl
- `app/src/main/java/info/plateaukao/einkbro/task/TaskRunner.kt` — orchestrator + StateFlow
- `app/src/main/java/info/plateaukao/einkbro/task/TaskProgress.kt` — progress data model
- `app/src/main/java/info/plateaukao/einkbro/task/BrowserTask.kt` — task interface
- `app/src/main/java/info/plateaukao/einkbro/task/TaskCatalog.kt` — registry of built-in templates
- `app/src/main/java/info/plateaukao/einkbro/task/AgentToolSchema.kt` — OpenAI function schemas
- `app/src/main/java/info/plateaukao/einkbro/task/tasks/ReadArticleListTask.kt` — built-in template
- `app/src/main/java/info/plateaukao/einkbro/task/tasks/FreeFormAgentTask.kt` — LLM agent loop
- `app/src/main/java/info/plateaukao/einkbro/view/dialog/compose/TaskMenuDialogFragment.kt` — template picker
- `app/src/main/java/info/plateaukao/einkbro/view/dialog/compose/CustomTaskInputDialogFragment.kt` — free-form input
- `app/src/main/assets/extract_links.js` — DOM link extraction

**Modified**
- `app/src/main/java/info/plateaukao/einkbro/browser/BrowserAction.kt` — added `ShowTaskMenu` / `RunTask` / `RunCustomTask`
- `app/src/main/java/info/plateaukao/einkbro/browser/BrowserActionCatalog.kt` — registered `ShowTaskMenu` under AI
- `app/src/main/java/info/plateaukao/einkbro/activity/BrowserActivity.kt` — `taskRunner` delegate, dispatch handlers, `observeTaskForTts`, `markdownToSpeech`
- `app/src/main/java/info/plateaukao/einkbro/data/remote/OpenAiRepository.kt` — tool-calling types + `chatWithTools`
- `app/src/main/java/info/plateaukao/einkbro/view/WebViewJsBridge.kt` — `getPageLinks` method
- `app/src/main/java/info/plateaukao/einkbro/viewmodel/TranslationViewModel.kt` — `setupTaskStream`
- `app/src/main/res/values/strings.xml` + `values-zh-rTW/strings.xml` — task labels

Commit: `eb4d6109`

## Lessons Learned

- **Parallel types beat modifying hot-path data classes.** The existing
  `ChatMessage.content` is non-null and is consumed by the Gemini path
  (`messages.joinToString(" ") { it.content }`). Making it nullable to
  accommodate OpenAI tool-call messages would have silently broken
  Gemini. Parallel `ToolChatMessage` cost a few extra lines but kept
  the two protocols independent.

- **Shared façade for both deterministic and agent paths.** Writing
  `BrowserTools` once and having templates call it imperatively while
  the agent loop calls it via JSON tool dispatch means the "set of
  things the automation can do" lives in exactly one interface.
  Adding a tool is one place, not two.

- **Reuse the translation popup instead of building a new sheet.** The
  existing markdown rendering path in `TranslationViewModel` already
  handles streaming text. A 20-line `setupTaskStream` bridge that
  converts `TaskProgress` → markdown avoided an entire new Compose UI
  surface.

- **StateFlow `first { … }` beats hand-rolled "spoken" flags.** My
  first draft of `observeTaskForTts` used a manual `var spoken =
  false` inside a `collect {}`. That works but leaks one coroutine
  per task run because StateFlow never completes. `filterNotNull()
  .first { it.status != Running }` cleanly suspends until a terminal
  state and then the coroutine exits.

- **Strip markdown before TTS.** Feeding `ttsViewModel.readArticle` raw
  markdown means the engine vocalizes `##`, `**`, and full URLs. A
  tiny regex pass (4 substitutions + 2 filters) converts the
  aggregated result into clean speech.

- **Locale-default language in the LLM prompt is a one-liner with huge
  UX impact.** Injecting `"Reply in $language"` into the summary
  system prompt — where `language` is
  `Locale.getDefault().getDisplayName(Locale.ENGLISH)` — means a
  Traditional Chinese user never has to configure anything to get
  Traditional Chinese summaries. Would have been easy to hardcode
  English and ship a bad default.
