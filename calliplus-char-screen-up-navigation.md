2026-08-29

# CalliPlus: Up from the character screen went to the main screen

## What was broken

Open a character from 間架九十二法 (歐陽詢), tap the action-bar Up arrow, and you land on
the main screen instead of the charbook you came from.

## Root cause

`CharActivity` is declared with `android:parentActivityName=".MainActivity"` in the
manifest (plus the legacy `PARENT_ACTIVITY` meta-data). The Holo action bar's default
Up handling navigates to that declared parent — but the character screen is opened from
several places (charbooks, search results, the Sanxi list), so a single static parent is
wrong for most of them.

## Fix

`CharActivity.onOptionsItemSelected` handles `android.R.id.home` by calling `finish()`.
The screen is only ever started from another screen in the same task, so finishing it is
exactly "go back to whatever opened me". The manifest declaration is left in place (it
still gives the arrow), the handler just pre-empts the default. Verified on the API 36
emulator: Up from 宫 returns to the 歐陽詢 charbook.
