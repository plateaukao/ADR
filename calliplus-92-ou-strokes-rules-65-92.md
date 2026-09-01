2026-09-02

# CalliPlus: stroke-order data for 歐陽詢 rules 65–92 (recording pass complete)

Final Boox batch: 72 characters over two days (rules 65–75 on 09-01, then
79–81, 85, 90–92), exported into `assets/92_ou_strokes`. 346 of 368
characters of 間架九十二法 (歐陽詢) now play both stroke and hand animations;
every take passed the 100 % coverage check.

What deliberately has no data:

- Rules 27/28 (器×4, 齡×4): the first character is recorded; the three
  repeats reuse the same glyph shape.
- Rules 86–89 (登×4, 蔡蔡察察, 衆×4, 象×4): no takes at all yet — these rows
  repeat one or two glyphs; recording 86_1, 87_1, 87_3, 88_1, 89_1 would give
  those rules animation too, if wanted.

The recording sessions doubled as QA for the book itself: they surfaced the
shuffled-glyph blocks, twelve wrong labels, and the duplicate-collapsing
parser bug (see the shuffled-glyphs ADR), all fixed and shipped in 4.11.1.
