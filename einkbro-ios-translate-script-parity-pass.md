2026-08-18

# Finishing the iOS translation script parity pass

The previous iOS fix ported the two user-visible translation bugs and deliberately
stopped there, listing two Android improvements it had not brought across. This closes
those, plus one correctness gap the earlier fix created.

## The self-feeding observer

iOS re-scanned `document.body` on a flat 300 ms timer whenever anything mutated, with no
filtering and no backoff. The trap is that translation *is* a mutation: `myCallback`
writes translated text into a placeholder, which is a `childList` change under
`document.body`, which schedules another scan. Translating a page therefore kept the loop
fed with no help from the site at all, and a page that genuinely never settles — ticker,
infinite scroll, rotating ads — was rescanned three times a second for as long as it
stayed open.

Android's version, now ported, bounds it three ways: mutations landing under a marker we
already own are ignored, each scan is scoped to the shallowest changed subtrees rather
than restarting from `body`, and the delay doubles up to 5 s once scans stop finding new
content.

The effect was measured rather than assumed — deliver translations, then watch
main-thread work for the next 2.5 s:

| | translations delivered | blocking long tasks |
|---|---|---|
| before | 42 | one, **115 ms** |
| after | 117 | **none** |

The after case delivers nearly three times as many translations and produces no blocking
work at all, so the 115 ms was entirely self-inflicted.

## The deep clone

`_translateGetTextExcludingImages` did `cloneNode(true)` followed by an `img` sweep on
every call, to get "text without images". `<img>` is a void element — it can hold no
children, and alt text never lands in `textContent` — so the strip was always a no-op and
the clone was pure cost.

Measured across 2563 markers: 13.0 ms for the clone versus 0.6 ms for plain
`textContent`, with **0 differing results out of 2563** compared directly. That confirms
the reasoning, but it is worth being honest about the size: ~12 ms once per scan is not
something a user feels on iPhone hardware. This one is worth taking as *less code and one
fewer divergence*, not as a speed fix.

## A gap the previous fix opened

Restricting the rebind scan to newly-marked elements — which the previous commit had to
do, or `maybeRequestTranslation` would have run `getBoundingClientRect` across the whole
page several times a second — quietly removed iOS's only retry path.

When a translation comes back empty, `myCallback` clears the in-flight flag so the
element can be tried again. Before, the next rebind re-probed every marker and would pick
it up. After, the rebind only looks at fresh markers, so a failed paragraph would sit
untranslated unless the reader happened to scroll it back through the viewport.

`_translateRetryQueue` (also from Android) closes this: failures are queued explicitly and
retried on the next bind, without re-probing the page. `clear_translation_elements.js`
nulls it alongside the other tracking sets — unlike those `WeakSet`s it is a plain `Set`,
so leaving it populated would pin the very elements the reset detaches.

This is the part worth remembering: the retry gap was not a pre-existing divergence, it
was introduced two hours earlier by a fix that was itself correct. A performance change
that narrows what a loop looks at can silently delete a behaviour that depended on the
loop being broad.

## Deliberately not ported

`sortOnTopFirst`, which orders requests so content sitting on top of an overlay
translates before the page hidden underneath it. It pays an `elementFromPoint` forced
layout per viewport marker to compute that order. iOS never had that cost, and the
ordering is a preference rather than a correctness property — translation still reaches
everything either way. It stays out until overlay-heavy sites show it is needed, and this
is now the only known intentional difference between the two implementations.
