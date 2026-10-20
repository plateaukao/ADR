2026-10-20

# Enroll EinkBro in Anthropic OSS Scanner

EinkBro's OSS Scanner application adds the browser to Anthropic's opt-in program
for periodic security audits. A browser routinely processes attacker-controlled
pages and files while retaining private browsing data and optional service
credentials, making its web-to-native boundaries a useful audit target.

The enrollment is submitted to `anthropics/oss-scanner` under
`projects/einkbro/`. It targets `plateaukao/einkbro` on `main`, uses Daniel Kao's
public maintainer email for private findings, and links the project documentation.
The Dockerfile and threat model live alongside the application, so the EinkBro
source repository needs no enrollment-only change.

The build environment installs Java 17, Android SDK 36, NDK 27.0.12077973 and
CMake 3.22.1. It builds debug APKs without private release signing or Play
credentials and caches Gradle and JavaScript test dependencies for offline use.
The threat model prioritizes WebView interfaces, userscript API permissions,
navigation and Android intents, imports and backup transfer, OAuth handling, and
native ad-blocking integration. Findings should identify a reachable app-level
entry point and include a minimal reproducer and focused patch where practical.

Anthropic reviews eligibility and maintainer authorization before accepting the
application. Submission does not mean that enrollment has been accepted or that
a scan has completed.

The enrollment schema validator passes. The Android debug build and JVM unit
tests passed in Docker. The existing translation jsdom suite on the submitted
revision reports 9 failures and 4 passing tests, including unsupported
`document.elementFromPoint` and mutation-observer teardown errors. Those baseline
failures are recorded in the threat model and logged without aborting the image
build, following Anthropic's template guidance. Android compilation and JVM test
failures still abort the build.
