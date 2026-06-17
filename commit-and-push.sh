#!/usr/bin/env bash
#
# commit-and-push.sh — publish new/changed ADRs from the ADR repo.
#
# Intended to be called from ANY project (e.g. by a Claude session in another
# repo right after it drops a `{project}-{desc}.md` summary into ~/src/ADR/).
#
# It is deliberately narrow in scope: it stages ONLY new or modified top-level
# `*.md` ADR files in this repo, commits them, and pushes. Pushing to `main`
# triggers .github/workflows/pages.yml, which runs build.sh in CI and redeploys
# the site — so the ADR website updates automatically. Nothing else in the
# project is touched: no docs/ edits, no local build.sh run, and the
# CI-generated build artifacts (docs/adrs/, docs/manifest.json) are never
# staged. This keeps other sessions from accidentally clobbering the project.
#
# Usage:  ~/src/ADR/commit-and-push.sh
# Exit:   0 on success or when there is nothing to do; non-zero on git failure.

set -euo pipefail

# The repo is wherever this script lives (it sits at the repo root).
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO"

# Collect top-level *.md that are untracked or modified, excluding the repo's
# own meta files. `grep -v '/'` drops anything in a subdirectory (notably the
# CI-built docs/adrs/ copies). bash 3.2-safe (no mapfile).
files=()
while IFS= read -r f; do
  [ -n "$f" ] && files+=("$f")
done < <(
  git status --porcelain --untracked-files=all -- '*.md' \
    | cut -c4- \
    | grep -v '/' \
    | grep -vx 'CLAUDE.md' \
    | grep -vx 'README.md' \
    || true
)

if [ "${#files[@]}" -eq 0 ]; then
  echo "commit-and-push.sh: no new or changed top-level ADR .md files — nothing to do."
  exit 0
fi

echo "commit-and-push.sh: staging ${#files[@]} ADR file(s):"
printf '  %s\n' "${files[@]}"
git add -- "${files[@]}"

# Terse commit message in this repo's style.
if [ "${#files[@]}" -le 3 ]; then
  joined=""
  for f in "${files[@]}"; do
    base="${f%.md}"
    joined="${joined}${base}, "
  done
  msg="add ${joined%, }"
else
  msg="add ${#files[@]} md"
fi

git commit -m "$msg" -m "Co-Authored-By: Claude <noreply@anthropic.com>"

# Push; if the remote moved on, rebase once and retry.
if ! git push; then
  echo "commit-and-push.sh: push rejected — rebasing on origin and retrying."
  git pull --rebase
  git push
fi

echo "commit-and-push.sh: done."
