2026-09-30

# EinkBro: handle a missing custom font document

EinkBro repeatedly crashed on the connected Palma2 Pro when rendering a page with the configured custom font, `fonts/粉圓體.ttf`. The file had been removed from the device, but the saved font URI still pointed to it. The latest three fatal exceptions in the device crash buffer all followed this path.

Android's DocumentsProvider reported the missing document as an `IllegalArgumentException` while checking whether it belonged to the granted font directory. The shared custom-font request handler caught `IOException` and `SecurityException`, so this provider error escaped from `ContentResolver.openInputStream` through WebView's request callback and terminated the app.

The handler now also catches `IllegalArgumentException`, using its existing failure path so the page can fall back to its default font. Both browser and reader custom fonts use this handler. The saved font selection is preserved so the user can restore the file or choose another font.

Validation used the actual missing font on Palma2 Pro. The locally signed arm64 release built successfully and was installed with `adb install -r`, preserving app data. The restored article rendered, the missing-font exception was logged as a handled warning, and the app process survived. Reader mode also rendered successfully, with no new fatal exception in the crash buffer. `git diff --check` passed.

Implementation: `8b173971e` (`fix(fonts): handle missing custom font document`), pushed to EinkBro's `main` branch.
