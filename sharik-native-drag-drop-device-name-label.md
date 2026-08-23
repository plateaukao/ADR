2026-08-23

# sharik-native: drag-and-drop sharing, device name as a corner label

Two usability changes to the native macOS Sharik (`~/src/sharik-native`).

**Drag and drop.** The history area is now a drop target for Finder items and
for plain text: dropping one or more files/folders starts a share session
exactly as *Share File…* does, dropping text shares it as a text item. The
target highlights while a drag hovers. Finder delivers `public.file-url`
providers whose payload is the URL's data representation; they are resolved
asynchronously, re-ordered to the drop order, and shared once all are in.

**Device name.** It was a text field at the top of the window, which gave a
rarely changed setting the most prominent spot. It is now a small
`desktopcomputer` label in the bottom-right corner; clicking it swaps in a
200 pt text field (focus is requested one run-loop later, because the field
only exists after the state change renders). Enter or losing focus commits,
Esc cancels, and empty input keeps the old name.

Verification was by build and code review only: synthetic input from the
terminal does not reach the app without Accessibility permission, so the
click-to-edit and drop paths were exercised manually rather than scripted.
