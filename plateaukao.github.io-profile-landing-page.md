# plateaukao.github.io — Profile landing page

## Summary

Replaced the placeholder `index.html` (`hello world`) on `plateaukao.github.io`
with a clean personal landing page. The page leads with the **Blog** as the
primary content and lists selected GitHub Pages projects as secondary links.
Committed as `26384e0` and pushed to `master` (the GitHub Pages source branch),
so it deploys automatically.

## Approach

- **Discovery via the Pages API.** Scanned all 78 non-fork repos under
  `plateaukao` and queried `GET /repos/{owner}/{repo}/pages` for each to find
  which ones actually have a built `plateaukao.github.io/*` site (most served
  from a `/docs` folder, a few from `gh-pages` or root). This is more reliable
  than guessing from repo names or the `homepageUrl` field.
- **Single self-contained file.** The repo serves from `master /` with no
  Jekyll config, so a static `index.html` with inline CSS deploys with no build
  step and renders instantly.
- **Design iterations driven by feedback.** Started from an elaborate "E-Ink
  device" concept (screen-refresh flash, dither grain, bezel), then pulled all
  the way back per feedback to a plain, lightweight profile: small name (no
  oversized nameplate), no animations, generous whitespace, Hanken Grotesk.
  Final structure makes the Blog a large featured block and demotes everything
  else into a compact, muted "Also" list grouped as *Apps* / *Fun*.
- **Curation.** Dropped entries the owner judged not worth surfacing:
  `Tech Notes` (empty) and the `ADR Calendar` link. Final set: EinkBro,
  WhisperASR, pwidgets (Apps); Typing Game, 2048, Tamagochi (Fun); Blog
  featured; GitHub/Blog/Medium in the footer.

## Trade-offs

- **Pushed straight to `master` instead of a branch/PR.** For a personal
  GitHub Pages site, `master` *is* the deploy target and the user explicitly
  asked to push; a feature branch would not have deployed. Accepted the
  guardrail exception because the deploy intent was explicit and durable.
- **Hand-curated project list, not generated.** The links are hard-coded in
  HTML rather than pulled dynamically, so adding/removing a project later means
  a manual edit. Acceptable given the static-file constraint and the small,
  rarely-changing set.
- **Descriptions written from fetched site content**, not repo metadata, so
  they read for humans (e.g., calling `ADR` an "ADR Calendar") rather than
  echoing terse GitHub descriptions.

## Key Files

- `index.html` — the entire page (markup + inline CSS); replaced the previous
  one-line placeholder.
