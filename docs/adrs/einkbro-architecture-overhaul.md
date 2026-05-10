# EinkBro Architecture Overhaul

## Problem
BrowserActivity was a 2682-line god object with 178 functions. EBWebView mixed concerns at 1301 lines. ViewModels used service locator pattern (KoinComponent) instead of proper DI. Two separate database technologies coexisted (Room + raw SQLite). GlobalScope was used in 16 places causing potential coroutine leaks. BrowserController was a 60-method monolithic interface. Zero unit tests existed.

## Root Cause
Organic growth over time without architectural guardrails. Features were added directly to BrowserActivity and EBWebView as the fastest path, creating tight coupling and making the codebase hard to maintain, extend, and test.

## Solution
Seven-phase refactoring executed in a single commit:

1. **Extract 6 delegates from BrowserActivity** (2682->1172 lines, -56%): FullscreenDelegate, ActionModeDelegate, ContextMenuDelegate, InputBarDelegate, AiChatDelegate, IntentDispatchDelegate
2. **Split BrowserController** into 6 focused sub-interfaces: TabController, NavigationController, ViewStateController, TranslationController, TtsController, InputController
3. **Replace all GlobalScope** with app-scoped CoroutineScope via Koin DI
4. **Fix ViewModel DI**: 9 ViewModels converted to constructor injection with Koin viewModel DSL
5. **Migrate RecordDb to Room**: Created 4 entities, 2 DAOs, RecordRepository; deleted RecordDb/RecordHelper/RecordUnit
6. **Extract EBWebView helpers** (1301->881 lines, -32%): WebViewReaderHelper, WebViewTranslationHelper, WebViewNavigationHelper
7. **Add test infrastructure** with JUnit4, MockK, Turbine + 20 initial unit tests

## Key Files
- `app/src/main/java/.../activity/BrowserActivity.kt` - reduced from 2682 to 1172 lines
- `app/src/main/java/.../activity/delegates/` - 6 new delegate files
- `app/src/main/java/.../browser/BrowserController.kt` - split into 6 sub-interfaces
- `app/src/main/java/.../view/EBWebView.kt` - reduced from 1301 to 881 lines
- `app/src/main/java/.../view/WebView{Reader,Translation,Navigation}Helper.kt` - 3 new helpers
- `app/src/main/java/.../database/{HistoryRecord,WhitelistDomain,JavascriptDomain,CookieDomain}.kt` - Room entities
- `app/src/main/java/.../database/{HistoryDao,DomainListDao,RecordRepository}.kt` - Room DAOs + repository
- `app/src/main/java/.../EinkBroApplication.kt` - updated Koin module with viewModel DSL + app scope
- `app/src/test/` - new test directory with 3 test files

## Lessons Learned
- TtsManager was instantiated before Koin started, so `by inject()` for CoroutineScope caused a crash. Fix: pass scope as constructor parameter instead.
- EBWebView's `computeVerticalScrollRange()` is `protected` in WebView, so extracted helpers need public wrapper methods on EBWebView.
- Delegate pattern (passing lambdas to delegate constructors) works well for breaking up god activities while keeping the activity as orchestrator.
- Constructor injection for ViewModels requires `koin-android` dependency (not just `koin-android-compat`).
