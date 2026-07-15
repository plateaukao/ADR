2026-07-10

# NerLan iOS: transcript line spacing scales with the font size

The transcript view has a three-step font-scale control (17 / 21 / 26 pt), but the spacing around the text was fixed: wrapped lines used SwiftUI's default line spacing and the gap between a line's original text and its translation was a hard-coded 4 pt. At the larger font steps this made the transcript feel cramped — big type with tight leading reads worse, not better, which defeats the point of enlarging it.

The fix derives one spacing value from the current font size:

```swift
private var bodyLineSpacing: CGFloat { bodyFontSize * 0.3 }
```

and applies it in both places that were previously fixed:

- `.lineSpacing(bodyLineSpacing)` on the original-text `Text` and on the translation `Text`, so wrapped lines within a sentence get proportional leading;
- the `VStack` spacing between the original and its translation, replacing the fixed 4 pt.

At the default 17 pt the spacing is about 5 pt — close to what it was — so the small setting looks essentially unchanged; the benefit shows up at 21 and 26 pt where the leading now grows with the type. 30% of the em size is a conventional comfortable-reading leading ratio.

Shipped in v1.6 (build 7).
