2026-07-29

# Trimming the menu and the translation providers for the App Store resubmission

The first submission came back under Guideline 2.1 — Information Needed, asking
for a screen recording of the app's core flow plus written answers about
purpose, testing, external services and regional differences. Preparing that
recording forced a question that had not been asked directly before: *what does
a reviewer see if they tap everything?*

Several things they would tap did nothing. That is its own 2.1 risk, so the
answer was to remove them rather than explain them away.

## Menu items a reviewer would find inert

**Send Link and Receive Data** speak a raw UDP multicast protocol, chosen for
compatibility with the Android app's device-to-device share. iOS requires the
restricted multicast entitlement for that, which Apple has not granted team
3WD42GF27D — so in any shipping build these two items were already dead. They
now ride on the existing `BACKUP_RESTORE_ENABLED` flag, which covers the
backup/restore screen for the same underlying reason.

**Instapaper** got its own flag instead of sharing that one, because it is
inert for an unrelated reason: it does nothing until the user hands over an
Instapaper username and password. Sharing a flag would have tangled two
independent conditions, and whoever flips the LAN flag once the entitlement
arrives should not silently resurrect an account-gated feature. It is gated in
the gesture-action picker too, so it cannot be bound from Settings either; a
gesture bound to it by an earlier build falls back to `nothingEntry`, which
`entryOf()` already does for unknown ids.

**Close tab** was deleted outright rather than flagged. On Android it doubles as
"quit" once the last tab closes; on iOS an app cannot self-terminate, so
`closeTab()` can only ever hand back a fresh home tab. The item promised
something the platform does not do. Tabs are still closed from the tab list.

Gating is applied in two places — `defaultSectionItems` and again in
`decodeMenuEntries` — so an order persisted by an earlier build drops the
tokens as well, and flipping a flag back on lets `effectiveMenuEntries`
re-append the items to their default section. `MenuItemType` persists by *name*,
never ordinal, which is why deleting the `CloseTab` constant cannot reshuffle a
saved layout.

## DeepL and Papago

Both providers reach endpoints that are not public APIs. DeepL goes through the
web client's jsonrpc route, including the method-key spacing it fingerprints by
request id. Papago scrapes an `AUTH_KEY` out of a webpack chunk and HMAC-MD5
signs every call; its image-OCR mode adds a third, separately keyed endpoint.

Shipping scraped-credential clients inside an App Store binary is not a fight
worth picking during a review that is already asking pointed questions about
external services. Paragraph translation keeps Google plus the LLM providers,
which is what the store listing actually advertises.

The removal took out more than two providers: the translate dialog's two
buttons, the Translate-image context-menu item and its `shouldShowTranslateImage`
plumbing, the image-translate API key row in Settings > Misc, the
`PAPAGO_TRANSLATE_BY_SCREEN` and `DEEPL_BY_PARAGRAPH` translation modes, three
orphaned JS/HTML assets, the `ic_papago` drawable, and `Crypto`'s
`hmacMd5`/`hmacSha1`/`md5Hex` — about 650 lines net.

### Two removals that needed care

`TRANSLATE_API` persists **by ordinal** and lost two constants from the middle
of its list. The getter was a bare `entries[storedInt]`, so a stored `GEMINI`
(ordinal 6) would have indexed past the end of a now five-entry enum and
crashed on read — a rejection-grade bug introduced by an otherwise tidy
deletion. It is now `getOrElse { GOOGLE }`.

Per-site translation modes are enum *names* serialised into JSON in the
database, so a site pinned to a removed mode no longer decodes. That one needed
no migration: `getAllDomainConfigurations` already wraps each row in
`runCatching{}.getOrNull()`, so the row drops and the site falls back to the
global mode.

The general lesson, which came up twice in one session: before deleting an enum
constant, check how the enum is persisted. By name is safe. By ordinal means
every stored value past the deletion point is now wrong, and an unguarded
`entries[...]` turns wrong into a crash.

## Recording the demo on a clean device without losing a working install

The video has to start from launch and show first-run state, but the phone used
for recording also carries a daily-driver install with real bookmarks and
history. Three options were weighed:

1. **A second bundle id** (`...ios.demo`) built from the same source, installed
   alongside. The daily app is never touched and the demo container is pristine
   by construction. The recorded binary differs from the submitted one by a
   bundle identifier, which is invisible in a screen recording.
2. **Back up, wipe, record, restore** via Xcode's Download/Replace Container.
   Viable here — the installed app turned out to be development-signed, so its
   container is readable — but it puts real data through a restore step, and
   `Library/Preferences` restores are the fiddly part because cfprefsd caches
   them.
3. **A second device.** Clean, but the spare hardware runs older iOS, and Apple
   asked for the latest OS.

Option 1 won on risk. `PRODUCT_NAME` stays `EinkBro` so the home-screen icon and
label match the submitted app exactly; only the bundle id differs, and it is
overridden on the `xcodebuild` command line rather than in `project.yml`, so
nothing about the real project configuration changes.

The response pack — a scene-by-scene shot list with narration, plus paste-ready
answers for App Store Connect's Notes field — lives in
`~/Desktop/EinkBro-AppStore/app-review-2.1-response.md` alongside the existing
listing metadata.
