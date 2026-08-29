2026-08-29

# CalliPlus: main screen rotation, remembered brush size

Two small follow-ups from the Boox pen session, commit `5036e2a` on `calliplus_android`.

## Main screen rotates

`MainActivity` had `android:screenOrientation="portrait"` in the manifest since 2022
(`d04ccd2`), while every other screen rotates freely. On a 10" e-ink tablet held in
landscape for the two-pane charbook screens, snapping back to portrait on the way to the
main screen was jarring, and the wide `layout-w720dp` / `layout-w720dp-port` variants of
`activity_main` already existed. The lock is gone.

Because the wide and portrait layouts differ, the screen is recreated on rotation rather
than handling `configChanges` itself. What has to survive that:

- the search text — the `EditText` restores it on its own;
- the result pager — the converted query it shows is kept in `currentQuery`, saved in
  `onSaveInstanceState`, and re-run via `search(query)` in `onRestoreInstanceState`
  (not `search()`, which would add a duplicate history entry);
- the selected-character strip — `CharData` is `Parcelable`, so the adapter's list goes
  into the bundle as a parcelable array list and is re-added.

Verified on the Tab Ultra C by forcing `user_rotation` 0 and 3 with the accelerometer off:
both orientations lay out correctly.

## Brush size remembered

The character pane's slider sets the `PaintView` pen size but always reset to the layout
default (20). It is now persisted as `MyPreferenceManager.PREF_PAINT_PEN_SIZE` when the
user lets go of the thumb, and `CharPanel` restores it in `init` by setting the seekbar's
progress — which also pushes the value into the `PaintView` (and, on Boox, into the
firmware pen width) through the existing change listener.
