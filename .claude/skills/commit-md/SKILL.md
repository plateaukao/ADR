---
name: commit-md
description: Stage every newly added (and modified) Markdown ADR file in this repo, commit them on the current branch with a concise message, and push to origin. Use when the user wants to commit and push new .md files in the ADR repo.
---

# commit-md

Commits all new/changed Markdown files in the ADR repo and pushes. This repo's
workflow is to commit ADRs directly to `main` and push — do **not** create a
side branch.

## Steps

1. **Find candidates.** Run `git status --short`. Collect every `.md` file that
   is untracked (`??`) or modified (` M` / `M `). Ignore non-`.md` files
   entirely — never stage them.

2. **Nothing to do?** If there are no new or modified `.md` files, tell the user
   and stop. Do not create an empty commit.

3. **Stage only the Markdown files.** Stage exactly the files found in step 1,
   by explicit path (e.g. `git add -- "file-one.md" "file-two.md"`). Do not use
   `git add -A` or `git add .`.

4. **Write the commit message.** Match the terse style of this repo's history
   (`add more md`, `add 3 more md`):
   - All additions, 1–3 files → `add <basename>, <basename>` (drop the `.md`).
   - All additions, 4+ files → `add <N> md`.
   - Includes edits to existing files → `update <basename>` or
     `add/update <N> md` as fits.

   End the commit message with the repo's required footer line:

   ```
   Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
   ```

5. **Commit** on the current branch (normally `main`).

6. **Push.** `git push` to `origin` on the current branch. If the push is
   rejected because the remote moved, `git pull --rebase` then push again.

7. **Report.** Show the commit subject, the files committed, and confirm the
   push succeeded.

## Do not

- Do **not** write a post-commit ADR summary file. This commit only adds/updates
  ADR Markdown — the standing exception applies (no summary ADR for ADR-only
  commits).
- Do **not** stage or commit anything that is not a `.md` file.
- Do **not** open a pull request or branch off `main`.
