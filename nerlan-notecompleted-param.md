2026-07-07

# NerLan: noteCompleted drops its unused parameter

`ListeningStatsStore.noteCompleted(_ record: EpisodeRecord?)` accepted the finished episode but never read it — completions are a single counter in the stats blob. The parameter implied per-program completion tracking that doesn't exist; adding it for real would require a `Stats` schema change, and that schema must stay wire-compatible with the Android app's synced blobs (both iCloud KVS and the Drive `stats-{device}.json` peers), so it isn't something to slide in casually.

Rather than keep an argument that suggests behavior the function doesn't have, the signature is now `noteCompleted()`. If per-program completions become wanted later, that's a deliberate cross-platform schema addition (optional field, old blobs must still decode).
