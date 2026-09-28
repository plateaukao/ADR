2026-09-28

# Add Disney+ subtitle and EPUB downloads

The extension now supports Disney+ video and whole-series subtitle downloads, including SRT ZIP archives and EPUB books with an optional second language and cover image. This commits the existing Disney+ work separately from EPUB compression.

A page-world hook observes playback playlists and obtains series metadata. The content script discovers subtitle tracks, fetches subtitle segments through a host-restricted background worker, and drives episode playback for series collection. Batch progress survives navigation in session storage, supports stopping and saving partial results, and waits between episodes. The popup adapts its controls to Disney+ and hides Netflix-specific settings. The manifest registers the new scripts and required hosts.

All five Node tests pass, covering localized catalog discovery, series collection, cover selection, language selection, and shared EPUB compression. JavaScript syntax checks and manifest script existence checks also pass. Live authenticated Disney+ playback was not exercised during this commit task.

Project commit: ad537ad.
