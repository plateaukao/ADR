2026-07-07

# NerLan: cover images decode at display size, memory cache bounded

## What was broken

`CoverImageCache` decoded covers with `UIImage(data:)` at whatever resolution the source served — podcast feeds routinely ship 3000×3000 art, a ~34 MB decoded bitmap — and kept them in an `NSCache` with no cost limit. Those bitmaps were then drawn at 44–56 pt in list rows. Costs: decode time on first appearance of each row (scroll hitches), and unbounded resident memory growth as the session touches more shows.

## Fix

- **ImageIO thumbnail decoding.** `CGImageSourceCreateThumbnailAtIndex` with `kCGImageSourceThumbnailMaxPixelSize = 720` decodes directly at the target size — the full-resolution bitmap is never inflated (`kCGImageSourceShouldCache: false` on the source). 720px = the 240 pt full-player cover at 3×, the largest anything renders; the lock-screen artwork shares this cache and is fine at that size too.
- **Bounded cache.** `totalCostLimit = 64 MB`, with each image's cost set to its decoded bitmap size, so eviction tracks real memory.
- **Disk unchanged.** The original downloaded bytes still go to disk; if a future UI needs bigger art, re-decode picks the new bound without re-downloading.
