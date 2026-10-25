2026-10-25

# Experimental Chromium WebView compatibility for EinkBro

Mac.apk now has an optional Chromium Embedded Framework backend for Android
WebView. The feature branch is `feature/chromium-webview`, committed as
`fa4a817` in Mac.apk. EinkBro is the first application used to exercise it.
WKWebView remains the default backend; Chromium is selected explicitly.

The CEF implementation uses the existing JNI WebView bridge and embeds a
native browser view beneath the Android widget canvas. Browser operations
run on the Cocoa thread, Android callbacks return through a Handler, and
resource interception streams responses from background workers. JavaScript
interfaces preserve synchronous results; large messages are chunked around
Chromium's prompt size limit. Document-start scripts are installed before
navigation, with DevTools continuations deferred beyond observer dispatch.
AndroidX discovers only the features implemented by this provider.

Build scripts download a pinned official Apple Silicon CEF distribution,
verify its checksum, and stage an ad-hoc signed development app with CEF
helper processes. The launch script selects Chromium and an isolated data
directory. This does not replace the installed Mac.apk runtime or migrate
existing WebKit sessions. The development bundle still depends on local
build dependencies and a JDK.

Two independent runtime defects prevented EinkBro from working. Its ad
blocker's deserializer scans 27 fields, exceeding the old native sscanf
bridge's fixed 22 output pointers. The scanf bridges now count outputs from
the format and marshal the required register and stack arguments. Settings
rendered but did not accept clicks because the stopped browser's native view
remained visible and intercepted input beneath the canvas. Activity lifecycle
notifications now propagate window visibility through both decor and any
separately installed content tree, hiding native WebViews while covered and
restoring them on return. Interactive testing also removed a harness-only
window activation option that deliberately ordered the window behind others.

Native and Java builds passed. A real APK smoke test covered document-start
ordering, intercepted resources, synchronous JavaScript, Unicode, 24 KB
messages, DOM storage, POST bodies, cookies, and download callbacks. Native
scanf checks exercised 6, 7, 27, and 48 output arguments. A lifecycle regression
check covers nested WebViews and content outside the decor. Strict bundle
signature verification passed. The owner verified live Google browsing;
manual testing verified Settings, Appearance, Back, return to the browser,
and subsequent page input.

This remains experimental. Matching Chromium rendering does not provide full
Android WebView API compatibility. Remaining work includes storage management,
service worker callbacks, message ports, find-on-page, history snapshots,
parts of settings and permissions, popup opener state, and HTTP-origin
semantics for loadDataWithBaseURL. Release packaging, security updates, and
broader app-level verification are still required.
