# Notable: 2x UI scale for Sony

## Summary

On a DPT-CP1 the toolbar buttons, settings icon, and page-thumbnail
labels rendered too small to use comfortably. The panel is 13.3" /
1404 × 1872 / ~150 dpi; Notable's UI was sized for Onyx devices at
~227 dpi, so dp-based dimensions came out roughly two-thirds of the
intended physical size on Sony hardware.

This commit adds a per-vendor UI scale factor: Onyx stays at 1f
(unchanged), Sony multiplies Compose's density by 2f so everything dp-
or sp-sized renders at the original design size.

## Approach

- **Interface**: added `EinkDevice.uiScaleFactor: Float` with default
  `1f`. Sony overrides to `2f`. Goes through `EinkDevice` so future
  vendors can pick their own value without touching `MainActivity`.
- **Compose root override**: `MainActivity.onCreate` reads
  `EinkDeviceProvider.current.uiScaleFactor`, takes the current
  `LocalDensity`, and wraps the entire Compose tree with
  `CompositionLocalProvider(LocalDensity provides Density(base.density * scale, base.fontScale * scale))`.
  Skips the wrapper entirely when scale is `1f` so Onyx code paths are
  byte-identical.
- **Why density and not a Configuration override**: changing
  `Configuration.densityDpi` at `attachBaseContext` affects resource
  loading (different drawable buckets pick up, etc.) and risks
  surprising side-effects. Overriding only `LocalDensity` confines the
  scaling to Compose layout and font sizing — which is where every
  toolbar element lives — and leaves the rest of the framework alone.

## Trade-offs

- **The `SurfaceView` (DrawCanvas) scales with the toolbar**. Compose
  measures the canvas region in dp and converts via the overridden
  density, so the drawing surface ends up physically larger too. Sony's
  pen coordinates are in raw view pixels, and `copyInput` converts to
  page coords using `page.zoomLevel.value`, so stroke positions stay
  correct. The visible effect is just that the page fits less content
  vertically — acceptable on a 13.3" panel.
- **`uiScaleFactor` is a constant, not a setting**. A future iteration
  could expose this in the settings UI per-device. For now `2f` is
  hard-coded in `SonyEinkDevice` based on the DPT-CP1's measured DPI;
  newer Sony hardware (if it ever appears) may want a different value.
- **DHW allow-area registration is unchanged**: `getGlobalVisibleRect`
  returns physical screen pixels regardless of `LocalDensity` override,
  so the kernel-side DHW path keeps working without translation.

## Key Files

- `app/src/main/java/com/ethran/notable/editor/eink/EinkDevice.kt` —
  `uiScaleFactor: Float` (default `1f`).
- `app/src/sony/java/com/ethran/notable/editor/eink/sony/SonyEinkDevice.kt`
  — `uiScaleFactor = 2f`.
- `app/src/main/java/com/ethran/notable/MainActivity.kt` — reads the
  factor, wraps Compose root with
  `CompositionLocalProvider(LocalDensity provides scaled)` only when
  `scale != 1f`.
