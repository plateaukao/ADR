# Notable Fork (Ethran) Binary Size Analysis

## Problem
The Ethran/notable fork's v0.2.0 release APK is ~116 MB, which is very large for a note-taking app.

## Root Cause

### Size progression

| Release | Size | Delta |
|---------|------|-------|
| v0.1.0  | 76 MB | baseline |
| v0.1.3  | 72 MB | -4 MB |
| **v0.1.4** | **107 MB** | **+35 MB (MuPDF added)** |
| v0.1.11 | 110 MB | +3 MB |
| v0.2.0  | 116 MB | +6 MB (Hilt, new features) |

### Primary contributors

1. **MuPDF native library (~35 MB)** — `com.artifex.mupdf:fitz:1.26.10` added in v0.1.4 for PDF support. Ships native `.so` files for all CPU architectures (arm64-v8a, armeabi-v7a, x86, x86_64).

2. **`minifyEnabled false` on release builds** — R8/ProGuard is disabled for both debug and release build types, so unused code and resources are never stripped.

3. **No ABI splits / universal APK** — A single APK bundles native libraries for all architectures. `jniLibs { pickFirsts += ['**/*.so'] }` confirms this. No AAB or per-ABI split is used.

4. **Heavy native dependency stack**:
   - Onyx SDK (`onyxsdk-device`, `onyxsdk-pen`, `onyxsdk-base`) — native .so for e-ink
   - LZ4 (`lz4-java`) — native compression
   - Apache Commons Compress
   - Firebase platform
   - `material-icons-extended` — very large without R8 tree-shaking

## Potential Solutions (for reference)

1. Enable `minifyEnabled true` + R8 on release builds (biggest easy win)
2. Use ABI splits or publish AAB instead of universal APK
3. Exclude unused architectures (x86/x86_64 if targeting real devices only)
4. Replace `material-icons-extended` with specific icon imports

## Key Files

- `app/build.gradle` in [Ethran/notable](https://github.com/Ethran/notable) — release config with `minifyEnabled false`
- Release: https://github.com/Ethran/notable/releases/tag/v0.2.0

## Lessons Learned

- MuPDF is a major size cost (~35 MB) when bundled as a universal APK. If we add PDF support to our fork, consider ABI splits or AAB distribution.
- Always enable R8 minification for release builds — it's a free size reduction.
- The `material-icons-extended` dependency is a known size bloat without tree-shaking.
