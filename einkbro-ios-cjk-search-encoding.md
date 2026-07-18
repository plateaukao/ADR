2026-07-18

# EinkBro iOS: CJK Search Queries Reached Google as Mojibake

## What was broken

Typing a Chinese query in the URL bar (e.g. 愛因斯坦 相對論) produced a
garbage Google search. The same bug sat in the agent's `web_search` tool, so
custom-task agents searching in Chinese got garbage results too.

## Root cause

Both `BrowserViewModel` and `BrowserToolsImpl` carried a copy of a hand-rolled
`percentEncode` that classified each UTF-8 **byte** by first mapping it
through `Char`:

```kotlin
val c = b.toInt().toChar()          // 0x80..0xFF → U+FF80..U+FFFF !
if (c.isLetterOrDigit() || c in "-._~") append(c)
else append('%').append(...)
```

For ASCII this is fine. But a negative byte lands in U+FF80..U+FFFF — and
that range contains halfwidth katakana (U+FF66..FF9F) and halfwidth hangul
(U+FFA0..FFDC), which `isLetterOrDigit()` classifies as letters. So most
UTF-8 continuation bytes leaked through as raw halfwidth characters instead
of `%XX`. 中 (E4 B8 AD) became `%E4ﾸﾭ`: one escape and two stray glyphs.

## Fix

One correct RFC 3986 implementation, `SearchEngineUrls.percentEncodeQuery`,
replaces both private copies. It checks the byte as an unsigned value first —
only ASCII (< 0x80) unreserved characters pass through; every other byte,
including all multi-byte UTF-8, becomes `%XX`:

```kotlin
val i = b.toInt() and 0xFF
val c = i.toChar()
if (i < 0x80 && (c.isLetterOrDigit() || c in "-._~")) append(c)
else append('%').append(i.toString(16).uppercase().padStart(2, '0'))
```

Deduplicating into `SearchEngineUrls` (which both call sites already used to
build the search URL) means the URL bar and the agent tool cannot drift
apart again.

## Verified

In the simulator: pasted 愛因斯坦 相對論 into the URL bar, ran the search,
and Google returned proper results for the query (search suggestions in
Chinese also worked along the way).
