# game2048 - PWA Support

## Problem
The game couldn't be played offline when saved as an MHT file, since browsers block inline JavaScript in MHT/MHTML files for security reasons.

## Root Cause
MHT format enforces a Content Security Policy that prevents inline scripts and event handlers from executing.

## Solution
Added Progressive Web App (PWA) support with three components:
- `manifest.json` — declares the app metadata, enabling "Add to Home Screen" as a standalone app
- `sw.js` — service worker that caches all assets using a network-first strategy, falling back to cache when offline
- Registration line in `index.html` to activate the service worker

## Key Files
- `sw.js` — service worker with install/activate/fetch handlers
- `manifest.json` — web app manifest
- `index.html` — added manifest link and service worker registration

## Lessons Learned
- MHT files block inline JS — there's no workaround within the format itself.
- PWA with a service worker is the proper way to enable offline access for web apps.
- Network-first cache strategy ensures users always get the latest version when online, with offline fallback.
