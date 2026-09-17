# CrossMosa X4 Support and Formal Release

## Problem

CrossMosa originally supported the X3 hardware profile only. The project needed to support the original X4 hardware, including its 800×480 display, input mapping, SD-card access, Traditional Chinese UI, SD-card fonts, and custom sleep images.

## Root Cause

The X4 board profile and hardware detection path were not included in the CrossMosa firmware branch. X4 uses a shared SPI bus and a different power-latch arrangement from X3, so support required the upstream board definition and CrossMosa integration rather than only changing the display resolution.

## Solution

- Added the original X4 board support based on the upstream CrossPoint / FreeInk hardware profile.
- Added X4 hardware detection and runtime selection.
- Preserved the X4 SD-card wiring and power-latch behavior:
  - Display: 800×480 SSD1677.
  - Shared SD SPI: SCK GPIO8, MOSI GPIO10, MISO GPIO7, CS GPIO12.
  - Device power latch: GPIO13.
- Built and validated the firmware on physical X4 hardware.
- Confirmed the complete Traditional Chinese system UI works on X4.
- Confirmed SD-card font and custom sleep discovery works when `/.fonts` and `/.sleep` are placed at the SD-card root.
- Published the tested firmware as GitHub release `v2.1.0-beta.2`, containing:
  - `update.bin`
  - `crossmosa-2.1.0-beta.2-firmware.zip`
- Promoted the tested prerelease to a formal public release after X4 validation.

## Key Files

- `lib/hal/HalGPIO.cpp` — X4 hardware detection and board selection integration.
- `freeink-sdk/libs/hardware/BoardConfig/include/BoardConfig.h` — upstream X4 board profile and pin/power configuration.
- `src/SdCardFontSystem.cpp` — SD-card font discovery integration.
- `lib/EpdFont/SdCardFontRegistry.cpp` — `/.fonts` and `/fonts` discovery and `.cpfont` enumeration.
- `src/activities/boot_sleep/SleepActivity.cpp` — `/.sleep` custom sleep-image discovery.
- `scripts/mk-release.sh` — firmware release packaging.

## Lessons Learned

- X4 support must preserve the upstream shared-SPI pin mapping and GPIO13 power latch; treating X4 as only a larger display is insufficient.
- SD-card font and sleep directories are expected at the SD-card root. They may be hidden directories, but they must not be placed inside separate parent folders.
- A successful multilingual UI build does not by itself validate SD-card assets; physical X4 testing is required.
- Release artifacts should be built reproducibly and checked by checksum before publishing. The validated `update.bin` checksum is:
  `43d98aad3f0572b5b23367a00f0dfcf38c162937fa3f055a486425470c3cfc04`.
