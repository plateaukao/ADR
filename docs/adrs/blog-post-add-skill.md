# blog — /post-add skill

## Summary

Adds a project-level Claude Code skill, `/post-add`, that publishes a local
(Obsidian-style) Markdown file as a new post in the Hugo + PaperMod blog and
commits + pushes it to `origin/main`. It codifies the exact manual workflow
used to add the "Supernote Manta 入手一週感想" post so the multi-step process
(front-matter conversion, image collection/optimization, build verification,
commit) becomes a single repeatable command.

Invocation: `/post-add "<path-to-.md>" [tag ...]`. Tags may also be given in
prose ("add the 電子書閱讀器 tag"); if none are supplied the skill asks before
committing.

Lives at `.claude/skills/post-add/SKILL.md` inside the blog repo (not the
user-global `~/.claude/skills/`), because every step is specific to this
repo's conventions and remote.

## Approach

The skill is a 7-step ordered checklist rather than prose, so each run is
deterministic and verifiable:

1. Read the source `.md`; remember its directory (Obsidian attachments
   usually sit alongside it).
2. Derive metadata: title (first H1 or filename), UTC date via
   `date -u +"%Y-%m-%dT%H:%M:%S.000Z"`, a slug that lowercases ASCII but
   **keeps CJK characters** (matching existing slugs like
   `在-macos-上跑-llamacpp-server-…`), a short description, and tags.
3. Collect every `![[NAME]]` embed; resolve `NAME` from the source dir then
   recursively upward (the vault); copy into `static/images/<slug>/`; rename
   space/unsafe filenames to kebab-case; optimize with `sips` (≤1400px,
   PNG screenshots → JPEG q85, target ~150–350 KB).
4. Write `content/posts/<slug>.md` with the repo's **TOML `+++`** front
   matter, first image as `[cover].image`, body copied verbatim with only the
   `![[…]]` embeds rewritten to `![](/images/<slug>/…)`.
5. Build (`hugo --environment production`) and verify the post built, the
   `og:image` and inline `src`es carry the full `/blog/` path, and the post
   shows on the home and tag listings.
6. Stage only the post + its image dir, commit directly to `main`, push.
7. Explicitly **no ADR** — the blog repo is exempt from the global
   post-commit ADR rule.

Two non-obvious constraints are baked in as explicit instructions because
they were discovered the hard way during the manual runs:

- **Tag de-duplication.** The skill greps existing `tags = ` lines and reuses
  the exact existing spelling/casing instead of minting a near-duplicate
  (the repo already had a tag-normalization commit; this prevents regressing
  it).
- **`/blog/` path dependency.** Correct share-image URLs rely on the
  project-level `layouts/_partials/templates/{opengraph,twitter_cards}.html`
  overrides (upstream PaperMod's `absURL` drops the baseURL subpath). Step 5
  verifies the rendered path rather than assuming it.

`sips` is used for all image work because this machine has no ImageMagick.

## Trade-offs

- **Project-level, not user-global.** The skill ships in the blog repo so it
  is versioned with the conventions it depends on and works on any clone, at
  the cost of not being available outside this repo. This is correct because
  the workflow (front-matter shape, image dir layout, "commit to `main`",
  ADR exemption) is meaningless elsewhere.
- **Commits directly to `main`, no branch/PR.** Matches the established solo
  workflow of this blog (all history is linear on `main`); a feature-branch
  flow would add friction with no reviewer.
- **Front matter is regenerated, not parsed from the source.** Obsidian notes
  carry no usable Hugo front matter, so title/date/slug/description are
  derived. Trade-off: a hand-tuned description in the source is not honored;
  the skill writes a generated summary instead.
- **Inline-image-only assumption.** Handles `![[name]]` embeds; non-embedded
  attachments or external image URLs are passed through untouched.
- **Skill file is untracked by default.** It was created but not committed
  (the "commit/push" instruction describes what the skill does to *posts*,
  not the skill itself); versioning it is left as an explicit follow-up
  decision.

## Key Files

- `~/src/blog/.claude/skills/post-add/SKILL.md` — the skill definition
  (frontmatter `name`/`description` drive matching; body is the 7-step
  workflow).
- `~/src/blog/layouts/_partials/templates/opengraph.html`,
  `twitter_cards.html` — project overrides the skill's step-5 verification
  depends on for correct `/blog/`-prefixed share-image URLs.
- `~/src/blog/content/posts/supernote-manta-入手一週感想.md` — the worked
  example the skill generalizes from.
- `~/.claude/projects/-Users-maoyuankao-src-blog/memory/feedback_no_adr.md` —
  records the blog's exemption from the automatic ADR rule (step 7).
