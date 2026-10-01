2026-10-01

# Transportation: stop search, arrivals and route shortcuts

Bus search now matches route names, destinations and stop names. Results list matched stops with live arrival estimates separately for each route direction. A direction that does not serve a matching stop is explicitly marked instead of combining its estimate with the other direction. The catalogue query returns distinct routes and groups matching stop IDs by route path; IDs, rather than display names, connect catalogue stops to live arrival records.

Only visible matching routes request live data, using three background workers. Delayed responses cannot overwrite another search or screen. Search history stores the 20 latest distinct nonempty terms in SharedPreferences. Tapping an empty search field opens a rounded popup styled consistently with route cards; selecting an entry restores its query. Empty-search SQL uses only string bindings because Android rawQuery rejects null binding values.

Long-pressing a route title requests a pinned launcher shortcut. The shortcut carries the route key and creation-time direction and opens that route with a fresh arrival request. Its adaptive icon displays the route text; colour prefixes determine the background. Existing pinned route icons are refreshed after an app update. Each route independently remembers its normal selected direction.

Release 0.2.0 is signed with a local release key stored outside Git. The APK was verified as non-debuggable and installed on an Android 15 Palma 2 Pro. The physical device loaded the catalogue, opened a route and retrieved a current timestamp and live service statuses. The repository is private at plateaukao/transportation; commit de6a649 contains these features and the release build configuration.

Release build and lint passed, as did the parser and search regression checks. Emulator verification exercised actual Chinese software-keyboard input, history persistence after restart, both-direction arrival displays, shortcut labels and route-coloured icons, saved shortcut direction restoration, scrolling titles and tabs, and the sticky update row. Live MRT train countdowns and automatic catalogue synchronization remain outside this implementation.
