2026-07-05

# EinkBro: BrowserActivity singleInstance → singleTask (issue #612)

## What was broken

Issue #612: open Settings, go to recents, re-enter the app, press back — and you're dumped at the launcher instead of back in the browser. Recents also showed a second card titled "SettingActivity" instead of one EinkBro card.

## Root cause

`BrowserActivity` was declared `android:launchMode="singleInstance"`. That mode means the activity must be the *only* activity in its task, so every sub-activity it launches (SettingActivity and all the settings sub-screens) is forced into a **separate task**:

```mermaid
flowchart TD
    A["Task 1: BrowserActivity<br/>launchMode=singleInstance<br/>(must be the ONLY activity in its task)"] -->|"user opens Settings"| B["Task 2 created: SettingActivity<br/>(forced into a separate task)"]
    B --> C["Recents now shows a card titled<br/>'SettingActivity'<br/>(label string is literally that)"]
    C -->|"back pressed immediately<br/>(no recents visit)"| D["System returns to the<br/>previously active task = browser<br/>-- appears to work"]
    C -->|"re-enter via recents card,<br/>then press back"| E["SettingActivity finishes,<br/>Task 2 is now empty"]
    E --> F["No parent activity in Task 2<br/>and no link back to Task 1<br/>=> Android goes to launcher<br/>(user kicked out of app)"]
```

The direct flow (open Settings, press back right away) only *appears* to work because the system happens to return to the previously active task. Once the user detours through recents, that linkage is gone: the Settings task's back stack contains only SettingActivity, so back empties the task and Android goes home.

## Why singleInstance was there — a history dig

Tracing every commit that ever touched the browser activity's `launchMode` shows the value was never a decision made for the current architecture:

```mermaid
timeline
    title launchMode history behind BrowserActivity's singleInstance
    2016-10 v1.0 : Original "Browser" app by scoute-dich : main Browser activity uses singleTop
    2016-12 v1.8 : Tabs added as SEPARATE activities (Browser_left / Browser_right) : changed to singleInstance so each tab-activity lives in its own task
    2017-05 v3.6 : Five tab activities Browser_1..5 : tried switching them to singleTask
    2017-05 same day : "fix open tabs" : reverted to singleInstance because singleTask put all tab-activities in ONE task and tab switching broke
    2017-12 : "switched to Ninja as base" : new architecture, ALL tabs inside one BrowserActivity : singleInstance imported verbatim from Ninja upstream, no local decision
    2019-07 v6.5 : HolderActivity (translucent dispatcher) singleTask to singleInstance : no changelog reason given : BrowserActivity untouched
    2021-04 : plateaukao removes HolderActivity : BrowserActivity becomes launcher entry, singleInstance carried over as-is
    2021-08 : ExtraBrowserActivity added for new-window background playing : uses NEW_DOCUMENT + MULTIPLE_TASK flags, independent of launch mode
    2024-02 : DictActivity gets singleInstance (translation popup) : unrelated to browser task
    2025-03 : EpubReaderActivity gets singleInstance for issue 474 intent routing : unrelated to browser task
```

The only documented reason for preferring `singleInstance` over `singleTask` — the 2017 "fix open tabs" same-day revert — belonged to a design where each tab was its own activity and needed its own task. That architecture died with the Ninja migration in December 2017: since then all tabs live inside one `BrowserActivity`, and `singleInstance` was simply inherited from Ninja upstream and carried through every refactor untouched.

## The fix

Change one attribute on `BrowserActivity`:

```xml
android:launchMode="singleTask"
```

`singleTask` keeps everything the app actually wants — a single browser instance, external VIEW/SEND intents delivered via `onNewIntent()` — while letting SettingActivity and the other sub-screens stack on top of BrowserActivity in the same task. Recents shows one EinkBro card, and back from Settings naturally returns to the browser.

The new-window / background-playing feature is unaffected: `IntentUnit.launchNewBrowser()` starts `ExtraBrowserActivity` with `FLAG_ACTIVITY_NEW_DOCUMENT | FLAG_ACTIVITY_MULTIPLE_TASK`, which creates its own document task regardless of the browser's launch mode.

One behavior nuance of `singleTask`: if an external link arrives while Settings is on top, Android clears the activities above BrowserActivity to deliver the intent — Settings closes and the link opens. Reasonable for a browser.

## Verification (emulator)

- Settings and BrowserActivity now share one task (`dumpsys activity activities` shows both records under the same task id).
- The exact issue repro — Settings → recents → re-enter → back — lands back on the browser, not the launcher; recents shows a single card titled EinkBro.
- An external VIEW intent is delivered to the existing BrowserActivity instance (task brought to front, no new instance) and the page opens in a new tab; the same works when Settings is on top (Settings is cleared first).
- Long-pressing "+" in the tab overview still opens `ExtraBrowserActivity` in its own separate task.
