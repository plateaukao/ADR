2026-07-27

# sim-use: atomic `touch` on real iOS devices, and the redirect nobody could read

`touch` was on the real-device backend's refused list with the note "raw
touch phases … the synthesized-event API delivers a whole gesture at once".
Revisiting it showed the refusal was half right: the verb actually has two
forms, and only one of them is architecturally impossible.

- **Atomic form** (`--down --up [--delay]`) — a complete tap or hold in one
  invocation. Nothing about the one-shot event API prevents this; it maps
  directly onto the bridge's `/tap` with a hold duration. Android reached
  the same conclusion long ago: its `dispatchGesture` is equally one-shot,
  and its `touch` supports exactly the atomic form.
- **Split form** (`--down` alone now, `--up` in a later invocation) — holds
  a touch open *across other commands*, which only the Simulator's stateful
  HID stream can do. A record-and-replay buffer was considered and rejected:
  the split form's entire point is that the app reacts *while* the touch is
  held (drag handles, spring-loaded folders), and a gesture replayed at
  `--up` time is a different gesture wearing the same flags. Refusing with a
  redirect is honest; pretending is not.

So the real-device `touch` now mirrors Android's shape precisely: atomic
form dispatches, split form redirects to the atomic form / `tap` /
`long-press`.

## The bug the redirect surfaced

Testing the rejection path showed the top-level `touch` printing:

    Error: The operation couldn't be completed. (ArgumentParser.ValidationError error 1.)

The split-form rejection — Android's included, so this predates the iOS
work — was thrown as a `ValidationError` from `resolveDeferredArguments`,
which runs after ArgumentParser's own validation phase. ArgumentParser only
renders a `ValidationError`'s message when it passes through its `validate()`
machinery; thrown anywhere else it degrades to the NSError bridge text
above. Every user who ever typed `sim-use touch --down` against an Android
serial got the useless version. Both platforms now throw `CLIError` from
that phase, which the harness renders faithfully — message, resolved UDID
and all.

The general rule worth keeping: **`ValidationError` is only meaningful
inside `validate()`; anywhere later in the command lifecycle, throw
`CLIError`.**

## Live verification (iPhone 17 Pro, iOS 27)

| Check | Signal |
|---|---|
| `touch --x 153 --y 134 --down --up` (Clock icon) | Clock opened (`App: 時鐘`) |
| `touch … --down --up --delay 0.8` on the icon | Home-screen context menu appeared |
| `touch … --down` (top-level and namespace) | Full redirect text with resolved UDID, non-zero exit |
| Same split form against an Android serial | Android's redirect text now prints too |
