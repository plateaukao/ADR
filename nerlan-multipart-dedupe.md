2026-07-08

# NerLan: shared multipart builder; reloadIndex reuses loadIndex

Small deduplication pass:

- `OpenAIService.transcribe` and `verifyTranscription` each hand-assembled a multipart/form-data body (about 25 lines each, including a byte-identical nested `field()` helper) and duplicated the request-header setup. A private `MultipartForm` struct now owns the boundary and encoding (`field` / `file` / `finalize`), and `transcriptionRequest(config:buildForm:)` produces the ready-to-send `URLRequest` + body for both callers. The two call sites shrink to their actual differences: which fields they send and which file they attach (a real episode chunk vs. the half-second silent-WAV probe).
- `AIContentStore.reloadIndex` had a copy of `loadIndex`'s decode body; it now calls `loadIndex()` and then refreshes the content-id sets.

No behavior change — the encoded bytes are identical in layout to what both functions produced before.
