2026-07-07

# NerLan: favorites program delete snapshots before mutating

## What was broken

The 收藏 tab's program section handled swipe-delete with:

```swift
.onDelete { offsets in
    for i in offsets {
        favorites.toggle(program: favorites.programs[i])
    }
}
```

`favorites.programs` is the live `@Published` array, and each `toggle` removes an element — so with an `IndexSet` containing more than one offset, the second index refers to the already-shifted array: the wrong program gets unfavorited, or the index goes out of range and crashes. Today's UI only produces single-offset swipes (no `EditButton`), so this was latent, but it's exactly the kind of bug that surfaces the day an edit mode is added.

## Fix

Map the offsets to the program values first, then toggle each — the same snapshot pattern the episode sections already use implicitly (their `ForEach` groups are computed value-type snapshots, so their `group.records[i]` indexing was already safe).
