# Notable: Toolbar Padding and Rounded Corners

## Problem
The toolbar was too thin with icons touching the toolbar borders. All square UI elements had sharp rectangular corners, making the UI look dated.

## Root Cause
- Toolbar Column height was only `BUTTON_SIZE + 2` dp with no padding on the Row
- UI elements used `RectangleShape` or no shape parameter (defaulting to rectangle) for borders and backgrounds

## Solution
1. **Toolbar height & padding**: Increased Column height to `BUTTON_SIZE + 6` dp, added 2dp vertical/horizontal padding to the Row, added `Arrangement.spacedBy(2.dp)` for horizontal icon spacing, and centered icons vertically.
2. **Consistent rounded corners**: Applied `RoundedCornerShape(4.dp)` across all square UI elements with `.clip()` where content could overflow.

## Key Files
- `editor/ui/toolbar/Toolbar.kt` — toolbar height and Row padding/arrangement
- `editor/ui/toolbar/ToolbarButton.kt` — selected state shape
- `editor/ui/toolbar/ToolbarMenu.kt` — menu popup corners
- `editor/ui/toolbar/EraserToolbarButton.kt` — eraser popup corners
- `editor/ui/toolbar/StrokeMenu.kt` — stroke/color picker corners
- `ui/components/NotebookCard.kt` — notebook card corners
- `ui/components/PageCard.kt` — page card corners
- `ui/components/ShowPagesRow.kt` — quick pages row corners
- `ui/components/Switch.kt` — toggle switch corners
- `ui/theme/Shape.kt` — theme large shape from 0dp to 4dp

## Lessons Learned
- When applying rounded corners, both `.border(shape)` and `.clip(shape)` (or `.background(color, shape)`) are needed — border draws the outline in that shape, but clip/background-shape prevents content from overflowing the corners.
- The `-Pandroid.injected.signing.*` Gradle flags are the way to sign release builds locally when env vars aren't set.
