2026-09-23

# Preserve vertical styles in the document cache

Reopening a vertical EPUB always triggered a full render instead of restoring the persistent document cache. The style hash included the fork's writing-mode properties, but `css_style_rec_t` did not serialize those properties. After deserialization, the restored style differed from the stored hash and CRengine rejected the cached formatting.

The style cache now serializes and deserializes `writing_mode`, `text_orientation`, `text_combine_upright`, and `text_emphasis_style` alongside the existing CSS enum fields. The cache format version advances from `vwm3` to `vwm4`, deliberately invalidating older incomplete records once. New cache files retain the vertical style state and can be reused on later opens.
