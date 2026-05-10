# blog: Prune comment-style posts and tag remaining posts by Medium publication

## Problem

The initial Medium-export conversion produced 262 markdown files. Two issues surfaced after browsing the converted set:

1. **Comment posts polluting the archive.** Medium treats user "responses" (replies on other authors' articles, comment threads under one's own posts) as posts in the export. ~70 of the 262 entries were one-line replies like "Hi, Pin", "我來試試看", "謝謝回報" — not blog content the user wanted to publish on his own site.
2. **No way to browse by topic.** The user owns six Medium publications (EinkBro, 韓語學習筆記, 邊跑邊拍, 衝浪滑板二三事, 電子書閱讀器使用心得及技巧分享, conference_summary) but Medium's export does not preserve which publication a post belonged to — every canonical URL points at `@danielkao` regardless. Visitors couldn't filter by topic.

## Root cause

(1) is a Medium export quirk — there is no `type=response` flag in the HTML; you have to detect them heuristically. (2) is the same export quirk noted in the previous ADR: publication info is simply not in the HTML payload.

## Solution

**Detection of comment posts** — score each markdown by:
- body length (< 300 chars heavily weighted)
- absence of images / headings / code blocks
- reply-style title patterns (starts with "Hi,", "Hello,", "Thanks", or ends with `?` / `嗎` / `呢`)
- short body + no structure combined

Score ≥ 7 caught 73 of 73 actual replies plus 1 false positive (a real but very short technical note). Score ≥ 8 (the safer floor) was tighter but missed 4 obvious replies. Solution: present the bucketed list to the user, recommend deletes by bucket, accept their confirmation, and exclude any titles they want to keep by exact-match.

**Publication tagging** — keyword classifier with priority ordering:
- EinkBro wins first (any title/desc match for "einkbro" or the original Chinese series name "E-ink 專用的瀏覽器")
- Korean second (TTMIK, トリリンガル, 韓國語/韓文/韓國新聞 with study/news/dict context, RIDIBooks, drama titles)
- Surfskate third (衝浪滑板, YOW PIPE)
- E-reader fourth (Kindle/BOOX/文石/掌閱/漢王/Matepad/Hisense A-series/Sony DPT/Calibre/EPUB/electronic-paper terms)
- Outdoors fifth (running keywords, hiking step/trail markers, named mountains, skiing trips, location-bracketed route titles)
- Conference summaries last (DEVIEW, "conference summary")

Tag value = the publication's actual Chinese name, written into TOML frontmatter as `tags = ["..."]`. Hugo + PaperMod then auto-generate `/tags/<slug>/` archive pages and a `/tags/` index. Added a "Tags" entry to the main menu (weight 15, between Archive and Search).

## Key files

- `~/src/blog/content/posts/*.md` — 70 deleted, 131 modified to add `tags = […]`, 61 left untagged (general Android/Flutter dev posts and yearly retrospectives that don't fit any single publication)
- `~/src/blog/hugo.toml` — added `[[menu.main]]` entry for `/tags/`

## Lessons learned

- **Medium "responses" hide as posts in the export.** The export format makes no distinction between an article you wrote and a reply you typed under someone else's article. Detect by heuristic — body length, structural absence (no images / headings / code), and reply-style titles. Don't rely on canonical URL or filename, both of which look identical to a normal post.
- **Confirm before bulk deletion.** With 73 candidates, score-based auto-delete was tempting but would have taken out one real short post ("在 MacOS 上跑 llama.cpp server …", 84 chars) and one real short note ("Mindmap of Clean Architecture", which had an attached image). Showing the bucketed list and accepting an exception list ("delete all except these two") cost one extra round-trip and saved actual content.
- **Heuristic publication classifier is good enough for ~200 posts.** A keyword-priority classifier with ~6 categories tagged 131/192 posts correctly with no manual intervention. The remaining 61 untagged are genuinely cross-cutting (general Flutter/Android tutorials) — forcing a tag on them would create a junk drawer rather than a useful filter. Leaving them untagged is the right call. Resist the urge to add a "misc" or "other" tag.
- **Hugo lower-cases tag URL slugs but preserves the display name.** `tags = ["EinkBro"]` → URL `/tags/einkbro/`, but the page title and tag chip still render "EinkBro". Both behaviors are correct; don't try to "fix" by lowercasing the source tag.
