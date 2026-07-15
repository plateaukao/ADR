2026-07-08

# WhisperASR: reject oversized API uploads with 413 instead of buffering them

The OpenAI-compatible endpoints read the entire request body into memory (`request.bodyData`), then the multipart parser subdata-copies the file part out of it, and the upload is also staged to a temp file — transiently about 2–3× the upload size in RAM, with no limit on what a client may send. With LAN access enabled, one huge (or malicious, or simply mistaken — think a client posting a screen recording) upload could drive the app into memory pressure.

Uploads are now capped at 1 GB, which comfortably covers hours of audio in any common format:

- When the client declares a `Content-Length` (which every real multipart client does), the request is rejected with `413 Payload Too Large` *before* the body is read — no buffering at all.
- Chunked requests without a length are re-checked after reading, so the response is still a clean 413 rather than an opaque decode failure downstream.

The limit is a constant (`OpenAITranscriptionAPI.maxUploadBytes`); if it ever needs to be user-configurable it can move to UserDefaults alongside the other server settings.
