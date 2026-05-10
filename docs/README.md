# ADR Calendar Site

Static site that renders the ADR markdown files in this repo as a calendar (month / week / day / list views), with a markdown viewer that supports Mermaid diagrams and syntax-highlighted code.

## Deployment

GitHub Actions builds and deploys this site automatically on every push to `main` (`.github/workflows/pages.yml`). To enable:

1. Repo Settings → Pages → **Source: GitHub Actions** (one-time setting).
2. Push to `main`. The workflow runs `docs/build.sh`, then publishes `docs/` as the Pages artifact.

You no longer need to run `build.sh` locally for deployment. Run it locally only for previewing.

## Local preview

```sh
./docs/build.sh                        # regenerate adrs/ + manifest.json
python3 -m http.server -d docs 8000    # serve at http://localhost:8000
```

## Adding a new ADR

1. Drop the `.md` at the repo root, named `{project}-{slug}.md`.
2. Optionally prepend `<!-- added: 2026-04-07 -->` (or full ISO datetime). If you skip this, GitHub Actions will fall back to the git-add date.
3. Commit and push — the workflow rebuilds the site.

`docs/inject-added-dates.py` is a one-shot utility that stamped the local-add timestamp (from macOS `stat -f %B` birthtime) into every existing ADR. Birthtime is lost on `git clone`, so the inline `<!-- added: ... -->` line is the durable source of truth — without it, CI would only see git commit dates.

## Layout

- `index.html` — shell + CDN imports (marked, highlight.js, mermaid)
- `style.css` — calendar grid, pills, viewer, markdown styles (light + dark)
- `app.js` — load manifest, render views, render markdown + mermaid in viewer
- `manifest.json` — generated index of every ADR (slug, date, title, project, summary)
- `adrs/*.md` — generated copies of the top-level ADR files
- `build.sh` — regenerator (also bumps the cache-buster query in `index.html`)
- `inject-added-dates.py` — one-shot tool, kept in repo for reference
