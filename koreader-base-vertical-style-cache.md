2026-09-23

# Integrate vertical style cache persistence

The KOReader base layer now points CRengine at the revision that persists writing-mode-related CSS fields in document cache records. This carries the renderer fix that prevents vertical EPUBs from being fully formatted again every time they are reopened.

The submodule update is intentionally isolated from other rendering work so downstream KOReader repositories can adopt and review the cache correction independently.
