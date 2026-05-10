# Firefox Sync Support Feasibility Analysis

**Issue:** [plateaukao/einkbro#506](https://github.com/plateaukao/einkbro/issues/506)  
**Date:** 2026-04-11

## Problem

Users want to sync bookmarks and send/receive tabs between EinkBro and desktop Firefox using Firefox Sync.

## Current State

EinkBro has no cloud sync. Existing sharing is local-network only:
- Multicast UDP for sending tabs between devices on the same LAN
- Backup/restore via ZIP files (bookmarks, history, settings)
- Instapaper integration (send-only, not sync)

## Key Findings

### Critical Blocker: OAuth Client Registration

Firefox Sync's protocol is open and well-documented. However, **Mozilla currently does not grant OAuth `client_id` registrations to non-Mozilla apps**. Without a registered `client_id`, EinkBro cannot authenticate users against Firefox Accounts.

Workarounds:
- **Borrow an existing public client_id** (e.g., discontinued Lockwise app's) — works but fragile
- **Self-hosted FxA** — legitimate but impractical for most users
- **Request one from Mozilla** (dev-fxacct@mozilla.org) — no guarantees

### Technical Complexity

| Aspect | Challenge Level | Notes |
|---|---|---|
| FxA OAuth + scoped key exchange | High | ECDH + PKCE + JWE, custom crypto chain |
| HAWK-authenticated API calls | Medium | Non-standard auth scheme |
| Client-side encryption (AES-256-CBC + HMAC) | Medium | Must be perfect — bugs corrupt data |
| Bookmark merge/conflict resolution | **Very High** | Firefox's implementation is thousands of lines of Rust |
| Send Tab (device commands + WebPush) | High | Requires push notification infrastructure |
| APK size (if using Mozilla's Rust libs) | Medium | +15-25MB per ABI from native libraries |

### Effort Estimates

| Approach | Effort | Trade-off |
|---|---|---|
| Use Mozilla Android Components | 3-5 weeks | Significant APK bloat, heavy dependencies |
| Pure Kotlin from scratch | 8-14 weeks | No dependencies but massive implementation effort |
| Read-only bookmarks only (no merge) | 2-3 weeks | Much simpler but limited usefulness |

## Root Cause (of infeasibility)

Mozilla's Firefox Accounts ecosystem is not designed for third-party client integration. The protocol is open, but the authentication gateway is effectively closed to external apps.

## Recommendation

**Not practically feasible right now** due to the OAuth client registration blocker and high effort-to-value ratio.

### More Practical Alternatives

1. **WebDAV bookmark sync** — standard protocol, many self-hosted options, simpler implementation
2. **Bookmark import/export via Chrome HTML format** — already partially supported in EinkBro
3. **Enhance existing LAN-based sharing** — extend to work over the internet (relay server or P2P)

## Key Files (existing sync-related code)

- `app/src/main/java/info/plateaukao/einkbro/database/Bookmark.kt` — Bookmark entity
- `app/src/main/java/info/plateaukao/einkbro/database/BookmarkDao.kt` — Bookmark DAO & Manager
- `app/src/main/java/info/plateaukao/einkbro/unit/ShareUtil.kt` — LAN share utilities
- `app/src/main/java/info/plateaukao/einkbro/unit/BackupUnit.kt` — Backup/restore system

## Lessons Learned

- Mozilla's sync protocol documentation is thorough, but practical access for third-party apps is gated behind OAuth client registration with no public onboarding path.
- The bookmark merge algorithm alone (3-way merge with tombstones, reparenting, deduplication) is a multi-week effort — this is the hidden complexity iceberg.
- Existing third-party Firefox Sync clients (ffsclient in Go, firefox-sync-cli in Node.js) all work around the auth issue by borrowing Mozilla's own client IDs.
