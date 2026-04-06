# EinkBro Cross-Device Sync Study

## Problem

EinkBro users with multiple e-ink devices have no way to sync their bookmarks, browsing history, preferences, and other user data across devices. Currently each device is an island — bookmarks added on one device must be manually recreated on another.

## Current State

### Data Stores

| Data Type | Storage | Existing Export/Import |
|-----------|---------|----------------------|
| Bookmarks | Room DB (`einkbro_db`, table `bookmarks`) | JSON export/import + file-based sync via SAF |
| Browsing History | Legacy SQLite (`Ninja4.db`, table `HISTORY`) | None (only via full backup ZIP) |
| Preferences | SharedPreferences (100+ keys in `ConfigManager`) | None (only via full backup ZIP) |
| Highlights | Room DB (table `highlights`) | None |
| Articles | Room DB (table `articles`) | None |
| Domain Configs | Room DB (table `domain_configuration`) | None |
| Favicons | Room DB (table `favicons`, BLOB) | None |
| Translation Cache | Room DB (table `translation_cache`) | None (ephemeral, not worth syncing) |

### Existing Infrastructure

- **`BackupUnit.kt`** — Full backup (ZIP of all databases + SharedPreferences) and full restore. Also has bookmark-specific JSON export/import and a rudimentary file-based bookmark sync via `bookmarkSyncUrl`.
- **`BookmarkManager`** — `overwriteBookmarks()` method for bulk replacement.
- **SAF integration** — Already uses Android Storage Access Framework for file picking and persistent URI permissions.

### What's Missing

- No granular export/import for history, preferences, highlights, articles, or domain configs.
- No merge logic — bookmark sync is overwrite-only.
- No `lastModified` timestamps on bookmarks or other records for conflict resolution.
- No automatic sync trigger (only manual bookmark sync exists).

## Sync Approaches Evaluated

### Option 1: Enhanced File-Based Sync via Cloud Storage (Recommended First Step)

Extends the existing `BackupUnit` and `bookmarkSyncUrl` pattern. User picks a sync folder on Google Drive, Dropbox, Synology, or local SD card. App writes individual JSON files per data type.

**Architecture:**
- Sync folder configured via SAF directory picker, URI persisted in SharedPreferences.
- Each data type gets its own file: `bookmarks.json`, `history.json`, `preferences.json`, `highlights.json`, `domain_configs.json`.
- Each file includes a `deviceId`, `timestamp`, and `schemaVersion` header.
- Sync triggered manually via button, or automatically on app open/close.

**Merge strategy:**
- Add `lastModified` (epoch ms) column to bookmarks, highlights, articles, domain configs.
- Per-record last-write-wins using `lastModified`.
- Bookmark folders merged by path (parent chain), not by ID (IDs are local).
- Deletions tracked via tombstone records with 30-day TTL.
- History: union merge by (URL, timestamp) — no conflicts possible since records are append-only.
- Preferences: last-write-wins per key, with device-specific keys excluded from sync (e.g., screen-size-dependent settings).

**Pros:**
- Minimal new code — builds on existing `BackupUnit` infrastructure.
- No external service dependency — works with whatever cloud storage user already has.
- Works offline (sync happens via files).
- User owns all data.

**Cons:**
- Not real-time; depends on cloud storage app syncing the folder.
- No push notification when another device updates.

**Effort:** Medium. Main work is adding granular JSON serializers, `lastModified` columns (Room migration), and merge logic.

### Option 2: WebDAV Sync

User configures a WebDAV server URL + credentials. App uploads/downloads JSON to the server directly over HTTP.

**Architecture:**
- WebDAV client library (e.g., Sardine or OkHttp with WebDAV methods).
- Same JSON format and merge strategy as Option 1.
- Sync can run in background via WorkManager on a configurable interval.

**Pros:**
- True network sync — works across any device with internet.
- Background sync possible.
- Compatible with Nextcloud, Synology, any WebDAV server.
- E-ink users who self-host often already have WebDAV.

**Cons:**
- Requires adding a WebDAV client dependency.
- User must have/configure a WebDAV server.
- Credential storage needs care (EncryptedSharedPreferences).

**Effort:** Medium-High. WebDAV client integration + credential management + background sync scheduling.

### Option 3: GitHub Gist Sync

User provides a GitHub Personal Access Token. App stores sync data in a private Gist with one file per data type. Gist revision history provides free versioning.

**Architecture:**
- GitHub REST API via OkHttp (already a dependency).
- Create/update a private Gist with files: `bookmarks.json`, `history.json`, etc.
- On sync: fetch Gist, merge, push updated Gist.

**Pros:**
- Free, no server needed.
- Built-in version history via Gist revisions.
- Simple API (just CRUD on a single Gist).

**Cons:**
- Requires GitHub account and PAT.
- Gist size limit (~100MB, but practically limited to ~10MB for performance).
- GitHub API rate limits (5000 req/hr authenticated).
- PAT management UX is not great for non-developers.

**Effort:** Medium. GitHub API integration is straightforward; PAT storage via EncryptedSharedPreferences.

### Option 4: OPDS Feed (Read-Only)

Expose bookmarks and reading lists as an OPDS/Atom feed for consumption by other e-reader apps.

**Pros:** Fits e-ink ecosystem. **Cons:** Read-only, niche. **Verdict:** Complementary feature, not a sync solution.

## Recommendation

**Phase 1 — Enhanced File-Based Sync (Option 1)**
- Add `lastModified` to Room entities (bookmarks, highlights, articles, domain configs). Write Room migration.
- Add granular JSON export/import for each data type in `BackupUnit`.
- Add sync folder picker in Settings.
- Implement merge logic with last-write-wins + tombstones.
- Add manual sync button + optional auto-sync on app open/close.

**Phase 2 — WebDAV Sync (Option 2)**
- Add WebDAV client.
- Add server configuration UI (URL, username, password).
- Reuse the same JSON format and merge logic from Phase 1.
- Add background sync via WorkManager.

**Phase 3 — Polish**
- Sync status indicator (last synced time, sync errors).
- Conflict resolution UI for edge cases.
- Selective sync (choose which data types to sync).
- Exclude device-specific preferences from sync.

## Key Files

| File | Role |
|------|------|
| `app/src/main/java/info/plateaukao/einkbro/unit/BackupUnit.kt` | Existing backup/restore/bookmark-sync logic |
| `app/src/main/java/info/plateaukao/einkbro/database/BookmarkDao.kt` | Bookmark Room DAO + BookmarkManager |
| `app/src/main/java/info/plateaukao/einkbro/database/Bookmark.kt` | Bookmark entity (needs `lastModified` column) |
| `app/src/main/java/info/plateaukao/einkbro/database/Highlight.kt` | Highlight entity |
| `app/src/main/java/info/plateaukao/einkbro/database/DomainConfiguration.kt` | Domain config entity |
| `app/src/main/java/info/plateaukao/einkbro/database/RecordDb.kt` | Legacy history SQLite |
| `app/src/main/java/info/plateaukao/einkbro/preference/ConfigManager.kt` | SharedPreferences manager (100+ keys) |

## Data Excluded from Sync

- **Favicons** — large BLOBs, easily re-fetched.
- **Translation cache** — ephemeral, device-local optimization.
- **Saved pages** — local file paths, not portable.
- **Ad-filter state** — filter lists are downloaded, not user data.
- **Device-specific preferences** — screen dimensions, toolbar pixel positions, touch area coordinates.
