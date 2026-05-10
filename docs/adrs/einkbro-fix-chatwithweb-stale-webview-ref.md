# Fix: chatWithWeb uses stale webview ref after addAlbum creates new tab

## Problem

After the major architecture refactoring (605239a7) that extracted delegates from BrowserActivity, the "Chat With Web" and "Page AI Actions" (in NewTab display mode) stopped working. Triggering these features would create a new tab but the AI page would not initialize properly.

## Root Cause

When `chatWithWeb()` was extracted into `AiChatDelegate`, the code captured `ebWebView` as a local variable via `webViewProvider()` at the start of the function. After `addAlbum("Chat With Web", "")` created a new tab and updated `BrowserActivity.ebWebView` to the new webview, the local variable still pointed to the **old** webview. This caused:

1. `setOnPageFinishedAction` to be registered on the old tab's webview (never fires on the new tab)
2. `setupAiPage` was called on the new webview via a separate `webViewProvider()` call, but the callback to run the GPT action was on the wrong webview

In the original `BrowserActivity`, `ebWebView` was a class property that got updated by the `showAlbum()` callback, so every access after `addAlbum()` automatically got the new webview.

## Solution

After `addAlbum()`, get a fresh reference with `val newWebView = webViewProvider()` and use that consistently for both `setOnPageFinishedAction` and `setupAiPage`.

## Key Files

- `app/src/main/java/info/plateaukao/einkbro/activity/delegates/AiChatDelegate.kt` — fixed stale reference in `chatWithWeb()`

## Lessons Learned

- When extracting methods that use mutable class properties into delegates with lambda providers, be careful about when the lambda is evaluated. A local variable captures a snapshot; calling the lambda again after state-changing operations gets the updated value.
- The `addAlbum()` -> `showAlbum()` -> `setEbWebView()` chain updates `BrowserActivity.ebWebView`, so any code that needs the new webview must call `webViewProvider()` **after** `addAlbum()` returns.
