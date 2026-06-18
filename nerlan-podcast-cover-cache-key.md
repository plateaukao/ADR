# NerLan — Podcast cover art re-downloaded every launch

## Problem

Podcast cover art was not caching: it re-downloaded on every app launch (NER
program covers cached fine), and would intermittently show as missing/blank. The
Caches directory also accumulated orphaned cover files over time.

## Root Cause

`CoverImageCache` derives a stable on-disk filename per cover URL. NER image URLs
carry a unique `key=` query parameter, which it uses directly — stable, so those
covers cache correctly. Podcast cover URLs come from arbitrary RSS feeds and have
no `key=`, so the code fell back to:

```swift
return String(UInt(bitPattern: url.absoluteString.hashValue))
```

`String.hashValue` is seeded with a per-process random value (SipHash), so it
returns a **different result on every launch**. The cache file for a podcast
cover was therefore written under a new name each launch, never found on the next
launch, and re-downloaded — orphaning the previous file each time. Because the
cover was re-fetched every launch, any transient network failure surfaced as a
missing cover.

## Solution

Use a deterministic hash for the fallback key — SHA-256 of the URL string
(`CryptoKit`, already used in `PodcastFeedParser`):

```swift
return SHA256.hash(data: Data(url.absoluteString.utf8))
    .map { String(format: "%02x", $0) }.joined()
```

Now a podcast cover's cache filename is stable across launches, so the two-tier
(memory + disk) cache persists it and it's downloaded only once. The first
successful fetch also means a later network hiccup no longer blanks the cover.

## Key Files

- `NerLan/Sources/CoverImageCache.swift` — `key(for:)` fallback now SHA-256;
  added `import CryptoKit`.

## Lessons Learned

- **Never persist anything keyed on `hashValue`.** Swift's `Hashable.hashValue`
  is intentionally randomized per process for collision-DoS resistance; it is
  only valid within a single run. Anything that must survive across launches
  (filenames, cache keys, dedup keys) needs an explicitly stable hash.
- A self-refreshing cache can mask a fetch as a "sometimes missing" UI bug —
  caching correctly also made the cover robust to transient failures.
