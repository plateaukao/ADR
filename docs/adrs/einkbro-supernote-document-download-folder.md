<!-- added: 2026-05-10T03:39:59Z -->
# einkbro: route downloads to Document/ on Supernote devices

## Problem

On Supernote e-readers, the built-in Library app only indexes
`/storage/emulated/0/Document/`. EinkBro was saving every download into
`Environment.DIRECTORY_DOWNLOADS` (`Download/`), which is reachable from
the file browser but invisible to the Library — the UI most Supernote
users actually use to open EPUB/PDF files. Users had no in-product way
to redirect downloads.

## Root Cause

`DownloadHelper.kt` hard-coded `Environment.DIRECTORY_DOWNLOADS` at
every call site (`saveDataUrl`, `internalDownload`, `directDownload`,
`saveFileWithName`, `openDownloadFolder`). There was no device-class
awareness even though Supernote detection already existed in
`HelperUnit.isSupernoteDocumentInstalled` (used elsewhere for the
Open-With dialog and the EPUB save initial-URI).

## Solution

Added two private helpers in `DownloadHelper`:

- `publicDownloadDirName(context)` returns `"Document"` on Supernote and
  `Environment.DIRECTORY_DOWNLOADS` otherwise — the string is what
  `DownloadManager.Request.setDestinationInExternalPublicDir` expects.
- `publicDownloadDir(context)` returns the corresponding `File` for
  direct-write paths (data: URLs, the `directDownload` HTTP fallback,
  and `openDownloadFolder`).

Replaced all five hard-coded sites with these helpers. No SAF prompt is
needed: the manifest already declares `WRITE_EXTERNAL_STORAGE` and
`requestLegacyExternalStorage="true"`, so the legacy file path works on
the Android 11 base Supernote ships. No user-facing setting was added —
the routing is automatic when the Supernote document app is detected.

## Key Files

- `app/src/main/java/info/plateaukao/einkbro/unit/DownloadHelper.kt` —
  new `publicDownloadDirName`/`publicDownloadDir` helpers and updated
  call sites.
- `app/src/main/java/info/plateaukao/einkbro/unit/HelperUnit.kt` —
  unchanged, but `isSupernoteDocumentInstalled` is the detection source
  of truth.

## Lessons Learned

- The Supernote user-visible folder is `Document` (singular). Don't
  reach for `Environment.DIRECTORY_DOCUMENTS`, which is `"Documents"`
  (plural) and would land in the wrong place.
- `setDestinationInExternalPublicDir` accepts arbitrary subdirectory
  names, not just the `DIRECTORY_*` constants — handy for vendor-
  specific layouts like this one.
- When a project already has device detection wired up for one
  feature, search for it before adding new heuristics; the
  `isSupernoteDocumentInstalled` check already existed and just needed
  a new caller.
