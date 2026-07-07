2026-07-07

# EinkBro: in-progress edits survive rotation in config screens

## What was broken

None of the Compose config activities declare `configChanges`, so rotation
recreates them, and every screen kept its in-progress state in plain
`remember`: rotating the device threw away a user-typed userscript, an
unsaved toolbar or statusbar arrangement, and the settings search
query/mode.

## The fix

`rememberSaveable` with appropriate savers:

- **SettingActivity** — `isSearching` / `searchQuery` (plain scalars).
- **Toolbar/Statusbar config** — the unsaved arrangement, saved as ordinal
  int lists via `listSaver` and rebuilt on restore.
- **UserScriptListActivity** — the editor's open flag, the script being
  edited (all six entity fields via a custom saver), and the dialog's
  typed code/url. Script bodies can be multi-MB — the file itself warns
  about the 1 MB Binder transaction limit — so both savers skip values
  over 100k chars rather than risk a `TransactionTooLargeException`
  during `onSaveInstanceState`; oversized scripts are fetched ones,
  re-fetchable via their `sourceUrl`. The install-url side effect also
  moved from a `remember {}` initializer (an audit finding on its own)
  to `LaunchedEffect(Unit)` and is skipped when `savedInstanceState`
  exists, so a re-fetch can't clobber the restored editor.

## Verification

Emulator: added "Title" to the toolbar preview (unsaved), rotated to
landscape — the activity recreated and the preview still shows the Title
pill with "Title" absent from Available Actions; rotated back and
cancelled without saving.
