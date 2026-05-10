# ADR Calendar Site

Static site that renders the ADR markdown files in this repo as a calendar (month / week / day / list views), with a markdown viewer that supports Mermaid diagrams and syntax-highlighted code.

## Local preview

```sh
./docs/build.sh                        # regenerate adrs/ + manifest.json
python3 -m http.server -d docs 8000    # serve at http://localhost:8000
```

## GitHub Pages

In the repo settings, set Pages to **Deploy from a branch**, branch `main`, folder `/docs`. The site is fully static — no build step on GitHub's side.

Re-run `./docs/build.sh` whenever you add or change a top-level ADR markdown file, then commit `docs/`.

## Layout

- `index.html` — shell + CDN imports (marked, highlight.js, mermaid)
- `style.css` — calendar grid, pills, viewer, markdown styles (light + dark)
- `app.js` — load manifest, render views, render markdown + mermaid in viewer
- `manifest.json` — generated index of every ADR (slug, date, title, project, summary)
- `adrs/*.md` — generated copies of the top-level ADR files
- `build.sh` — regenerator
