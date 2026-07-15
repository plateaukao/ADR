<!-- added: 2026-05-09T13:13:51Z -->
# Plan — Digitize handwritten 心經 to SVG and ship as a CalliPlus charbook

## Context

The user previously digitized 歐陽詢's 間架九十二法 by photographing a printed copybook (white characters on black grid cells), running `~/src/ouyang/segment_calligraphy.py` to crop each cell into a transparent-background PNG, then `~/src/ouyang/png_to_svg.py` (potrace) to vectorize, then loading the SVGs through Glide's SVG decoder (see ADR `~/src/ADR/calliplus-ouyang-92-rules-svg.md`). The result is `app/src/main/assets/92_ou_svg/` + `92_ou.txt`, registered in `ResourceUtils.getBooks()`.

Now the user wants to repeat that pipeline for their own handwritten 心經 (Heart Sutra) at `/Users/maoyuankao/Downloads/S__26026001.jpg` (1774×2364). This image differs from the ouyang source in two ways:
1. **Inverted contrast** — black ink on a white printed grid, not white characters on black cells. The existing `cell_to_rgba` (which treats brightness as opacity) inverts the meaning.
2. **Mixed cell content** — many cells contain Chinese punctuation (`，` `；` `。` `！`) rather than full characters. We want one SVG per *character*, skipping punctuation cells.

The output: a new offline charbook `心經 (手寫)` displayed alongside the existing `心經 (綜合)` (which uses remote cns11643 PNGs).

## Approach

### Stage 1 — Workspace at `~/src/xinjing/`

Mirror the ouyang layout. New files are kept outside the Android repo until they are ready to ship (matches how `~/src/ouyang/` is organized).

```
~/src/xinjing/
  S__26026001.jpg         # original (copied/symlinked)
  segment_xinjing.py      # adapted from ouyang/segment_calligraphy.py
  png_to_svg.py           # copied from ouyang (no change needed)
  segmented/              # PNGs per cell
  segmented_svg/          # SVGs per cell
```

### Stage 2 — Adapt the segmenter (`segment_xinjing.py`)

Key changes from `~/src/ouyang/segment_calligraphy.py`:

1. **Grid detection for printed-grid-on-white-paper.** The ouyang script located the dark-filled grid by thresholding for dark pixels and finding large blob contours. Here the grid is *thin black lines on white*; the "cells" are white. New detection:
   - Threshold to dark pixels (`< 100`).
   - Use long horizontal/vertical structuring kernels (e.g. `cv2.getStructuringElement(MORPH_RECT, (image_w//3, 1))`) with a morphological open to extract horizontal lines, and the transpose for vertical lines.
   - Sum across the orthogonal axis → 1‑D projection peaks give row/column line positions. Edges between consecutive peaks are cell boundaries.
   - Sanity check: expect about 17 cols × about 17 rows (roughly square cells); fall back to user `--rows`/`--cols` overrides.

2. **Cell rendering for black-on-white.** Replace `cell_to_rgba`'s brightness → alpha mapping. New mapping: `alpha = 255 - clip((cell_gray - lo) * 255 / (hi - lo))` so dark ink → opaque, white paper → transparent. Keep `trim_alpha` unchanged.

3. **Punctuation cell skipping.** After `trim_alpha`, measure the bounding box area of opaque pixels. If alpha-pixel count < about 3 % of cell area (punctuation marks `，` `。` `；` `！` are tiny strokes in a corner), skip writing the PNG.

4. **Reading-order character mapping.** Take a single `--text` argument with the full 心經 (characters + punctuation, no whitespace). The script walks cells in reading order — column right-to-left, top-to-bottom within each column — and matches each non-empty cell against the next non-punctuation char in `--text`, advancing past punctuation chars `，；。！？` in `--text` as it encounters punctuation cells. Output filename: `{seq:03d}_{char}.png` (e.g. `001_般.png`, `002_若.png`).

5. **Sanity report.** Print mapped count vs. expected count (260 body chars + 8 title chars = 268). Bail out if they disagree by more than 2 — the user can re-run with `--rows`/`--cols` overrides or correct `--text`.

The 心經 reference text (preserve traditional punctuation):

```
般若波羅蜜多心經觀自在菩薩，行深般若波羅蜜多時，照見五蘊皆空，度一切苦厄。舍利子！色不異空，空不異色；色即是空，空即是色。受想行識，亦復如是。舍利子！是諸法空相，不生不滅，不垢不淨，不增不減。是故空中無色，無受想行識；無眼耳鼻舌身意；無色聲香味觸法；無眼界，乃至無意識界；無無明，亦無無明盡；乃至無老死，亦無老死盡；無苦集滅道；無智亦無得。以無所得故，菩提薩埵，依般若波羅蜜多故，心無罣礙；無罣礙故，無有恐怖，遠離顛倒夢想，究竟涅槃。三世諸佛，依般若波羅蜜多故，得阿耨多羅三藐三菩提。故知般若波羅蜜多，是大神咒，是大明咒，是無上咒，是無等等咒，能除一切苦，真實不虛，故說般若波羅蜜多咒。即說咒曰：揭諦揭諦，波羅揭諦，波羅僧揭諦，菩提薩婆訶。
```

Note: the user's image may use variant glyphs (e.g. 蓋/盖, 罣/掛, 涅槃 vs. 涅盤, 揭諦 vs. 揭帝). After segmentation we visually spot-check the first/last few outputs and adjust `--text` if a variant is used.

### Stage 3 — Vectorize

Reuse `~/src/ouyang/png_to_svg.py` unchanged (it's just `potrace -s --tight` on a PBM derived from the alpha channel). Copy it into `~/src/xinjing/` for self-containment.

### Stage 4 — Wire into the Android app

1. **Copy assets:** all SVGs into `app/src/main/assets/xinjing_hand_svg/` (mirrors the `92_ou_svg/` layout).
2. **Create `app/src/main/assets/xinjing_hand.txt`** in the same format as `92_ou.txt` but with `#type:none` (no `#rule:` sections — 心經 is a flat list, not a rule book):
   ```
   #type:none
   #author:手寫
   #bookname:心經
   般;null;file:///android_asset/xinjing_hand_svg/001_般.svg;file:///android_asset/xinjing_hand_svg/001_般.svg;手寫
   若;null;file:///android_asset/xinjing_hand_svg/002_若.svg;file:///android_asset/xinjing_hand_svg/002_若.svg;手寫
   ...
   ```
   The 5-field `;`-separated layout matches `CharData`'s constructor (used by both `kai_xinjing.txt` and `92_ou.txt`).

3. **Register in `ResourceUtils.getBooks()`** (`app/src/main/java/info/plateaukao/calliplus/utils/ResourceUtils.java:155`). Add an entry next to the existing `心經 (綜合)`:
   ```java
   {"心經 (手寫)","xinjing_hand.txt", BOOKTYPE_NONE},
   ```
   `BOOKTYPE_NONE` (not `BOOKTYPE_RULE`) so it's rendered as a flat character list — same UI path as `kai_xinjing.txt`.

4. **No new ProGuard / Glide work.** The SVG decoder + AndroidSVG keep rules from the ouyang change already cover any `file:///android_asset/.../*.svg`.

### Stage 5 — Save this plan to ADR

Write **this entire plan, verbatim** to `~/src/ADR/calliplus-xinjing-handwritten-svg.md` (do NOT translate it into the Problem/Root Cause/Solution/Key Files/Lessons Learned format used by post-commit ADRs — this is a forward-looking plan, kept as-is). This is done first, before any code changes, so the plan is checked in before the work begins.

## Files to create / modify

| File | Action |
|---|---|
| `~/src/xinjing/segment_xinjing.py` | new (adapted from ouyang script) |
| `~/src/xinjing/png_to_svg.py` | new (copy of ouyang script) |
| `~/src/xinjing/segmented/` + `~/src/xinjing/segmented_svg/` | generated |
| `app/src/main/assets/xinjing_hand_svg/*.svg` | copied from `~/src/xinjing/segmented_svg/` |
| `app/src/main/assets/xinjing_hand.txt` | new |
| `app/src/main/java/info/plateaukao/calliplus/utils/ResourceUtils.java` | one-line addition in `getBooks()` |
| `~/src/ADR/calliplus-xinjing-handwritten-svg.md` | new (post-commit) |

## Reused infrastructure (no changes)

- `~/src/ouyang/png_to_svg.py` — vectorization pipeline (potrace `-s --tight`).
- `app/src/main/java/info/plateaukao/calliplus/glide/SvgModule.java` — registers AndroidSVG as a `ResourceDecoder<InputStream, Bitmap>` with `setDocumentWidth/Height("100%")`. Already loaded by Glide for any SVG byte stream.
- `app/proguard-project.txt` — already has `-keep class com.caverock.androidsvg.**` and the package‑wide keep for `info.plateaukao.calliplus.**`.
- `FileCharBookImpl` / `CharData` — handle `;`-separated rows with `file:///android_asset/...` URLs already.

## Verification

1. **Segmenter dry-run:** run `segment_xinjing.py` on the photo; confirm it reports the expected 268 character cells and writes that many PNGs into `~/src/xinjing/segmented/`. Visually spot-check the first 4 (`001_般` … `004_羅`) and last 4 (last few of mantra) by opening the PNGs.
2. **Vectorize:** run `png_to_svg.py`; confirm 268 SVGs in `~/src/xinjing/segmented_svg/`.
3. **Build:** `./gradlew assembleDebug`. Confirm no R8 / asset packaging errors.
4. **On-device:** `./gradlew installDebug`, launch app, open `心經 (手寫)` from the book list. Verify:
   - Character grid renders (Glide decodes `file:///android_asset/xinjing_hand_svg/*.svg`).
   - Reading order matches the sutra (top-right → bottom-left as expected for a flat character list).
   - Tapping a character opens the detail/pager view with the SVG rendered cleanly (no top-left-corner shrinkage — `setDocumentWidth("100%")` already handles that).
5. **Re-grid if needed:** if any character SVG is misaligned with its label, re-run the segmenter with corrected `--rows`/`--cols` or with a corrected `--text` (variant glyph).
