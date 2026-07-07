2026-07-07

# NerLan: episode list builds its play queue once per render

`ProgramDetailView` passed each `EpisodeRow` a `queue:` of `episodes.map(record(for:))` — evaluated *inside* the `ForEach`, so every row constructed a fresh array of `EpisodeRecord`s covering the whole episode list. With n episodes that's n² record constructions per List body evaluation; infinite scroll takes n into the hundreds, so a single re-render (any store publish) allocated tens of thousands of structs, each with several `String` fields.

The queue snapshot is now a single `let` above the `ForEach`, shared by every row. Behavior is identical — every row already received the same logical queue; it was just built n times.
