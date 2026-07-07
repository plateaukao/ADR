2026-07-08

# NerLan: shared HTML-strip helper and download-state button

Two straightforward deduplications:

- `Program.descriptionText` (Channel+ API descriptions) and `PodcastFeed.descriptionText` (RSS descriptions) carried identical strip-tags → collapse-`&nbsp;` → trim chains. Now one `String.strippedHTML` extension in Models.swift.
- `EpisodeRow` (NER episode list) and `RecordRow` (downloads/favorites/AI/podcast rows) each had a private `downloadButton` with the same three states — green check when downloaded, spinner while in flight, download button otherwise. The only difference was the NER list disabling the button for rows with no audio URL. `DownloadStateButton(record:enabled:)` replaces both; `enabled` defaults to true so `RecordRow`'s call site stays minimal.
