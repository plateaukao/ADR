2026-08-02

# EinkBro: About-screen update progress shown in place of the item label

## What was broken

Tapping "Update to Latest" or "Update with Snapshot" in the About settings
screen showed the download percentage as a second text line under the item's
title, with extra padding added while running. That grew the setting item,
reflowed the About grid — and despite all that movement the percentage was
still effectively invisible to the user. On an e-ink display the reflow is
doubly noticeable.

## The fix

Commit `a0ed543ab`. `ProgressActionSettingItemUi` no longer appends a
progress line or changes padding. Instead the title `Text` itself swaps to
the percentage while the download runs ("Update with Snapshot" → "20%" →
"85%" → back to the label on completion). The item's bounds never change:
verified on the emulator with a real snapshot download — same 505x210 cell
before, during (label "20%", item disabled), and after, with the neighboring
item unmoved and the label restored once the installer prompt appeared.

The general rule this encodes for the settings grid: transient state belongs
inside an item's existing footprint; items must not resize based on runtime
state, because the grid reflow costs more attention than the state is worth.
