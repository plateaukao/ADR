2026-07-31

# Test server gains userscript, upload, and image-page fixtures

Five fixtures that accumulated during recent feature work are now checked into
`test_server/`, joining the existing regression pages (article.html, js_check.html,
vertical.html, etc.) served by the local test server during emulator testing:

- `us_test.html` + `us_test.user.js` — a userscript injection target and a script that
  verifies injection, `GM_setValue`/`GM_getValue` persistence, `GM_addStyle`, and menu
  commands. Used while building the userscript zip export/import and again for the
  chat/backup work, since the script's GM values exercise the `user_script_values`
  round trip in backups.
- `upload.html` — a file-input page for testing WebView upload handling.
- `img_page.html` + `img.png` — an article page with a local image, used for
  image-handling and EPUB chapter tests.

Committing them keeps the emulator regression recipes reproducible instead of
depending on files that only existed in one working tree.
