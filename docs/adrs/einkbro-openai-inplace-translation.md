# EinkBro: OpenAI/Gemini In-Place Translation Mode

## Problem

EinkBro's "Google in-place" translation mode injects Google's JavaScript library to replace page text directly in the DOM. However, there was no equivalent for OpenAI or Gemini -- users who preferred AI-powered translation had to use the "by paragraph" mode, which appends translations alongside the original text rather than replacing it. Additionally, `OPENAI_BY_PARAGRAPH` and `GEMINI_BY_PARAGRAPH` were defined in the `TranslationMode` enum but never wired up in `BrowserActivity.translate()`, silently doing nothing when selected.

A secondary UX issue: when long-pressing the translate toolbar icon to change the translation mode, the new mode was not applied immediately -- the user had to tap the icon again to trigger translation.

## Root Cause

1. The existing paragraph-by-paragraph translation pipeline (`translate_by_paragraph.js` + `text_node_monitor.js` + `JsWebInterface`) already supported OpenAI/Gemini translation via `JsWebInterface.translateWithOpenAi()` and `translateWithGemini()`. But the JavaScript callback (`myCallback`) only knew how to **append** translations to sibling `<p>` elements -- it had no mode for **replacing** the original text.

2. `BrowserActivity.translate()` used `else -> Unit` as a catch-all, silently ignoring `OPENAI_BY_PARAGRAPH` and `GEMINI_BY_PARAGRAPH` modes.

3. `TranslationConfigDlgFragment` ignored the `translateDirectly` parameter passed from toolbar/menu long-press handlers, only applying translation on mode change if the site was already marked for translation.

## Original Plan

### Context

EinkBro has a "Google in-place" translation mode that injects Google's JS library to replace page text directly. The goal was an equivalent "OpenAI in-place" mode that replaces page text using OpenAI translations instead of Google's.

**Key finding**: The existing paragraph-by-paragraph infrastructure (`translate_by_paragraph.js` + `text_node_monitor.js` + `JsWebInterface`) already supports OpenAI translation. The difference is that paragraph mode **appends** translations alongside the original, while in-place mode should **replace** the original text.

### Approach

Reuse ~95% of the existing paragraph translation pipeline. The only change is in the JavaScript callback: instead of writing to a sibling `<p>`, replace the original element's text content. This is controlled via a `window._translateInPlace` flag set from Kotlin before loading the monitor script.

### Translation Flow (In-Place)

```
User selects "OpenAI in-place" -> BrowserActivity.translate(OPENAI_IN_PLACE)
  -> EBWebView.translateByParagraphInPlaceReplace()
    -> set window._translateInPlace = true
    -> translate_by_paragraph.js (scans DOM, marks .to-translate blocks)
    -> text_node_monitor.js (IntersectionObserver -> androidApp.getTranslation())
      -> JsWebInterface -> translateWithOpenAi() [existing code, unchanged]
      -> myCallback -> replaces element text (instead of appending)
```

### Toggle/Undo
- `translate_by_paragraph.js` already saves `document.originalInnerHTML` before modifications -- toggle restores original DOM
- `clearTranslationElements()` already restores via `document.originalInnerHTML` -- works for in-place too

## Solution

### 1. New translation modes (ConfigManager.kt, strings.xml)
- Added `OPENAI_IN_PLACE` and `GEMINI_IN_PLACE` to `TranslationMode` enum
- Added corresponding string resources

### 2. In-place replacement via JS flag (text_node_monitor.js)
- Modified `myCallback` to check `window._translateInPlace` flag
- When true: stores original `innerHTML` in `data-original-html` attribute, then uses TreeWalker to replace only text nodes -- preserving links, colors, styles, and other inline elements. For elements with multiple text nodes, translated text is distributed proportionally across them to maintain DOM structure.
- When false: existing behavior (writes to sibling `<p>` element)
- Updated IntersectionObserver to use `data-original-html` attribute (instead of sibling `<p>` emptiness check) to detect already-translated elements in in-place mode

### 3. New EBWebView method (EBWebView.kt)
- Added `translateByParagraphInPlaceReplace()`: sets `window._translateInPlace = true`, then loads existing JS files
- Updated `clearTranslationElementsJs` to reset the flag

### 4. Wiring in BrowserActivity and TwoPaneController
- Added all missing cases in `BrowserActivity.translate()` -- `OPENAI_IN_PLACE`, `GEMINI_IN_PLACE`, plus fixed the bug for `OPENAI_BY_PARAGRAPH` and `GEMINI_BY_PARAGRAPH`
- Added `translateInPlaceReplace()` helper in both `BrowserActivity` and `TwoPaneController`

### 5. Direct apply on mode change (TranslationConfigDlgFragment.kt, BrowserActivity.kt)
- Passed `translateDirectly` flag through to `TranslationConfigDlgFragment`
- When `translateDirectly` is true, selecting a mode immediately triggers translation and dismisses the dialog

## Key Files

- `app/src/main/assets/text_node_monitor.js` -- JS callback with in-place replacement logic
- `app/src/main/java/.../view/EBWebView.kt` -- New `translateByParagraphInPlaceReplace()` method
- `app/src/main/java/.../activity/BrowserActivity.kt` -- Mode routing and `translateInPlaceReplace()` helper
- `app/src/main/java/.../preference/ConfigManager.kt` -- `TranslationMode` enum additions
- `app/src/main/java/.../view/viewControllers/TwoPaneController.kt` -- Two-pane mode support
- `app/src/main/java/.../view/dialog/compose/TranslationConfigDlgFragment.kt` -- Direct apply on mode change
- `app/src/main/res/values/strings.xml` -- New string resources

## Lessons Learned

- The existing paragraph translation pipeline was well-abstracted: a single JS flag (`window._translateInPlace`) in the callback was sufficient to switch between append and replace behavior, reusing all DOM scanning, IntersectionObserver, caching, and API routing code unchanged.
- Kotlin's exhaustive `when` on enums (without `else ->`) is preferable -- the catch-all `else -> Unit` silently hid the fact that `OPENAI_BY_PARAGRAPH` and `GEMINI_BY_PARAGRAPH` were never wired up.
- UI parameters like `translateDirectly` should be threaded through to the dialog that needs them rather than ignored at intermediate layers.
