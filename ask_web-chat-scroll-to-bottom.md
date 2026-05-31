# ask_web — Scroll-to-bottom button during chat streaming

## Summary

In chat mode, a streaming response previously kept the messages container
pinned to the bottom on every chunk. If the user scrolled up to read earlier
content mid-generation, the next chunk yanked them back down, making it
impossible to review prior text until generation finished.

Now, scrolling up during generation stops the auto-scroll and surfaces a
circular scroll-to-bottom button. The view stays where the user left it.
Clicking the button (or manually scrolling back near the bottom) resumes
auto-scroll.

## Approach

The behavior is driven by a single `autoScroll` flag plus the existing
`isLoading` flag:

- A `scroll` listener on the messages container recomputes `autoScroll` from
  an `isNearBottom()` check (40px threshold). Scrolling away sets it false;
  scrolling back near the bottom re-enables it.
- `handleStreamChunk` only calls `scrollToBottom()` when `autoScroll` is true;
  otherwise it just refreshes the button visibility.
- `updateScrollButton()` shows the button only when `isLoading && !autoScroll`,
  so it never appears outside of an active stream. It is reset on stream
  end/error and when a new message is sent (`autoScroll` forced back to true).

The button lives inside `.chat-main` (made `position: relative`) and is
absolutely positioned just above the input area, centered, with a fade/slide-in
`.visible` state.

A threshold (rather than exact-bottom) matters because markdown re-rendering on
each chunk changes `scrollHeight`, so an exact equality check would flicker.

## Trade-offs

- The 40px threshold is a heuristic; very large single chunks could in theory
  land the user just outside it, but in practice token-by-token streaming keeps
  movement small.
- Button visibility is recomputed on every chunk via `updateScrollButton()`
  rather than only on scroll events — simpler and cheap, at the cost of a
  redundant class toggle per chunk while scrolled away.

## Key Files

- `chat.js` — `autoScroll` flag, `isNearBottom`/`scrollToBottom`/
  `updateScrollButton` helpers, scroll + button listeners, gated auto-scroll in
  `handleStreamChunk`, resets in send/end/error paths.
- `chat.html` — `#scrollToBottom` button markup inside `.chat-main`.
- `chat.css` — `.scroll-to-bottom` styling and `.chat-main { position: relative }`.
