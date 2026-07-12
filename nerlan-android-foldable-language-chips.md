2026-07-12

# NerLan Android: Foldable Language Chips with Persisted Filter

Port of the same-day iOS change (see `nerlan-foldable-language-chips.md`) to
the Android app, keeping the two apps' program screens in step.

## What changed

- **Folded by default** — the chip row shows a single horizontally scrollable
  line with a chevron `IconButton` at the trailing edge; tapping it swaps the
  container for the original `FlowRow` wrap layout. Each launch starts folded.
- **Priority ordering** — chips lead with 英語, 日語, 韓語, 法語, then the rest
  in catalog order, with 全部 moved from first to last.
- **Persisted filter** — the selection moved out of screen-local
  `remember { mutableStateOf(...) }` into `SettingsStore` as a
  `programLanguageFilter` StateFlow ("" = 全部) backed by SharedPreferences,
  following the store's existing pattern for remembered view preferences
  (transcript font scale, translate mode, …). A restored language that no
  longer exists in the catalog resets to 全部 so the list can't come back
  permanently empty.

## Notes

- Android needed none of the iOS workaround: Compose's `FlowRow` and a
  conditional `horizontalScroll` Row swap cleanly, whereas SwiftUI's `Layout`
  protocol (which must place every subview) made "hide the overflow rows"
  hazardous inside a `List`.
- The chevron is an icon-only control, in line with keeping controls minimal
  for the e-ink tablet build.

Verified on the emulator (folded default, expand, select 日語, force-stop and
relaunch → filter restored, folded, checkmark shown). The signed release APK
is built and ready; the phone wasn't connected, so on-device install is
pending.
