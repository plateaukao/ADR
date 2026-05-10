# EinkBro BrowserController Architecture Analysis & Refactoring

## Problem

`BrowserController` is a god interface with **83 methods** across 17 responsibility areas. Every consumer receives the full 83-method surface even when it only needs 2-3 methods. This creates tight coupling, makes unit testing impossible, and hides actual dependencies.

## Root Cause

The original `BrowserController` (inherited from Ninja Browser, ~14 methods) grew to 83 methods as features were added (translation, TTS, AI chat, e-ink gestures, split screen, EPUB). A prior refactoring (commit `605239a7`) extracted sub-interfaces (`TabController`, `NavigationController`, `ViewStateController`, `TranslationController`, `TtsController`, `InputController`) and delegate classes, but:

1. `BrowserController` still extends all 6 sub-interfaces, so consumers still get the full surface
2. `InputController` alone has 38 methods mixing 8+ unrelated concerns
3. No consumer actually uses the narrow sub-interface types
4. Unsafe `activity as BrowserController` casts exist in `ToolbarActionHandler` and `MenuActionHandler`
5. `EBWebView` holds a public mutable `var browserController: BrowserController?` but only calls 7 methods

## Survey: How Other WebView Browsers Handle This

| Project | Pattern | Interface Size | Key Insight |
|---------|---------|----------------|-------------|
| **Ninja** (ancestor) | Single flat `BrowserController` | ~14 methods | Original god-interface |
| **FOSS Browser** | Trimmed flat `BrowserController` | ~8 methods | Fewer features = smaller interface |
| **Lightning Browser** | MVP Contract (View/Model/Navigator) | ~43 across 3 interfaces | Separates rendering, data, navigation |
| **DuckDuckGo** | Layered MVVM + Command pattern | Distributed across ViewModels | Two ViewModel scopes; `WebViewClientListener` decouples WebView |
| **Firefox/Fenix** | Redux-like Store + Middleware | No controller interface at all | Unidirectional data flow; most scalable |
| **GeckoView** | Focused Delegates | ~6 small interfaces | Purest ISP; each concern is its own tiny interface |

## Current Consumer Analysis

| Consumer | Methods Used | Could Accept |
|----------|-------------|--------------|
| `EBWebView` | `updateProgress`, `updateTitle`, `addHistory`, `loadInSecondPane`, `resetTranslateUI`, `showTranslation`, `handleKeyEvent`, `isActionModeActive`, `dismissActionMode` | Narrow callback interface (~7 methods) |
| `Album` | `isCurrentAlbum`, `isAtTop`, `refreshAction`, `jumpToTop`, `showAlbum`, `removeAlbum` | `TabController + NavigationController` subset |
| `GestureHandler` | 23 methods across Tab, Navigation, Input, ViewState | Composite of sub-interfaces |
| `KeyHandler` | 14 methods + `as? Context` cast | Composite of sub-interfaces |
| `ToolbarActionHandler` | ~35 methods (nearly everything) | Full `BrowserController` (justified) |
| `MenuActionHandler` | ~25 methods | Full `BrowserController` (justified) |
| `ChatWebInterface`/`JsHelper` | `addNewTab` only | Lambda `(String) -> Unit` |
| `TouchAreaViewController` | None directly (passes to GestureHandler) | Same as GestureHandler |
| `AiChatDelegate` | `activity as BrowserController` for hidden WebView | Narrow callback |
| `ContextMenuDelegate` | `activity as BrowserController` for hidden WebView | Narrow callback |

## Solution

### Phase 1: Make Sub-Interfaces Work (narrowing consumer dependencies)

- Create `WebViewCallback` interface for `EBWebView` (~7 methods) instead of full `BrowserController`
- Create `AlbumCallback` for `Album` (~6 methods)
- `GestureHandler` accepts composite of only needed sub-interfaces
- `KeyHandler` accepts composite of only needed sub-interfaces
- `JsHelper` accepts `(String) -> Unit` lambda for `addNewTab`
- `AiChatDelegate` and `ContextMenuDelegate` hidden WebViews use narrow callback

### Phase 2: Break Up InputController

Split 38-method `InputController` into focused interfaces:
- `KeyInputController` — key events and key sending (7 methods)
- `FileController` — file chooser, EPUB, archive, save (6 methods)
- `SearchController` — search panel, text search (3 methods)
- `ShareController` — shortcut, remote, share, instapaper (5 methods)
- `TouchConfigController` — touch turn page, touch area (4 methods)
- `AiFeatureController` — summarize, chat, AI menu (3 methods)
- `DialogController` — fast toggle, menu, rotate, receive link (4 methods)
- Remaining in `InputController` — onLongPress, focusOnInput, showTocDialog, updatePageInfo, action mode, audio (6 methods)

## Key Files

- `app/src/main/java/info/plateaukao/einkbro/browser/BrowserController.kt` — interface definition
- `app/src/main/java/info/plateaukao/einkbro/activity/BrowserActivity.kt` — sole implementor
- `app/src/main/java/info/plateaukao/einkbro/view/EBWebView.kt` — tightest consumer
- `app/src/main/java/info/plateaukao/einkbro/view/Album.kt` — tab display consumer
- `app/src/main/java/info/plateaukao/einkbro/view/handlers/GestureHandler.kt` — gesture mapping
- `app/src/main/java/info/plateaukao/einkbro/view/handlers/ToolbarActionHandler.kt` — toolbar dispatch
- `app/src/main/java/info/plateaukao/einkbro/view/handlers/MenuActionHandler.kt` — menu dispatch
- `app/src/main/java/info/plateaukao/einkbro/activity/KeyHandler.kt` — keyboard handler
- `app/src/main/java/info/plateaukao/einkbro/browser/ChatWebInterface.kt` — AI chat JS bridge

## Lessons Learned

- Interface Segregation Principle must be applied at the consumer site, not just at definition — splitting into sub-interfaces has no effect if every consumer still holds the composite type.
- GeckoView's delegate pattern (each concern gets its own tiny interface) is the gold standard for WebView coordination.
- The existing delegate extraction was the right architectural move — the remaining work is shrinking the interface surface that consumers see.
