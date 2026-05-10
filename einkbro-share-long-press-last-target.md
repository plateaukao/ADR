<!-- added: 2026-05-08T05:58:53Z -->
# EinkBro — Share long-press: copy link vs. last share target

## Problem

Long-pressing the share icon (toolbar + menu dialog) only ever copied the
current URL to the clipboard. Users wanted a faster path to re-share to
the app they most recently picked from the system chooser, without going
through the chooser again.

## Root Cause

There was no mechanism in EinkBro to record which app the user selected
from the share chooser, and the long-press behavior was hard-coded to
"copy link" (toolbar long-press was a no-op).

## Solution

1. **Capture the chosen target.** `IntentUnit.share` now passes a
   `PendingIntent` to `Intent.createChooser` so Android delivers
   `EXTRA_CHOSEN_COMPONENT` to a new `ShareChosenReceiver`. The receiver
   persists the `ComponentName` (package + class) into `BrowserConfig`.
2. **Behavior setting.** A new `ShareLongPressAction` enum (`COPY_LINK`,
   `LAST_SHARE_TARGET`) is exposed under Settings → Behavior. Default is
   `COPY_LINK`, preserving prior behavior.
3. **Long-press routing.** `BrowserAction.ShareLinkLongPress` is dispatched
   from both `MenuActionHandler` and `ToolbarActionHandler`. `BrowserActivity`
   reads the setting and either copies the URL or calls
   `IntentUnit.shareToLastTarget`, which fires `ACTION_SEND` pinned to the
   stored `ComponentName`. If the target was uninstalled, prefs are cleared
   and the chooser is re-shown.
4. **Sharing-shortcut workaround.** Some apps (e.g. 1DM) expose multiple
   share targets via Sharing Shortcuts on a single host activity, and the
   chosen-component callback only returns the host. When the captured
   package has more than one `ACTION_SEND` activity, prefer one whose
   class name differs from the captured host. Single-activity packages —
   the common case — are unaffected.

## Key Files

- `app/src/main/java/info/plateaukao/einkbro/service/ShareChosenReceiver.kt` — new
- `app/src/main/java/info/plateaukao/einkbro/unit/IntentUnit.kt` — chooser callback + `shareToLastTarget` + heuristic
- `app/src/main/java/info/plateaukao/einkbro/preference/BrowserConfig.kt` — three new prefs
- `app/src/main/java/info/plateaukao/einkbro/preference/PreferenceEnums.kt` — `ShareLongPressAction`
- `app/src/main/java/info/plateaukao/einkbro/browser/BrowserAction.kt` — `ShareLinkLongPress`, `ShareLinkToLastTarget`
- `app/src/main/java/info/plateaukao/einkbro/activity/BrowserActivity.kt` — routing
- `app/src/main/java/info/plateaukao/einkbro/view/handlers/{Menu,Toolbar}ActionHandler.kt`
- `app/src/main/java/info/plateaukao/einkbro/activity/SettingActivity.kt` — Behavior list item
- `app/src/main/AndroidManifest.xml` — receiver registration + `<queries>` for ACTION_SEND
- `app/src/main/res/values/strings.xml` — four new strings

## Lessons Learned

- `Intent.EXTRA_CHOSEN_COMPONENT` is the only public path to learn what
  the user picked from a chooser, and it returns just the host activity.
  For apps using Sharing Shortcuts (Direct Share, API 29+), the broadcast
  carries no shortcut id, so the variant the user picked cannot be
  faithfully replayed by component alone.
- On API 31+, the `PendingIntent` for the chooser callback must be
  `FLAG_MUTABLE` for the system to attach `EXTRA_CHOSEN_COMPONENT`.
- Re-firing a captured share intent should not add `FLAG_ACTIVITY_NEW_TASK`
  if the call site is already an Activity — some receivers behave
  differently in a fresh task vs. the caller's task.
- Android 11+ package visibility: `queryIntentActivities(ACTION_SEND, ...)`
  needs a matching `<queries>` entry to return third-party packages.
