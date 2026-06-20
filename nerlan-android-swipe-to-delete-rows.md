# NerLan Android — swipe-to-delete on favorites/downloads rows

## Summary

The shared episode row (`RecordRow`, used by Favorites and Downloads) carried an
always-visible trailing trash-can `IconButton` for removal. It's now removed by
swiping the row right-to-left, Material-3 style, and the trash button is gone.
The swipe reveals a red panel with a trash glyph; releasing past the threshold
performs the same action as the old button — Downloads delete the audio file,
Favorites un-favorite the episode.

## Approach

`RecordRow` already takes an optional `onDelete: (() -> Unit)?`. When it's
non-null the row's content is wrapped in a `SwipeToDismissBox`; when null
(AI-tab and podcast-detail rows) the row renders exactly as before, so those
call sites are untouched.

- The row body was hoisted into a local `@Composable` lambda so it can be passed
  as the `SwipeToDismissBox` content in the deletable case and rendered directly
  otherwise.
- The content row gets an opaque `background(colorScheme.background)` — without
  it the red reveal behind the box would bleed through the transparent row while
  settled, since `SwipeToDismissBox` stacks background and content in a `Box`.
- Swipe is one-directional (`enableDismissFromStartToEnd = false`) to match the
  iOS list's right-to-left swipe-to-delete feel.
- The non-deprecated `onDismiss` callback is used. material3 1.5.0-alpha15
  deprecated `confirmValueChange` on `rememberSwipeToDismissBoxState`; `onDismiss`
  fires once when the row settles into the dismissed state, calling `onDelete()`.
  Because the delete mutates the backing `StateFlow`, the keyed `LazyColumn`
  item is removed and the row animates away cleanly.

Motivation was e-ink clarity: a small trailing icon button is easy to mis-tap on
a slow-refresh display, whereas a full-row swipe is a larger, more deliberate
gesture, and it matches the platform idiom users already expect in a list.

## Trade-offs

- Deletion is immediate on swipe, with no confirmation dialog — the same as the
  old one-tap trash button, so no regression, but a mis-swipe deletes without an
  undo. Acceptable because Downloads re-download and Favorites re-add trivially.
- A reveal-side trash glyph is still shown during the swipe; the request was to
  drop the *always-visible* trash button, and a reveal icon is the standard
  Material affordance, so it stays.
- The opaque row background hard-codes `colorScheme.background`; if a screen ever
  hosts `RecordRow` on a non-background surface, the settled row would not match.
  All current hosts sit on the default Scaffold background.

## Key Files

- `app/src/main/java/com/example/nerlan/ui/FavoritesScreen.kt` — `RecordRow`
  wrapped in `SwipeToDismissBox`; trailing trash `IconButton` removed.
