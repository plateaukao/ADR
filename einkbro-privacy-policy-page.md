2026-08-01

# Privacy Policy Page for the Play Store Listing

Google Play requires every listing to link a publicly hosted privacy policy, so the upcoming Play Store distribution of EinkBro (the new `playRelease` build type) needed one. This adds `docs/policy.html` to the GitHub Pages site — live at `https://plateaukao.github.io/einkbro/policy.html` — plus a Traditional Chinese counterpart at `docs/zh-tw/policy.html`.

The zh-tw copy is not optional polish: the site's `lang-banner.js` unconditionally injects an EN | 中文 switcher into every page's nav, linking to the same filename under `zh-tw/`. An English-only policy page would give Chinese-locale visitors a 404 from its own navigation.

## What the policy says, and why it's phrased that way

Rather than a generic template, the content was derived from the code: a sweep of `https://` hosts referenced in `app/src/main/java` enumerated every external service the app can actually contact. That grounded the policy's two-part structure:

- **The default posture** — no analytics, no ads, no developer-operated servers; all browser state (history, bookmarks, settings, AI chat sessions, transcripts, translation cache) lives on-device.
- **Opt-in flows that do leave the device**, each named with its real provider: search engines and suggestion endpoints, AI providers (OpenAI, Gemini, custom/self-hosted — always with the user's own API key), translation services (Google Translate, Papago, DeepL), cloud TTS (Microsoft Edge, OpenAI), Google Drive backup to the user's own account, Instapaper, AdGuard filter-list downloads, and the GitHub update check.

Play reviewers also look for specific sections, so the page covers permissions (location is only ever a pass-through for site geolocation requests; storage is for user-requested downloads/backups), credential handling (API keys in app-private storage, HTTPS only), children, policy-change notice, and a contact channel.

The pages reuse the docs site's existing chrome (nav, `page-content` container, footer, analytics tag) so they render consistently with the rest of the site and pick up the language switcher for free.
