# mandroid_finder — Unescape backslash-escaped filenames from `ls -la`

**Date:** 2026-04-26
**Status:** Implemented and shipped in commit `26634c1` of `https://github.com/plateaukao/mandroid_finder`

## Problem

User reported: Finder displayed Samsung Galaxy S10 `/sdcard/DCIM` folders as `AR\ Emoji\ camera` and `Screen\ recordings` — literal backslashes inside what should be plain spaces.

## Root Cause

Android's toybox `ls` adapts its output format to whether stdout is a TTY:

- **With a PTY** (e.g., interactive `adb shell` from a terminal): names print as-is (`AR Emoji camera`).
- **Without a PTY** (the adb `shell:` protocol service we use, equivalent to `adb exec-out ls -la`): toybox engages the same escaping convention as coreutils' `ls -b` — spaces become `\ `, backslashes become `\\`, control chars become `\NNN`.

Our `ADBClient.shell()` deliberately uses the non-PTY path because we want clean bytes (no CR/LF translation, no terminal-control noise). The trade-off is that filenames arrive escaped. Reproduced cleanly:

```bash
$ adb -s <serial> shell ls -la /sdcard/DCIM/         # PTY default
drwxrwx--- ... AR Emoji camera                       # clean

$ adb -s <serial> exec-out ls -la /sdcard/DCIM/      # non-PTY (matches our path)
drwxrwx--- ... AR\ Emoji\ camera                     # escaped
```

## Solution

Unescape inside `LSParser.parseLine` after column reassembly. A two-rule walk handles every form we've encountered:

```swift
private static func unescape(_ s: String) -> String {
    var out = ""
    out.reserveCapacity(s.count)
    var iter = s.makeIterator()
    while let c = iter.next() {
        if c == "\\", let next = iter.next() {
            out.append(next)            // `\ ` → space, `\\` → `\`, etc.
        } else {
            out.append(c)
        }
    }
    return out
}
```

Rejected: switching the protocol path to `shell,pty:` to avoid the escaping in the first place. PTY mode introduces CR/LF normalization and terminal-control noise that creates new parsing complications; a single 12-line unescape is the cleaner answer.

The unescape runs *after* the existing symlink-target stripping (`" -> target"` removal) so the arrow itself isn't perturbed.

## Key Files

- `Core/Models/AndroidFile.swift` — added `unescape` helper, called from `parseLine` on the assembled name.

Net diff: +22 / −1 in one file.

## Lessons Learned

- **Cache invalidation, not parsing, was the slowest part of verifying the fix.** macOS File Provider aggressively caches enumerated items per container — the new parser ran on every fresh enumeration but Finder kept showing the cached escaped names. Workaround for dev: temporarily put `await domainController.removeAll()` back in `bootstrap()` to force the system to re-enumerate. Worth considering a debug-only toggle (env var or modifier key on launch) for future fixes that change parser output rather than rebuilding the workaround each time.
- **Non-PTY `ls` formatting is a stable convention.** It mirrors coreutils' `ls -b` exactly, so the escape language is well-defined: `\ `, `\\`, and `\NNN` octal sequences for control bytes. Our simple "drop the backslash, keep the next char" rule degrades sensibly for `\NNN` (you'd see a literal digit run instead of the original byte) but those cases are vanishingly rare in real Android filenames. Worth upgrading only if a user ever hits one.
- **Symptom narrowing was fast** because of the previous track-devices ADR's "diagnose with split symptoms" lesson: status said "connected", devices were present, only one specific column (the name) was visibly wrong. That immediately points at the parser path rather than the connection layer.
