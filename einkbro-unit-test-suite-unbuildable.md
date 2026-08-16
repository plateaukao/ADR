2026-08-16

# The unit test suite had been unbuildable, so 152 tests were quietly running zero times

## What was broken

`./gradlew test` failed. Not a failing assertion — a *compile* error in the app's
unit test source set:

```
e: OpenAiRepositoryTest.kt:253:32 Unresolved reference 'choices'.
e: OpenAiRepositoryTest.kt:253:48 Unresolved reference 'message'.
e: OpenAiRepositoryTest.kt:255:59 Unresolved reference 'finishReason'.
...
> Execution failed for task ':app:compileDebugUnitTestKotlin'
```

Because it was a compile failure rather than a test failure, nothing in the module
ran. Every test in `app/src/test` was skipped, not just the broken file.

This surfaced only because the user asked whether the tests had been run before an
unrelated WebView fix was committed. They had not been. The honest finding is that
this had nothing to do with that fix — a worktree checked out at the parent commit
produced byte-identical errors — but it also would not have been found for a while
longer, because the gate was not being run at all.

## Root cause

`407f21cab fix(ai): route LLM calls per model to /v1/responses or chat/completions`
changed the shape of a return value:

```kotlin
suspend fun chatWithTools(...): ToolChatOutcome    // was a nullable completion

sealed class ToolChatOutcome {
    data class Success(val completion: ToolChatCompletion) : ToolChatOutcome()
    data class Failure(val message: String) : ToolChatOutcome()
}
```

The point of the new type is that a failed turn carries the API's error text to the
user instead of collapsing to `null`. `OpenAiRepositoryTest` was never updated, so
it went on calling `result!!.choices` on a sealed class that has no such member.

`ca6f05bac` had added 152 unit tests shortly before. The combination is the part
worth remembering: the repo looked well covered, and was in fact running nothing.
A red suite that no one executes is worse than no suite, because it invites the
next person to assume they are covered.

## The interesting half of the fix

`parses tool call response` was mechanical — unwrap `ToolChatOutcome.Success`.

The other two were not. They were named `returns null on http error` and
`returns null on malformed json`, written against the old contract where failure
*was* `null`:

```kotlin
val result = repository.chatWithTools(...)
assertNull(result)
```

Under the new signature that code compiles perfectly well — `result` is simply a
non-null `ToolChatOutcome`, and `assertNull` on it is a permanently false
assertion dressed as a passing test. Had those two lines been the only breakage,
the suite would have gone green while testing nothing. They were saved from that
fate only by sharing a file with the lines that genuinely failed to compile.

So they were rewritten to assert what the code now does, and to pin the behaviour
that motivated `407f21cab` in the first place:

```kotlin
val message = (result as ToolChatOutcome.Failure).message
assertTrue(message, message.contains("400"))
assertTrue(message, message.contains("bad request"))
```

If the failure text ever regresses back to something opaque, that now fails
loudly.

## Result

`./gradlew test` is green: 230 tests, 0 failures, 0 errors.

## Correction: CI was already running the tests

An earlier draft of this document claimed nothing gated CI on the test suite.
That was wrong, and asserted without checking. `.github/workflows/` has always had
a `test` job running `./gradlew testDebugUnitTest lintDebug`, and it behaved
perfectly — it went red at `407f21cab`, the exact commit that broke the suite, and
stayed red for `330e8a58b` and `205070456` before going green again at the repair.

The signal existed. Nobody read it.

The real hole was next to it: the `build` job carried no `needs:`, so it ran in
parallel with `test` rather than after it. All three red commits still compiled,
signed, and published a rolling `snapshot` pre-release to the Releases page. A
broken suite blocked nothing and shipped artifacts anyway.

Fixed in `cad8fadda` by adding `needs: test` to the build job, so the release
build only runs on a green suite. Worth noting what this does *not* fix: CI
failing is still only visible to someone who looks at it. The gate now stops bad
snapshots from shipping, but it does not make a red `main` noticeable.
