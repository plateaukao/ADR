2026-08-30

# CalliPlus: stroke-order data for 歐陽詢 rules 46–48 and 50–52

Adds the exported stroke animations for 21 more characters of 間架九十二法
(歐陽詢), recorded on the Boox Tab Ultra C with the rebuilt stroke recorder
(the first batch traced on that device rather than the Supernote). 213 of the
368 characters now have data: rules 1–9, 13–52 (except 51_1 鳳, which was not
recorded), plus 76–78 and 82–84.

The recordings for rules 46–48 are fresh takes: the earlier traces under those
names were made over the wrong glyphs (see the ADR on the shuffled 92_ou glyphs)
and now live under rules 82–84, where they belong. Rules 10–12, whose old traces
moved to 76–78 for the same reason, are still to be re-recorded.

Two previously exported files (49_1 衝, 49_2 衢) changed slightly on re-export;
the pipeline regenerates every character from its recording on each run, so
small numeric drift in the medial-axis fit is expected and harmless.

Pipeline unchanged: pull → `preview_all.py` check (100 % coverage, trace view) →
`export_app_data.py` → commit `assets/92_ou_strokes`.
