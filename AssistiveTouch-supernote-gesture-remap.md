# AssistiveTouch — Supernote gesture remap

**Branch:** `supernote` (off `master`)
**Commits:** `2a8dbcf` (interim), `4279c10` (final)
**Date:** 2026-06-04 / 2026-06-05
**Device:** Supernote Nomad (eInk)

## Summary

Remapped the floating AssistiveTouch button's gestures for the Supernote Nomad:

| Gesture | master | **supernote (final)** |
|---|---|---|
| Single tap | Back | **Back** |
| Double tap | Home | **Home / default launcher** |
| Long press | eInk full-frame refresh (Pubook API) | **eInk screen refresh (Supernote API)** |

Single/double use `AccessibilityService.performGlobalAction(GLOBAL_ACTION_BACK /
GLOBAL_ACTION_HOME)`; `GLOBAL_ACTION_HOME` routes to whatever launcher is the
system default. Long-press calls a new `refreshScreen()` helper that reproduces
the Supernote launcher's own eInk refresh.

> The interim commit (`2a8dbcf`) mapped double→Recents, long→Home while the
> refresh mechanism was still unknown. `4279c10` finalizes double→Home and moves
> the eInk refresh onto long-press once the Supernote refresh API was found.

## Approach

### Double-tap: why not the Supernote slide panel

The original goal for double-tap was to **open the Supernote slide panel** (the
bezel side menu). Device investigation showed this is **not reachable from a
normal third-party app**:

- The only trigger is the broadcast
  `com.ratta.supernote.launcher.BroadcastReceiver.slidebarstatusbar`, whose
  receiver requires
  `com.ratta.supernote.launcher.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`
  (protection level **`signature`** — Ratta's platform key). Shell (uid 2000)
  was permission-denied.
- The hardware path (injecting into the dedicated `fts_slide_ts` /
  `ratta-slide` input devices) needs **root**, which the device lacks.

(See `eLauncher-supernote-slidebar-gesture-investigation.md`.) Double-tap was
therefore set to Home.

### Long-press: reproducing the Supernote eInk refresh

The master code refreshed via `android.os.EinkManager#sendOneFullFrame()` — a
**Pubook** API that is not how the Supernote refreshes. The Supernote mechanism
was reverse-engineered from the system launcher
(`/system_ext/app/SupernoteLauncher/SupernoteLauncher.apk`) by disassembling its
dex with `dexdump`. Its `GestureService.GCRefresh()` does two things:

1. `getSystemService("eink").screenRefresh(false, 1)` — resolved via the
   launcher's `ReflectUtilities.setEinkManager(ctx, "screenRefresh", argTypes,
   args)`, which is literally `context.getSystemService("eink")` followed by a
   reflective method invoke. The `"eink"` service is backed by
   `android.os.IEinkManager` (confirmed via `service list`). Arg values
   (`boolean=false`, `int=1`) were read from the GCRefresh bytecode.
2. The static `android.view.SFCommand.screenRefresh()` (a SurfaceFlinger
   command).

`refreshScreen()` calls both, each in its own `try/catch(Throwable)`, so it is a
harmless no-op on non-Supernote devices and survives hidden-API/permission
failures. **Verified working on the Supernote Nomad from the unsigned app** —
neither the `"eink"` service call nor `SFCommand` was blocked for a normal app
(unlike the slide-panel broadcast).

### Branch hygiene

`supernote` was branched off `master`, not the active
`simulate_touch_screen_for_volume_key` branch, to keep unrelated WIP out. That
branch's uncommitted work was preserved with `git stash` (`stash@{0}`,
"WIP volume-key simulation (pre-supernote)") and is recoverable via
`git checkout simulate_touch_screen_for_volume_key && git stash pop`.

## Trade-offs

- **Double-tap is Home, not the Supernote slide panel.** The panel is genuinely
  unreachable without Ratta's signing key or root.
- **Refresh relies on reflection into a vendor/hidden API** (`"eink"` service +
  `android.view.SFCommand`). It works today on the Nomad but is not a stable
  public contract; the guards mean it degrades to a no-op rather than crashing
  if a firmware update changes the surface.

## Key Files

- `app/src/main/java/com/android/mirror/assisttouch/service/AssistiveTouchService.java`
  — gesture handlers remapped; `refreshScreen()` added (reflection into the
  `"eink"` service and `android.view.SFCommand`); `Method` and `Log` imports.
