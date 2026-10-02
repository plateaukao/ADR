2026-10-03

# Reduce the transportation release APK size

The release APK now enables R8 code shrinking, optimization and obfuscation with Android's default optimized ProGuard rules, together with resource shrinking. The original release did not enable these optimizations. This reduced the APK from 2,741,808 to 2,719,988 bytes, but the bundled offline catalogue accounted for almost all remaining space.

The catalogue contained imported coordinate data that the app never reads and several unused or redundant indexes. Removed `stops_coord_ix`, `stops_ix`, `paths_ix` and `routes_ix`, along with the `lon` and `lat` columns in `stops`. Kept `stops_by_route` and `paths_by_route` to support route and direction queries, then compacted the database with SQLite VACUUM. All route, path and stop rows and retained columns are unchanged. Future nearby-stop or map features would need coordinates restored.

The uncompressed database decreased from 6,696,960 to 3,260,416 bytes. Its compressed APK entry decreased from 2,607,235 to 1,341,411 bytes. The final signed release APK is 1,454,164 bytes, saving 1,265,824 bytes (46.54%) relative to the R8-only build, or 46.96% relative to the original release.

Validation passed: release assembly and lint, existing transit and catalogue checks, SQLite integrity checking, comparison of every retained row and column, and verification that the APK embeds the trimmed database. R8 mapping confirms obfuscation. APK signature verification confirmed the existing release signing certificate. No Android device was connected for runtime verification.

The existing GitHub v0.3.0 release APK and its SHA-256 checksum were replaced, retaining the version and release notes. The uploaded APK digest is `203b55426a3aea8b71f39ae8b9e2ee74571d2f93f8ca70be0aa255569ab5650e`. Repository commit: `c34fd42`.

Existing installations retain their already extracted catalogue because its filename uses the unchanged data date. Their query data remains compatible, but this APK replacement does not reclaim that installed database space. Fresh installations extract the smaller database.
