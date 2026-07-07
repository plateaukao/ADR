2026-07-07

# EinkBro: GptActionDialog no longer wipes typed fields on recomposition

## What was broken

The GPT action editor dialog created seven key-less
`remember { mutableStateOf(...) }` fields and then — directly in the
composable body — unconditionally assigned every one of them from the
`action` parameter (or to defaults for the add case). That assignment block
is a side effect in composition: it re-ran on *every* recomposition of the
dialog's outer scope, resetting whatever the user had typed. It only
appeared to work because the text fields live in a child recomposition
scope, so plain typing usually didn't re-run the outer body — but any outer
invalidation (parent state change, window metrics change from the soft
keyboard on some devices) silently wiped the form.

## The fix

Textbook keyed initialization: each field is now
`remember(editActionIndex, action) { mutableStateOf(initial) }`, with the
edit-vs-add choice made inside the initializer, and the assignment block is
deleted. State resets exactly when a different action is edited — never
because Compose happened to recompose.

Also moved the dialog's dim-removal hack
(`(LocalView.current.parent as DialogWindowProvider).window.setDimAmount(0f)`,
an unchecked cast executed per recomposition of the text slot) into a
`SideEffect` with a safe cast.

## Verification

Emulator: opened ChatGPT Actions → Add, typed a name, then selected a
different service type — a state change that recomposes the dialog. The
typed name survives (previously this class of recomposition reset it).
Cancelled without saving.
