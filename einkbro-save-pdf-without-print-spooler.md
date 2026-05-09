# einkbro: Save-as-PDF without system print spooler

## Problem

"Save as PDF" silently failed on many non-GMS / AOSP-stripped / e-reader-OEM
ROMs (Boox, Onyx, Hisense, Meebook, some MIUI EU and HarmonyOS builds). Users
tapped the menu item and nothing happened, or the system print dialog opened
with "No printers" and no PDF fallback.

## Root cause

The handler called `PrintManager.print(...)` and relied on the system print
spooler (`com.android.printspooler`) and its built-in "Save as PDF" PrintService
to render and save the file. On vendor ROMs that strip or break the print
framework, one of three things happens:

1. PrintManager.print() throws or no-ops (no spooler installed at all).
2. The spooler runs but the bundled "Save as PDF" PrintService is missing, so
   the dialog has nothing to route the job to.
3. The spooler UI exists but is broken on heavily customised firmware.

The exception was being caught and printed to the log, so users only saw
"nothing happens."

## Solution

Drive the WebView's `PrintDocumentAdapter` directly (its PDF backend lives
inside Chromium/Skia, no system service required) and write the bytes to a URI
the user picks via SAF (`ACTION_CREATE_DOCUMENT`).

Flow:
- `MenuItemType.SavePdf` dispatches new `BrowserAction.SavePdf`.
- `FileHandlingDelegate.showPdfFilePicker()` opens the SAF picker with
  `mime=application/pdf` and a suggested filename.
- On `RESULT_OK`, we open a `ParcelFileDescriptor` on the chosen URI and call
  `adapter.onLayout(...) → adapter.onWrite(...)` ourselves with
  `PageRange.ALL_PAGES` and `PrintAttributes` built from the user's existing
  paper-size preference. Resolution is 300 dpi (standard print quality; the
  earlier 600 dpi was photo-print overkill).

Two practical wrinkles:
- `LayoutResultCallback` and `WriteResultCallback` have package-private
  constructors, so they can't be subclassed from Kotlin outside `android.print`.
  A tiny Java bridge in that package re-exposes them with public constructors.
- This drops the storage-permission and `MediaStore.Downloads` paths. SAF needs
  neither: the `content://` URI carries its own write grant on every supported
  API level.

The previous "Save as PDF" → system print dialog (which also let users print to
a real printer) is gone. Given the menu item's name and that it sits next to
EPUB/MHT export, that matches user intent.

## Key files

- `app/src/main/java/info/plateaukao/einkbro/activity/delegates/FileHandlingDelegate.kt`
  — new `savePdfFilePickerLauncher`, `showPdfFilePicker()`, `savePdfToUri(...)`,
  `finalizePdf(...)`. Holds the actual print-adapter driving logic.
- `app/src/main/java/info/plateaukao/einkbro/view/handlers/MenuActionHandler.kt`
  — replaced ~130 lines of in-line PDF logic with one-line dispatch.
- `app/src/main/java/info/plateaukao/einkbro/browser/BrowserAction.kt` — new
  `SavePdf` action.
- `app/src/main/java/info/plateaukao/einkbro/browser/BrowserController.kt` —
  added `FileController.showPdfFilePicker()`.
- `app/src/main/java/info/plateaukao/einkbro/activity/BrowserActivity.kt` —
  routed action and forwarded to delegate.
- `app/src/main/java/android/print/PrintCallbacks.java` — bridge in
  `android.print` to re-expose `LayoutResultCallback` /
  `WriteResultCallback` public constructors.

## Lessons learned

- "It works on my Pixel" hides a wide spectrum of non-GMS reality. If a feature
  on Android calls out to a system service, ask whether the service is actually
  guaranteed to be present. Print spooler, GMS account picker, voice services,
  WebView updates — all are missing or broken on real-world e-reader firmware.
- `WebView.createPrintDocumentAdapter` is usable without the print framework UI
  at all. You don't need PrintManager — just call `onLayout`/`onWrite` yourself
  with any `ParcelFileDescriptor`.
- For framework callbacks with package-private constructors, a small Java
  shim in the same package is the standard escape hatch — it survives R8 and
  works at runtime because Android doesn't seal `android.*` against the app
  classloader.
- SAF (`ACTION_CREATE_DOCUMENT`) is dramatically simpler than juggling
  `MediaStore.Downloads` (API 29+) and public-Downloads `File` writes (API
  24–28). When user-visible "save where?" is acceptable UX, SAF removes the
  entire scoped-storage codepath.
