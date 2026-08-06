2026-08-07

# Greasy Fork: Add EinkBro to the Mobile (iOS) supported browsers list

Follow-up to the earlier Android change (greasyfork-org/greasyfork#1550). EinkBro now has an iOS version with built-in userscript support ([repo](https://github.com/plateaukao/einkbro-ios), [App Store](https://apps.apple.com/app/einkbro/id6792317757)), so Greasy Fork's install help page should list it under **Mobile (iOS)** the same way it lists the Android app under **Mobile (Android)**.

PR: https://github.com/greasyfork-org/greasyfork/pull/1560 (branch `add-einkbro-ios`, sent from the `plateaukao/greasyfork` fork).

## What changed

The iOS browser list works the same way as the Android one: the view `app/views/help/_installing.html.erb` renders the `home.ios_browsers.browser_list_html` translation string and injects the actual URLs as named interpolation variables, so locale files never contain raw links.

- The view now passes `einkbro_link: 'https://apps.apple.com/app/einkbro/id6792317757'` into the iOS list translation call.
- Every locale that defines its own `ios_browsers.browser_list_html` got a new entry after Teak: `<li>%{einkbro_link:EinkBro}: (no additional software required)` — with the parenthetical reusing that locale's existing translation from its Gear/Teak lines (e.g. zh-TW `（不需要其他軟體）`, ru `(дополнительного ПО не требуется)`).

Nine locales have a localized iOS list and were edited: `bg, en, ko, nl, pt-BR, ru, sk, zh-CN, zh-TW`. The rest only translate the section title and fall back to `en.yml`, so they pick up the entry automatically — same fallback behavior the Android PR relied on.

## Decisions

- **Region-free App Store URL.** The request supplied the Taiwan-storefront link (`apps.apple.com/tw/app/...`), but the repo's existing convention (the Userscripts link) uses region-free URLs, which let Apple route each visitor to their own storefront. Verified via the iTunes lookup API that the app is available in at least the US, JP, DE, and TW storefronts before dropping the `/tw/` segment.
- **"(no additional software required)" description.** Matches the existing Gear and Teak entries — EinkBro runs userscripts natively, no separate userscript-manager extension needed. Each locale's edit reuses its own existing translation of that phrase rather than introducing new untranslated text.

All nine modified YAML files were verified to parse with Ruby's `YAML.load_file` before committing.
