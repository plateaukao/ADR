2026-08-31

# CalliPlus: stroke-order data for 歐陽詢 rules 10–12 and 51–64

Second Boox recording batch of the day: 61 more characters exported into
`assets/92_ou_strokes`, bringing the book to 274 of 368. It includes the
re-recorded rules 10–12 (灰若有右 / 来東本米 / 渠樂架藥 — their earlier traces
belonged to rules 76–78 before the glyph-shuffle fix), the previously skipped
51_1 鳳, and rules 53–64 straight through, including the four-of-a-kind rows
that the parser fix now displays in full (57 者×4, 58 是是足足).

All takes at 100 % coverage in the preview check. Remaining to record:
rules 65–75, 79–81, 85, 90–92; rules 27/28 keep a single character by design.

Pipeline unchanged: pull → `preview_all.py` → `export_app_data.py` → commit.
