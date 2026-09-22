2026-09-23

# Add a per-document vertical reading option

Books that do not declare vertical layout could only be read horizontally unless readers maintained a custom CSS tweak. KOReader Tategumi now exposes a **Vertical reading** toggle under **Document settings**. The selection is stored with the book, appends `writing-mode: vertical-rl` and `text-orientation: mixed` to the existing style tweaks, and reloads the document so CRengine can rebuild its page map with native vertical metrics, substitutions, and ruby positioning.

The appended stylesheet is centralized so initial loading, style reapplication, and stylesheet changes all preserve the selected reading mode. Unit coverage checks that existing book tweaks remain intact, disabling the option leaves them unchanged, and the toggle is registered in the requested submenu.

The top-level repository also advances `koreader-base` to the vertical style-cache persistence fix. That renderer change serializes the writing-mode fields included in style hashes, allowing reopened vertical EPUBs to restore their cached formatting instead of rendering from scratch every time.
