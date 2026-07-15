2026-07-07

# EinkBro: batch of seven small UI bugs from the audit

Follow-up to the Compose UI audit: seven independent, small defects fixed in
one commit (each is a few lines).

1. **Suggestion rows ignored their height.** `Modifier.conditional {}` takes
   a `Modifier.() -> Modifier` lambda; the call site chained `height(35.dp)`
   and `padding(end = 5.dp)` as two statements, so only the padding (the
   last expression) survived. Now chained properly.
2. **Auto-hide-toolbar scroll cutoff off by about 50px.** The cutoff computed
   `112 * density.roundToInt()` — rounding the density (2.75 → 3) rather
   than the product. Parenthesized.
3. **D-pad swallowed with the feature off.** `KeyHandler` returned `true`
   for DPAD_UP/DOWN unconditionally; with `useUpDownPageTurn` disabled it
   now lets the system handle focus navigation (external keyboards).
4. **HTTP-auth password echoed in plaintext.** The dialog's password field
   gained `PasswordVisualTransformation` and a password keyboard type —
   notable on e-ink where the last frame lingers.
5. **Frozen FocusRequester.** `remember { focusRequester }` pinned the
   first parameter value forever; the parameter is used directly now.
6. **`Facebook` enum entry, twitter URL.** Renamed to `Twitter`.
7. **Stale tab-focus border.** Closing a tab that precedes the current one
   shifts indices, but `TabManager.removeAlbum` only refreshed the focus
   index when closing the *current* tab. The overview and tab strip showed
   the border on the wrong tab. The non-current branch now recomputes the
   index the same way `showAlbum` does. Verified on the emulator: with
   three tabs and the third active, closing the first keeps the border on
   the active tab as it shifts to position two.
