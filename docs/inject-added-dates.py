#!/usr/bin/env python3
"""Inject `<!-- added: YYYY-MM-DDTHH:MM:SSZ -->` into the top of each top-level
ADR markdown file, using the local filesystem birthtime as the source of truth.

Run this once (on macOS, where birthtime is preserved). After that, the dates
travel with the files and the build works on Linux runners (GitHub Actions),
which would otherwise see all files as "added today" after `git clone`.

Idempotent: skips files that already have an `<!-- added: ... -->` line in
their first 10 lines.
"""

from __future__ import annotations

import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKIP = {"CLAUDE.md", "README.md"}
TAG_RE = re.compile(r"<!--\s*added:\s*[0-9TZ:+-]+\s*-->")


def birthtime_iso(p: Path) -> str | None:
    """Return ISO-8601 UTC birthtime, or None if unavailable."""
    try:
        st = os.stat(p)
        # macOS: st_birthtime present
        bt = getattr(st, "st_birthtime", None)
        if bt is None or bt <= 0:
            return None
        return datetime.fromtimestamp(bt, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    except OSError:
        return None


def inject(p: Path) -> str:
    text = p.read_text()
    head = "\n".join(text.splitlines()[:10])
    if TAG_RE.search(head):
        return "skip (already tagged)"

    iso = birthtime_iso(p)
    if not iso:
        return "skip (no birthtime)"

    new = f"<!-- added: {iso} -->\n{text}"
    p.write_text(new)
    return f"injected {iso}"


def main() -> int:
    mds = sorted(p for p in ROOT.glob("*.md") if p.name not in SKIP)
    for p in mds:
        result = inject(p)
        print(f"{p.name}: {result}")
    print(f"\n{len(mds)} files processed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
