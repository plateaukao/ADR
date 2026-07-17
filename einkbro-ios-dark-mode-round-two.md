2026-07-18

# EinkBro iOS: the real input-dialog bug, dark headers, dialog borders

Committed as `522d2b9`. Three fixes, two of them corrections to the same
day's earlier work.

## The input-dialog dismissal had a different root cause

Disabling outside-click dismissal (`d83fa31`) didn't fix the device: the
dialog still vanished when its field was focused. The simulator pass had
been misleading — the hardware-keyboard setting meant no software keyboard,
and the keyboard is the trigger. The actual chain: `ValueSettingItemUi`
launches `dialogManager.getTextInput` from its own `rememberCoroutineScope`;
when the keyboard resizes the viewport, the lazy settings grid recycles that
row out of composition; the scope cancels, cancelling `getTextInput`, whose
`invokeOnCancellation` clears the pending dialog request. Fix: launch from a
`MainScope` that survives row recycling. Lesson recorded: a dialog driven by
a suspend call must not be owned by the scope of a lazy-list item.

## Two corrections to the dark-palette change

Flipping dark `primary` to gray fixed sliders but broke the settings
headers: m2 top bars sit on the dark *surface* (black) while the ported
screens color header text with `onPrimary`, which the same commit had turned
black. Dark `onPrimary` is gray again — safe because the only two filled
buttons override their colors explicitly.

And the no-dim `NoDimAlertDialog` had silently lost its edge: the popup
AlertDialog it replaced separated itself from the page with an elevation
shadow. The flat replacement now draws an explicit 1dp `onBackground`
border — gray in dark, black in light, consistent with every other e-ink
dialog frame.

One dark-mode screenshot verified all three: focused input dialog staying
open, readable "Misc" header, bordered dialog card.
