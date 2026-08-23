2026-08-23

# sharik-native: notarized releases

`release.sh <version>` turns the repo into a distributable, notarized
`Sharik-<version>.dmg` and publishes it as a GitHub release; v1.0.0 is the
first one (https://github.com/plateaukao/sharik-native/releases/tag/v1.0.0).

```mermaid
flowchart LR
    A[xcodebuild Release, ARCHS arm64 + x86_64] --> B[codesign Developer ID, hardened runtime, timestamp]
    B --> C[zip -> notarytool submit --wait]
    C --> D[stapler staple the .app]
    D --> E[hdiutil DMG: Sharik.app + Applications link]
    E --> F[codesign DMG -> notarytool submit -> staple DMG]
    F --> G[git tag + gh release create]
```

Choices:

- Version and build number are build settings (`MARKETING_VERSION`,
  `CURRENT_PROJECT_VERSION` = git commit count) substituted into Info.plist,
  so the script is the single place a version is typed; `project.yml` keeps
  no literal.
- Dev builds stay ad-hoc signed without hardened runtime for fast iteration;
  the release build is re-signed with `--options runtime`. The app needs no
  entitlements under hardened runtime (plain sockets, no sandbox, no JIT).
- The artifact is a DMG (stapled app plus an Applications shortcut), itself
  signed, notarized and stapled — two notarization round trips, so both the
  disk image and the app copied out of it pass Gatekeeper offline. A zip was
  the first cut and was replaced: a DMG is what Mac users expect to open.
  A pkg is unnecessary since there is nothing to install beyond dragging.
  The same Developer ID and `notarytool` keychain profile as OhMyBias's
  installer pipeline are reused.
- The universal binary costs ~0.8 MB; total app 1.7 MB.
