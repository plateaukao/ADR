#!/usr/bin/env bash
# Build the docs site:
#   1. Copy all top-level *.md ADRs (excluding CLAUDE.md / README.md) into docs/adrs/
#   2. Generate docs/manifest.json with each file's date (first commit add), title,
#      project tag (slug prefix), and a short summary.
#
# Re-run this any time new ADRs are added.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DOCS_DIR="$ROOT_DIR/docs"
ADRS_DIR="$DOCS_DIR/adrs"
MANIFEST="$DOCS_DIR/manifest.json"
INDEX="$DOCS_DIR/index.html"

mkdir -p "$ADRS_DIR"
rm -f "$ADRS_DIR"/*.md "$ADRS_DIR"/*.png "$ADRS_DIR"/*.jpg "$ADRS_DIR"/*.jpeg "$ADRS_DIR"/*.gif "$ADRS_DIR"/*.svg

# Copy image assets so relative ![](...) references in ADRs resolve when the
# site fetches the markdown from ./adrs/.
for ext in png jpg jpeg gif svg; do
  for img in "$ROOT_DIR"/*.$ext; do
    [[ -e "$img" ]] || continue
    cp "$img" "$ADRS_DIR/"
  done
done

# Cache-bust app.js / style.css by stamping a fresh epoch into the version query.
# index.html stores either `__BUST__` (initial state) or a previous epoch — both
# get replaced.
BUST_VAL="$(date +%s)"
python3 - "$INDEX" "$BUST_VAL" <<'PY'
import re, sys, pathlib
path, bust = sys.argv[1], sys.argv[2]
p = pathlib.Path(path)
text = p.read_text()
new = re.sub(r'(\?v=)(?:__BUST__|\d+)', r'\g<1>' + bust, text)
if new != text:
    p.write_text(new)
PY

# Files to skip
SKIP_REGEX='^(CLAUDE|README)\.md$'

# Project prefix list (longest-first so multi-segment prefixes win).
# Anything not matching falls back to the first '-' segment.
PROJECT_PREFIXES=(
  "koreader_plugin_vertical_read"
  "mandroid_finder"
  "webvtt-converter"
  "calliplus_android"
  "calliplus"
  "whisperASR"
  "whisperasr"
  "android_usb"
  "game2048"
  "einkbro"
  "mandroid"
  "notable"
  "blog"
)

detect_project() {
  local name="$1"
  for p in "${PROJECT_PREFIXES[@]}"; do
    if [[ "$name" == "$p"-* ]]; then
      printf '%s' "$p"
      return
    fi
  done
  printf '%s' "${name%%-*}"
}

# Date resolution, in priority order:
#   1. Inline override:  <!-- added: 2026-04-07 -->  (or full ISO datetime)
#   2. Filesystem birthtime (macOS/APFS only — preserved across edits, lost on clone)
#   3. git --diff-filter=A first-add commit date
#   4. File mtime
file_date() {
  local f="$1"
  local path="$ROOT_DIR/$f"
  local d=""

  # 1. Inline override:  <!-- added: 2026-04-07 -->  or  <!-- added: 2026-04-07T14:10:17Z -->
  d=$(awk 'NR<=10 && match($0, /<!--[[:space:]]*added:[[:space:]]*([0-9TZ:+-]+)[[:space:]]*-->/, m) { print m[1]; exit }' "$path" 2>/dev/null || true)
  if [[ -n "$d" ]]; then
    # Normalize bare YYYY-MM-DD to ISO 8601 at noon local
    if [[ "$d" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
      d="${d}T12:00:00Z"
    fi
    printf '%s' "$d"
    return
  fi

  # 2. Filesystem birthtime (BSD/macOS only — `-f '%B'` is BSD `stat`).
  # On Linux/GitHub Actions, birthtime is meaningless after `git clone` anyway,
  # so skipping is correct.
  if [[ "$(uname -s)" == "Darwin" ]]; then
    local birth
    birth=$(stat -f '%B' "$path" 2>/dev/null || true)
    if [[ -n "$birth" && "$birth" != "0" ]]; then
      d=$(date -u -r "$birth" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || true)
      if [[ -n "$d" ]]; then
        printf '%s' "$d"
        return
      fi
    fi
  fi

  # 3. git first-add date
  d=$(git -C "$ROOT_DIR" log --diff-filter=A --follow --format='%aI' -- "$f" | tail -1)
  if [[ -n "$d" ]]; then
    printf '%s' "$d"
    return
  fi

  # 4. mtime fallback
  d=$(date -u -r "$path" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo "")
  printf '%s' "$d"
}

# Read first non-blank '# ' heading; fall back to filename.
file_title() {
  local f="$1"
  local t
  t=$(awk '/^# / { sub(/^# +/, ""); print; exit }' "$ROOT_DIR/$f")
  if [[ -z "$t" ]]; then
    t="${f%.md}"
  fi
  printf '%s' "$t"
}

# Pull the first paragraph under "## Problem" as a summary.
file_summary() {
  local f="$1"
  awk '
    /^## Problem/ { in_p=1; next }
    in_p && /^## / { exit }
    in_p && NF > 0 { print; exit }
  ' "$ROOT_DIR/$f"
}

json_escape() {
  python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))'
}

entries=()
for f in "$ROOT_DIR"/*.md; do
  base="$(basename "$f")"
  [[ "$base" =~ $SKIP_REGEX ]] && continue

  cp "$f" "$ADRS_DIR/$base"

  date="$(file_date "$base")"
  title="$(file_title "$base")"
  project="$(detect_project "$base")"
  summary="$(file_summary "$base")"

  json=$(python3 - "$base" "$date" "$title" "$project" "$summary" <<'PY'
import json, sys
slug, date, title, project, summary = sys.argv[1:6]
print(json.dumps({
    "slug": slug,
    "date": date,
    "title": title,
    "project": project,
    "summary": summary,
}))
PY
  )
  entries+=("$json")
done

# Stitch into a JSON array, sorted by date desc.
python3 - "$MANIFEST" <<PY "${entries[@]}"
import json, sys
out_path = sys.argv[1]
items = [json.loads(a) for a in sys.argv[2:]]
items.sort(key=lambda x: x.get("date") or "", reverse=True)
with open(out_path, "w") as fh:
    json.dump({"generated_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
               "count": len(items),
               "entries": items}, fh, indent=2, ensure_ascii=False)
print(f"Wrote {len(items)} entries to {out_path}")
PY
