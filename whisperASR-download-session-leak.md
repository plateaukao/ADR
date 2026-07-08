2026-07-08

# WhisperASR: invalidate the URLSession when a model download completes

Every `ModelDownloader.startDownload()` created a fresh `URLSession(configuration:delegate:delegateQueue:)` and never invalidated it. A `URLSession` retains its delegate strongly until it is invalidated, so each download attempt — including every retry after a network failure and every cancel — leaked a session + `DownloadDelegate` pair (and the session's dispatch queues) for the app's lifetime.

`urlSession(_:task:didCompleteWithError:)` is the one callback guaranteed to fire exactly once per download task in all terminal states — success, failure, and cancellation (a cancel-with-resume-data surfaces as `.cancelled` there). Calling `session.finishTasksAndInvalidate()` at the end of that callback releases the session deterministically in every path, without touching the resume-data handling that lives in the same flow.
