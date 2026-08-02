2026-08-02

# EinkBro: agent task transcripts no longer saved as chat history

## What was broken

Agent tasks ("Page AI → Tasks") run inside the same chat page as Chat With
Web, and the page persists every session to the `chat_sessions` table for the
history picker. That meant each agent run — tool-call bubbles, progress
lines, batch results — landed in the user's chat history alongside real
conversations, cluttering it with transcripts nobody intends to revisit.

## The fix

Commit `8b010121d`: one guard at the persistence boundary. The chat page
saves through the `AndroidInterface.saveChatSession` JS bridge, and the
Kotlin side now returns early when the tab is in agent mode. The transcript
remains scrollable in the tab while it is open; it just never reaches the
database. Real Chat With Web tabs are unaffected. Verified on the emulator:
an agent run left the session count unchanged, a genuine chat added one.

## What was deliberately NOT done

A one-time startup purge of previously saved agent transcripts was
prototyped (they are reliably identifiable by the tool-call bubble marker in
the message payload) and then rolled back on principle: the app should not
auto-delete user data, even data that looks like noise. Whatever is already
in history stays until the user deletes it from the history UI themselves.
