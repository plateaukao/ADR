2026-07-07

# NerLan: iCloud KVS bulk pushes flush once, not per key

`CloudKVStore.set` paired every write with `store.synchronize()`. For single-item writes (toggling one favorite) that's the right eager behavior, but the reconcile loops — favorites, favorite programs, AI-tab records, podcast subscriptions — pushed potentially hundreds of keys when sync is enabled or an iCloud account change forces a re-push, issuing one flush per key.

A `setDeferred` variant writes without the flush; each bulk call site now calls `synchronize()` exactly once after its batch (`FavoritesStore.reconcile` flushes internally, since the account-change path added earlier calls it without going through `enableSync`). Single-item writes are unchanged.
