---
title: Agent tools to persist per-domain JS/CSS DOM patches
project: einkbro
date: 2026-04-26
commit: ed6f32da
---

# Agent tools for per-domain DOM patches

## Problem

Users frequently want the in-browser AI agent to "remove this cookie banner",
"hide that newsletter popup", or "kill the sticky ad bar". The agent had no
way to do this durably:

- Its only view of the page was the reader-mode-cleaned `text` field of
  `InitialPageSnapshot` — which strips out exactly the banners, popups, and
  ads the user is asking about. The agent literally could not see the thing
  it was being asked to remove.
- It had no write path back into EinkBro's per-domain settings, so even if
  it could identify the element, any fix would die on the next reload.

## Root Cause

`InitialPageSnapshot` was designed for "summarize / answer questions about
this page" agent tasks, where reader-mode text is exactly what you want.
DOM-patch tasks have the inverse requirement: the agent needs the raw
markup *plus* a way to persist a snippet that re-applies on every load.

EinkBro already has the persistence primitive — `domainConfigurationMap`
with `postLoadJavascript` and `customCss` fields, which the WebView
auto-injects on every page load on a host. It just wasn't reachable from
the agent tool surface.

## Solution

Three layers of additions:

1. **Snapshot capture** — `BrowserActivity.captureRawBodyHtml()` runs
   `document.body.innerHTML` via `evaluateJavascript`, unescapes the
   JSON-quoted result, and folds it into `InitialPageSnapshot.rawHtml`
   alongside the existing reader-mode text.

2. **Tool surface** — five new methods on `BrowserTools`
   (`initialPageRawHtml`, `getInitialDomainJavascript`,
   `getInitialDomainCss`, `setInitialDomainJavascript`,
   `setInitialDomainCss`), all scoped to the originating page's host
   parsed from the snapshot URL. Setters are pass-through to
   `ConfigManager.updateDomainConfig`; blank input clears the entry.

3. **Agent contract** — five new tool schemas in `AgentToolSchema` plus
   a system-prompt addendum that walks the agent through the explicit
   workflow: read raw HTML → read existing domain JS → compose snippet
   (querySelectorAll + textContent matching, try/catch wrapping,
   MutationObserver for late renders) → write the **full combined**
   script back. Setters are REPLACE not append, so the prompt
   repeatedly emphasises preserving prior rules. Recommends CSS over
   JS when `display:none` suffices.

The dispatch wiring lives in `ChatWebInterface` alongside the existing
agent tool cases, with confirmation strings echoing host + character
counts so the user can see what got saved.

## Key Files

- `app/src/main/java/info/plateaukao/einkbro/task/BrowserTools.kt` —
  interface additions, `InitialPageSnapshot.rawHtml` field
- `app/src/main/java/info/plateaukao/einkbro/task/BrowserToolsImpl.kt` —
  host parsing + `domainConfigurationMap` reads/writes
- `app/src/main/java/info/plateaukao/einkbro/activity/BrowserActivity.kt` —
  `captureRawBodyHtml()` suspend helper, snapshot wiring
- `app/src/main/java/info/plateaukao/einkbro/browser/ChatWebInterface.kt` —
  five new tool dispatch cases
- `app/src/main/java/info/plateaukao/einkbro/task/AgentToolSchema.kt` —
  tool schemas + DOM-PATCH WORKFLOW prompt section

## Lessons Learned

- **Reader-mode and raw-DOM are complementary, not substitutable.** The
  same task ("look at this page") wants different shapes depending on
  whether the agent is summarising content or manipulating chrome. Carry
  both in the snapshot rather than picking one.
- **REPLACE-style setters need explicit prompt scaffolding.** The natural
  agent behaviour with a `set_domain_javascript(code)` tool is to write
  just the new code and silently clobber whatever was there. Mitigated
  by (a) pairing every setter with a getter, (b) repeating the
  read-first-then-concatenate rule in *both* the tool descriptions and
  the system prompt. Belt-and-braces because the cost of a clobber is a
  silently broken site.
- **Persistence boundaries should be explicit in tool naming.** Naming
  the tools `set_domain_*` (rather than `set_page_*` or just
  `inject_js`) makes it obvious to the agent that the effect outlives
  the current task and applies to every future visit — which is what
  steers it toward narrow selectors + try/catch instead of
  fire-and-forget snippets.
- **`evaluateJavascript` returns JSON-quoted strings.** The unescape
  dance (`HelperUnit.unescapeJava` + strip outer quotes) is easy to
  forget; centralising it in `captureRawBodyHtml` keeps callers simple.
