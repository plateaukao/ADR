2026-08-02

# CalliPlus 4.8.1: first release on the AGP 9 toolchain

Version bump (40800 → 40801) and Play production release carrying the two
build-infrastructure commits prompted by the Play Console optimization
warnings: [R8 optimizing mode + optimized resource
shrinking](calliplus-r8-optimization.md) and the [AGP 9.1.1 / Gradle 9.3.1 /
built-in Kotlin upgrade](calliplus-agp9-upgrade.md). No app-code changes
beyond the switch→if/else migration that shipped inside the first of those
commits.

Published with `./gradlew publishBundle --track production` — the first
release through Gradle Play Publisher 4.0.0 (bumped for AGP 9
compatibility), confirming the new GPP major works end-to-end. A dry-run
had earlier validated everything except the final commit step: publishing
the still-current 40800 exercised bundle build, service-account auth, and
upload, with Play correctly rejecting the duplicate version code.

Binary impact versus the AGP 8 build of the same code (measured with
apkanalyzer before release): dex 27.8 KB smaller with 97 fewer method
references (newer R8, default repackaging, Kotlin 2.2 stdlib), partially
offset by 21 KB more Kotlin stdlib metadata; resources byte-identical;
net ~4 KB smaller download. Functionally verified on emulator before
publishing.
