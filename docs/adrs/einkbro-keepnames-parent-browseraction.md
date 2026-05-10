# einkbro — Keep parent BrowserAction sealed class under R8

## Problem

Two-finger swipe and nav-button float gesture bindings silently disappeared
when the same source code was built as both `release` and `releaseDebuggable`
and installed back-to-back on the same device. Multitouch and nav-float
gestures (which have no declared default in `TouchConfig`) were the most
visible victims — their binding would reset to "Nothing" after switching
variants.

## Root Cause

`BrowserActionPreference` persists each gesture binding as
`BrowserAction::class.simpleName`, so both variants must produce the same
string for the same action. The existing `-keepnames` rule covered only the
nested subclasses:

```
-keepnames class info.plateaukao.einkbro.browser.BrowserAction$* { }
```

R8 therefore still renamed the parent sealed class:

```
info.plateaukao.einkbro.browser.BrowserAction -> o3.k
info.plateaukao.einkbro.browser.BrowserAction$PageUp -> info.plateaukao.einkbro.browser.BrowserAction$PageUp
```

With the parent renamed but the nested subclasses keeping their original
FQN, Java's `Class.getSimpleName()` can no longer compute the simple name
from the (now-inconsistent) `InnerClasses` / enclosing-class metadata and
falls back to parsing the binary name. The result is a mangled string like
`"BrowserAction$PageUp"` instead of `"PageUp"`.

- `release` (minified) writes mangled ids → `"BrowserAction$PageUp"`.
- `releaseDebuggable` (not minified) writes clean names → `"PageUp"`.
- Each variant reads a pref written by the other, fails to resolve, and
  commit 23fa80da's corruption-cleanup code overwrites the binding with
  `"Noop"` (= "Nothing"). Data is lost permanently.

## Solution

Add the parent class to the keepnames rule so R8 does not rename it:

```
-keepnames class info.plateaukao.einkbro.browser.BrowserAction
-keepnames class info.plateaukao.einkbro.browser.BrowserAction$* { }
```

After the fix, `mapping.txt` shows:

```
info.plateaukao.einkbro.browser.BrowserAction -> info.plateaukao.einkbro.browser.BrowserAction:
```

`::class.simpleName` now returns the expected short name ("PageUp",
"GotoLeftTab", etc.) under both variants, so stored ids match.

## Key Files

- `app/proguard-rules.txt` — added parent `-keepnames` rule.
- `app/src/main/java/info/plateaukao/einkbro/browser/BrowserActionCatalog.kt:11,145` — the `id` derived from `action::class.simpleName`.
- `app/src/main/java/info/plateaukao/einkbro/preference/PreferenceDelegates.kt:56-74` — `BrowserActionPreference.getValue`; the destructive rewrite-to-default that turns a one-time mismatch into permanent data loss still needs fixing (Bug 2, deferred).

## Lessons Learned

- `-keepnames class X$* { }` is not enough when `X` itself is a renamed
  sealed/outer class. `Class.getSimpleName()` depends on a consistent
  relationship between the enclosing class name and the nested class's
  binary name; renaming one without the other silently produces mangled
  simple names.
- Using `::class.simpleName` as a stable persisted identifier across
  obfuscated builds is a fragile contract. If this recurs, consider moving
  to an explicit registry (e.g. an enum-backed `actionId` string on each
  action) instead of relying on reflection + ProGuard rules.
- Variants with the same `applicationId` share SharedPreferences; any
  serialization that differs between variants can corrupt the other's data.
  Either keep serialization identical across all build types, or give the
  debug/test variants their own `applicationIdSuffix`.
