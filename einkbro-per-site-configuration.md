# EinkBro - Per-Site Configuration for Display Settings

## Problem

EinkBro's display settings (font size, font type, bold font, black font, font boldness) were global only, applied uniformly to all websites. Users needed the ability to customize display settings per domain — e.g., larger font on news sites, bold text on specific reading sites — without affecting other sites.

## Root Cause

The existing `DomainConfigurationData` system only stored boolean toggles (fix scroll, send page nav key, translate site, white background, invert color). Richer display settings like font size and font type were only available as global `SharedPreferences` values through `DisplayConfig`.

## Solution

Extended the existing `DomainConfigurationData` JSON-serialized data class with nullable fields for display overrides. Nullable means "use global setting"; non-null means "override for this domain". No Room migration needed since the configuration column is a JSON text blob and kotlinx.serialization handles missing fields with defaults.

Key changes:
- **DomainConfigurationData**: Added `fontSize`, `fontType`, `boldFontStyle`, `blackFontStyle`, `fontBoldness`, `desktopMode`, `enableJavascript` (all nullable)
- **ConfigManager**: Added per-site getter methods that resolve override vs global fallback
- **WebContentPostProcessor/WebViewReaderHelper**: Updated to use URL-aware accessors
- **SiteSettingsDialogFragment**: New Compose dialog with per-site override controls, accessible from the menu via a Tune icon
- **FontType enum**: Added `@Serializable` annotation for JSON serialization

## Key Files

- `database/DomainConfiguration.kt` — Extended data model
- `preference/ConfigManager.kt` — Per-site getter/setter methods
- `preference/PreferenceEnums.kt` — `@Serializable` on `FontType`
- `browser/WebContentPostProcessor.kt` — Per-site font size resolution
- `view/WebViewReaderHelper.kt` — Per-site font/bold/black resolution
- `view/dialog/compose/SiteSettingsDialogFragment.kt` — New settings dialog
- `view/dialog/compose/MenuDialogFragment.kt` — Menu entry point
- `view/handlers/MenuActionHandler.kt` — Action dispatch
- `browser/BrowserAction.kt` — New `ShowSiteSettingsDialog` action
- `activity/BrowserActivity.kt` — Dialog launch

## Lessons Learned

- `Modifier.width(IntrinsicSize.Max)` combined with `DropdownMenu` (which uses `SubcomposeLayout`) causes a crash — use fixed width instead.
- Drawable icons using `?attr/colorControlNormal` work fine in Compose when a tint override is applied.
- For ripple-free icon clicks in Compose, use `clickable(interactionSource, indication = null)`.
- Nullable fields with kotlinx.serialization defaults provide a clean "override or fallback" pattern without needing database migrations.
