<!-- 2026-05-15 -->

# pwidgets — Bluetooth Connection Widget App

## Summary

New standalone Android app (`info.plateaukao.pwidgets`) living at
`/Users/maoyuankao/src/pwidgets` with its own Gradle wrapper — a fully
independent project (initially scaffolded under `einkbro/`, then relocated out). It provides a home-screen App Widget that connects or
disconnects **any paired Bluetooth device** with one tap, showing
disconnected → connecting → connected. Configuration (device pick) happens when
the widget is added and is re-editable afterward.

Initial commit `45efdae` on branch `main` (45 files). Debug and R8 release
builds both green; verified running on a physical Pixel 9 Pro XL (Android 14):
launcher explainer reports adapter ON / permission granted, no crash.

## Approach

- **Toolchain mirrors einkbro**: Gradle 8.9, AGP 8.7.1, Kotlin 2.0.0, JVM 17,
  compile/target SDK 34, minSdk 24, Kotlin-DSL + version catalog. Minimal deps
  only (core-ktx, appcompat, material, coroutines) — no Compose/Room/Koin/Hilt.
- **No foreground service.** All interaction runs in a bounded `goAsync()`
  window (~10 s, wrapped in `withTimeout`) on a process-lifetime coroutine
  scope (`BgScope`). Live BLE/RFCOMM handles are parked in an in-memory
  `ConnectionRegistry` for the process lifetime.
- **Strategy chosen from device type** (`DeviceTypeResolver`):
  - BLE / dual → `connectGatt`; registry holds the `BluetoothGatt`. No API to
    query a not-held GATT, so a registry miss ≡ disconnected (also the honest
    answer after process death).
  - Classic SPP → RFCOMM `BluetoothSocket` (SPP UUID), blocking connect on IO.
  - Classic audio → A2DP/Headset. Truth is the public
    `BluetoothProfile.getConnectionState` (system-owned, survives process
    death); connect/disconnect is *best-effort* via reflection on the non-SDK
    `connect`/`disconnect` methods, degrading to an ERROR state if denylisted
    rather than crashing.
- **Widget plumbing**: per-appWidgetId `PendingIntent`s disambiguated by a
  distinct data `Uri` (`pwidgets://widget/<id>/<purpose>`) because PendingIntents
  de-dupe by `filterEquals` (ignoring extras); `FLAG_IMMUTABLE` on API 31+.
  Root tap is always the toggle broadcast — the provider itself routes
  SETUP_NEEDED → config and ADAPTER_OFF → system BT settings. Config Activity
  sets `RESULT_CANCELED` by default (orphan-widget discard) and pushes the
  initial RemoteViews itself since the system does not call `onUpdate` after
  configuration.
- **Permissions**: bonded-only, never scans/discovers, so `BLUETOOTH`/
  `BLUETOOTH_ADMIN` are capped at `maxSdkVersion=30` and only `BLUETOOTH_CONNECT`
  is requested at runtime (31+) — no `BLUETOOTH_SCAN`, no `ACCESS_FINE_LOCATION`.
- A lint-vital false positive ("AppCompatActivity not Instantiatable") is
  disabled narrowly in `app/build.gradle.kts` rather than turning off release
  lint wholesale.

## Trade-offs

- No foreground service ⇒ BLE/RFCOMM links may drop when the process is killed;
  the widget honestly reconciles to *disconnected* on the next update.
  A2DP/Headset are system-owned and persist/reconcile correctly.
- A2DP/Headset connect/disconnect relies on non-SDK reflection — best-effort by
  design; clear ERROR state on OS versions that block it.
- The repo was initially scaffolded inside the einkbro working tree, then
  moved to `/Users/maoyuankao/src/pwidgets` so it is a clean, independent
  checkout (no nesting). `local.properties` uses an absolute `sdk.dir`, so the
  move required no path fixes.
- README declares MIT; a matching `LICENSE` (Daniel Kao, 2026) is included.

## Key Files

- `settings.gradle.kts`, `build.gradle.kts`, `gradle/libs.versions.toml`,
  `app/build.gradle.kts`, `app/proguard-rules.pro` — standalone build.
- `app/src/main/AndroidManifest.xml`, `res/xml/bt_widget_info.xml` — widget +
  permission declaration.
- `bt/BtConnectionStrategy.kt` + `BleStrategy.kt` / `RfcommStrategy.kt` /
  `ProfileStrategy.kt`, `DeviceTypeResolver.kt`, `ConnectionRegistry.kt`,
  `BtUtils.kt` — connection layer.
- `widget/BtWidgetProvider.kt`, `WidgetRenderer.kt`, `WidgetIntents.kt`,
  `WidgetState.kt` — widget orchestration/rendering.
- `config/WidgetConfigActivity.kt`, `DeviceListAdapter.kt`,
  `data/WidgetPrefs.kt`, `MainActivity.kt`, `PwidgetsApp.kt` — config, prefs,
  launcher explainer.
- `README.md`, `LICENSE`.

## Follow-up

Pushing to GitHub is pending: creating a **public** repo was blocked by the
sandbox classifier (irreversible "create public surface"). The user must run
the create+push themselves or grant the permission.
