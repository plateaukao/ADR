2026-07-17

# EinkBro iOS: URL-bar search suggestions and the app-icon bookmark fallback

Continuation of the settings-gap work (`docs/SETTINGS_AUDIT.md`), committed as
`24d331d`.

## Engine suggestions in the URL bar

The `enableSearchSuggestion` toggle was the biggest inert pref left: the URL
input drew only local history/bookmarks, and typing didn't even filter them
(the `onTextChange` hook was empty). Android's `SearchSuggestionViewModel`
merges up to four network suggestions from the active search engine ahead of
the locally filtered records.

The port adds `SearchSuggestionFetcher` in the same package path. One
deliberate divergence: Android fetches Google suggestions from the XML
toolbar endpoint and parses it with `XmlPullParser`, which doesn't exist in
common Kotlin — the fetcher uses Google's `client=firefox` endpoint instead,
which serves the same suggestions in the OpenSearch JSON shape
(`["query", ["s1", ...]]`) that every other engine (DuckDuckGo, Bing, Ecosia,
Startpage, Yandex) already uses, so a single kotlinx-serialization parser
covers all engines.

The URL-input composable now mirrors `updateSuggestions` semantics: each
keystroke filters local records immediately; short queries with local hits
skip the network, as does the pref being off; otherwise a 200 ms debounced
fetch (via `snapshotFlow` + `collectLatest`, so stale queries cancel) puts
the engine suggestions ahead of the local rows as `RecordType.Suggestion`,
which the existing list UI already renders with append-to-query arrows.
Simulator-verified: typing "black hole news" shows four Google completions.

## Bookmark fallback icon

Bookmark rows without a stored favicon fell back to an earth glyph with a
porting-era comment admitting Android uses the app launcher icon. The
launcher webp (from the Android mipmap tree) is now a compose resource and
the fallback branch renders it via `painterResource` (Skia decodes webp;
`ActionIcon` couldn't be reused since it only renders vectors).
Simulator-verified alongside real favicons in the same list.
