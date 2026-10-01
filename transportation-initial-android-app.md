2026-10-01

# Taipei transportation Android app

The initial transportation commit creates a native Java Android app for Taipei and New Taipei bus arrivals and MRT fare and journey-time lookup. It uses platform widgets and networking, without additional runtime dependencies. The interface uses compact colour cards.

A bundled SQLite catalogue provides offline route search, directions and ordered stops. Live bus estimates are requested independently from the observed Yahoo endpoint and decoded from compressed XML. Keeping arrival retrieval independent of optional catalogue updates avoids losing estimates when an unrelated request fails. Screen and request generations prevent stale responses from updating another screen.

SharedPreferences stores favourites and the direction independently for each route. Two-direction routes switch on a tap. Route and app titles scroll with the stops, bottom navigation collapses, and a sticky update timestamp remains visible after the header scrolls out. Stop-list scrollbars and redundant labels are removed.

MRT lookup uses a bundled station-pair fare and journey-time matrix. Journey time is an estimate, not a live train countdown. The snapshot is dated 2026-10-01; official live MRT integration and catalogue synchronization remain future work.

The debug build, Android lint and parser checks passed. Emulator verification displayed numeric live bus arrivals, exercised direction switching and confirmed direction values in SharedPreferences. The final sticky-row layout and restart restoration still need dedicated interaction checks. Physical Android 10 behaviour remains unverified.

Git tracks app sources, bundled data, build tooling, checks and research notes. Extracted APKs, decompiled code, raw downloads, SDK configuration and generated builds are excluded. The initial application commit is local, with no application remote configured.
