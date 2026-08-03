2026-08-03

# Verifying a Gen AI key and model from the settings screen

Ported from the Android app's `f00bb47f6`, which added the same item there.

## What it does

Each Gen AI engine screen — OpenAI, OpenAI Compatible Server, Google Gemini — now
ends with a **Test connection** row. Tapping it sends a one-word prompt
(`Reply with one word: ok`) using the key and model saved in the rows directly
above, and toasts the concrete outcome: `Connection OK (gemini-3.5-flash-lite)`
or `Connection failed: AI provider rejected the API key`.

The motivation is that until now there was no way to tell a good key from a bad
one inside settings. A typo in the key, or a model name that the account has no
access to, surfaced much later and somewhere else entirely — as a summary that
silently produced nothing, or a translation that stalled — with no indication of
which of the two was at fault. The check has to live next to the fields because
that is where the user is when the value is fresh in their hands.

The same commit bumps the default Gemini model from `gemini-2.5-flash` to
`gemini-3.5-flash-lite`, matching Android. The default lives in three places that
all had to move together: `AiConfig.geminiModel`, the `ifBlank` fallback in
`YouTubeCaptionFetcher`, and the `setting_summary_gemini_model_name` help text in
all eight locales.

## How it works

`OpenAiRepository.testConnection()` is the whole of the new network code. It is
deliberately a *separate* entry point rather than a flag on `chatCompletion()`,
because the two want opposite things from a failure: the existing call sites want
a nullable result they can quietly ignore, while this one exists precisely to
name the failure.

```mermaid
flowchart TD
    A[Tap 'Test connection'] --> B[Toast 'Testing...']
    B --> C{actionType}
    C -->|Gemini| D[queryGemini: POST generateContent<br/>x-goog-api-key header]
    C -->|OpenAi / SelfHosted| E[POST /v1/chat/completions<br/>Bearer gptApiKey]
    D --> F{result}
    E --> G{HTTP status}
    G -->|200| H[decode ChatCompletion]
    G -->|401 / 403| I[MissingKey: key rejected]
    G -->|429| J[RateLimited]
    G -->|5xx| K[ServerError]
    H -->|blank| L[Parse: empty response]
    H -->|text| M[Success]
    F --> N[ApiResult]
    I --> N
    J --> N
    K --> N
    L --> N
    M --> N
    N -->|Success| O[Toast 'Connection OK (model)']
    N -->|Failure| P[Toast 'Connection failed: message']
```

Gemini reuses `queryGemini` unchanged — it already returns a typed `ApiResult`
and already reports a missing key before touching the network. The
OpenAI-compatible branch posts to `getServerUrl(actionType)`, so the self-hosted
screen tests the user's own server rather than api.openai.com, and maps the HTTP
status through the existing `statusFailure()` helper so the four interesting
status classes each get their own message.

Two details in the settings layer are worth keeping:

- The model is passed as a `() -> String` lambda, not a value. `buildGpt*SettingItems`
  runs once when the screen is composed, so a captured value would be the model as
  it was *before* the user edited the row above. Reading it at tap time is what
  makes "edit the model, then test it" work without leaving the screen.
- The result strings are resolved with the suspend `getString(res, arg)` rather
  than the codebase's usual `blockingString`, since the item body is already
  inside `deps.scope.launch` and `blockingString` wraps `runBlocking` — no reason
  to block the main thread when a suspend call is in scope.

## Verification

Simulator (iPhone 16, iOS 26.4), driving the real settings UI:

- The row renders on all three engine screens.
- Gemini with no key configured: `Connection failed: Gemini API key not set` —
  the short-circuit path, no request made.
- OpenAI with no key: a real request to api.openai.com comes back 401 and toasts
  `Connection failed: AI provider rejected the API key` — the full network path.
- The Gemini model dialog now pre-fills `gemini-3.5-flash-lite` and its help text
  quotes the new default.

Not ported from the Android commit: the Gemini `alt=sse` streaming rewrite and
its thought-part filtering, and the typed `CaptionFetchResult` for transcription
failures. iOS deliberately uses the non-streaming Gemini call
(`chatStream` routes Gemini through `queryGemini`), so the SSE work has nothing
to attach to here.
