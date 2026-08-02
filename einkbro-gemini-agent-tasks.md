2026-08-02

# EinkBro: custom agent tasks now work on Gemini

## What was broken

With Gemini as the default AI engine, "Custom task…" refused to run — a toast
and an in-chat error both said custom tasks require OpenAI. Users who only
have a Gemini key had no access to the agent at all.

## Root cause

The agent loop's `chatWithTools` speaks the OpenAI chat-completions schema
(tools, `tool_calls`, `tool_call_id` replay) and only routed to api.openai.com
or the self-hosted URL. The app's native Gemini path uses `generateContent`
with a different request shape and no tool-calling wiring, so two guards were
added when the agent was built: one in `TaskMenuDelegate.runCustomTask`, and a
second hardcoded one in `ChatWebInterface.runAgentTurn`. (The second was easy
to miss — it inlines the message instead of referencing the
`task_requires_openai` string resource, so a resource-usage grep doesn't find
it.)

## The fix

Google ships an OpenAI-compatible surface for the Gemini API
(`generativelanguage.googleapis.com/v1beta/openai`) that accepts the exact
same chat-completions + tools schema with the Gemini key as a Bearer token —
so the loop needed routing, not a rewrite (commit `accea00a5`):

- `chatWithTools` sends Gemini-typed actions to the compat endpoint with the
  Gemini key; OpenAI and self-hosted behavior is untouched.
- Both guards removed. The agent follows the default-engine setting, using
  `geminiModel` when Gemini is on, and the pre-flight key check matches the
  engine.

Testing surfaced one real protocol difference: **Gemini 3 requires each
replayed tool call to echo the `thought_signature` it returned** — turn 1
succeeded, but turn 2 died with INVALID_ARGUMENT because our serializer
(`ignoreUnknownKeys`) dropped the signature from the history. The signature
arrives on each tool call as `extra_content: {"google": {"thought_signature":
...}}`; `ToolCall` now carries `extra_content` as an opaque `JsonElement`, so
the loop round-trips it verbatim. For OpenAI the field is null and
`explicitNulls = false` keeps it off the wire entirely.

```mermaid
sequenceDiagram
    participant Loop as Agent loop
    participant G as Gemini OpenAI-compat endpoint

    Loop->>G: turn 1: messages + tool schemas
    G-->>Loop: tool_call get_initial_page_links + extra_content.thought_signature
    Note over Loop: history replays the assistant turn verbatim,
    Note over Loop: signature included via opaque extra_content field
    Loop->>G: turn 2: history with signature + tool result
    G-->>Loop: next tool_call (400 INVALID_ARGUMENT if signature dropped)
```

Verified on the emulator with `gemini-3-flash-preview`: the full
bookmark-categorization flow ran with zero HTTP errors — links, folder
listing, `add_bookmarks`, finish. A transient 503 ("model experiencing high
demand") appeared once mid-test; that is Gemini-side capacity, and an
unchanged retry succeeded.
