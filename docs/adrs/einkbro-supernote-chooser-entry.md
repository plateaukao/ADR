<!-- added: 2026-05-09T10:28:31Z -->
# einkbro: Surface Supernote reader for saved EPUB/PDF files

## Problem

After EinkBro saved a PDF or EPUB through the SAF picker, the "Open file with"
chooser on Supernote devices never listed Supernote's built-in reader. Users
had to leave EinkBro and navigate to Supernote's library manually to open the
file they just created.

## Root Cause

Investigation across three layers:

1. **No VIEW filter.** `dumpsys package r application/pdf` returned only
   MiXplorer and KOReader — `com.supernote.document` registers no
   `ACTION_VIEW` intent filter. APK manifest dump confirmed it declares only
   `MAIN/LAUNCHER` for `MainActivity`.
2. **DocumentActivity is not exported.** The actual viewer
   `com.supernote.document/.document.DocumentActivity` has no `exported`
   attribute and no intent-filter, so EinkBro can't target it directly. A
   shell `am start` against it fails with `Permission Denial: not exported
   from uid 1000`.
3. **MainActivity does accept extras.** Decompiling the APK with apktool
   showed `MainActivity.processIntent()` reads a `file_path` string extra
   and, when the file exists and is readable, immediately starts
   `DocumentActivity` for that path. Inbox uses the same pattern when
   launching files from its file manager.

A secondary issue: SAF returns a `content://` URI whose path is a numeric
document ID, so readers that path-sniff for `.epub`/`.pdf` (and there are
several) also missed it.

## Solution

In `HelperUnit.openFile`:

- Inject a `LabeledIntent` into `EXTRA_INITIAL_INTENTS` of the chooser.
  Target `com.supernote.document/.MainActivity` (exported, singleTask) with
  `file_path` set to the absolute path resolved from the SAF document URI
  via `DocumentsContract.getDocumentId` — `primary:Document/foo.pdf` →
  `/storage/emulated/0/Document/foo.pdf`.
- Fall back to launching `com.ratta.supernote.inbox/.InBoxMainActivity`
  (with `CLEAR_TASK | NEW_TASK` so it lands on the file list rather than
  resuming a previously-open file) when the URI can't be mapped to a path.
- Re-expose any SAF content URI through FileProvider with the original
  filename, so other readers that sniff the extension from the URI path
  (ReadEra, Moon+, etc.) also resolve.
- Set explicit `application/epub+zip` / `application/pdf` MIME types so
  filters keyed on MIME (rather than path) match.

In `FileHandlingDelegate.showPdfFilePicker` and
`EpubManager.showWriteEpubFilePicker` / `showOpenEpubFilePicker`: pass
`DocumentsContract.EXTRA_INITIAL_URI =
content://com.android.externalstorage.documents/document/primary%3ADocument`
when `com.supernote.document` is installed, so the SAF picker lands in
Supernote's library directory by default.

All Supernote-specific code paths are gated on the package's presence, so
non-Supernote devices see no behaviour change.

## Key Files

- `app/src/main/java/info/plateaukao/einkbro/unit/HelperUnit.kt` — chooser
  injection, MIME resolution, FileProvider re-expose, SAF URI → path
  mapping, Supernote package detection.
- `app/src/main/java/info/plateaukao/einkbro/activity/delegates/FileHandlingDelegate.kt`
  — PDF picker initial URI.
- `app/src/main/java/info/plateaukao/einkbro/epub/EpubManager.kt` —
  EPUB write/open picker initial URI.

## Lessons Learned

- "Doesn't appear in chooser" has three distinct causes — wrong MIME, wrong
  scheme, no filter at all. `cmd package query-activities` resolves which
  one in a single call and saves a lot of speculative tweaking.
- OEM "library" apps on closed devices often expose only a `MAIN/LAUNCHER`
  entry while doing real work in non-exported activities. Decompiling the
  manifest and one or two activity classes with apktool is enough to find
  the extras the launcher activity reads, which is usually the only legal
  back door.
- `getLaunchIntentForPackage` resumes whatever task the app last had on
  screen. For "show the library" UX, target the explicit launcher
  component with `FLAG_ACTIVITY_CLEAR_TASK | FLAG_ACTIVITY_NEW_TASK`
  rather than relying on the framework helper.
- `EXTRA_INITIAL_INTENTS` on `Intent.createChooser` is the right place to
  add a custom chooser entry for an app that wouldn't otherwise resolve —
  pair it with `LabeledIntent` so it carries a label and (optionally)
  icon.
