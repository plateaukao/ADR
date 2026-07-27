2026-07-28

# sim-use: release executable goes arm64-only

Small deliberate narrowing of the release surface, requested while setting up
a copy-to-another-Mac workflow: `scripts/build.sh executable` (and therefore
`local-release.sh` and `dev-install.sh`) used to build the CLI twice — arm64
and x86_64 — and lipo them into a universal binary. Intel Macs are not a
target anyone uses this on, so the x86_64 build was pure cost: it doubled the
release-shaped build time on every `dev-install` / release run.

Now the executable is built once for arm64, and the stage verification
expects exactly that slice.

Two things deliberately did **not** change, to keep the blast radius at zero:

- **Artifact and archive names** (including the `create-universal-archive`
  subcommand and the tarball filenames). The homebrew formula's download URL
  keys off the asset name; renaming it would ripple through the release
  pipeline for no functional gain.
- **The FB\* XCFrameworks keep both slices.** Their
  `macos-arm64_x86_64` slice directory name is hardcoded in `Package.swift`'s
  force-load linker flags, and they are static archives — an arm64 link never
  pulls the x86_64 members, so the extra slice costs disk in `build_products/`
  and nothing in the shipped binary. Rebuilding them single-arch would rename
  the slice directory and break every existing checkout's build for a
  negligible win.
