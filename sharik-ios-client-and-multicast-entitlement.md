2026-08-28

# sharik-ios: the iOS client and Apple's multicast gate

`~/src/sharik-ios` is the SwiftUI port of the minimal Sharik client (device
name, share files/text, receive, history). `Protocol.swift`, `Net.swift` and
the HTTP server come from `sharik-native` nearly line-for-line; iOS specifics
are security-scoped bookmarks for history items (picker URLs are not stable
paths), downloads into the Files-app-visible Documents folder, and listings
addressed by index as on Android.

## What was verified

On the iPhone 16 Pro Max simulator (which uses the Mac's network stack, so
real multicast) with sim-use driving the UI: receive from the Python Sharik
stand-in — discovery, "got it" reply, md5-identical file into Documents —
and sending text picked up by the Lua client. The type-through-IME test
produced garbled text because the Mac's own OhMyBias IME intercepted the
synthetic keystrokes; the round trip itself was byte-faithful.

## The entitlement reality

iOS 14+ refuses multicast joins and broadcast sends without
`com.apple.developer.networking.multicast`, and that capability must be
granted **per team by Apple** before it can appear in any provisioning
profile — development ones included. Xcode fails with "requires approval
from Apple" and explicitly suggests building without the entitlement while
the request is processed. Hence two entitlement files:

- `Sharik.entitlements` (default): multicast on — the real configuration,
  used once Apple grants the capability, and required for the App Store.
- `Sharik-basic.entitlements`: empty — `make device-nomulticast` builds and
  installs on the phone today; UI and HTTP work, discovery datagrams are
  blocked by the OS and surfaced as an in-app error.

The request form (once per team) is
https://developer.apple.com/contact/request/networking-multicast; the README
carries a ready-to-paste justification. The no-multicast build was installed
on the iPhone 17 Pro via devicectl to validate signing and install.
