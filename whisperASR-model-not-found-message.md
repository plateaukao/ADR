2026-07-08

# WhisperASR: clean up the model-not-found error message

When no whisper model was on disk, the failure state in the detail view showed:

> Script not found at: Model not found at: /Users/…/ggml-model.bin
>
> Download a model in Settings → Speech Recognition Models.

The double-prefixed nonsense came from history: the app once shelled out to a Python transcription script, and `TranscriptionError.scriptNotFound(path)` rendered as `"Script not found at: \(path)"`. When the whisper.cpp C API replaced the script, the missing-model check reused that case with a full sentence as the payload, so `errorDescription` wrapped one message in another.

The case is now `modelNotFound(String)` and its `errorDescription` returns the message as-is — the throw site already composes the complete, actionable text. Two leftovers from the Python era went with it: the unused `TranscriptionError.parseError` case and the stale "Transcription Result (from Python script JSON)" comment in `Models.swift`.
