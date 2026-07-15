# Native macOS App for Sony Digital Paper (DPT-RP1 / CP1 / Quaderno)

## Summary

`dpt-rp1-py` is a Python CLI + library that controls Sony Digital Paper devices
(DPT-RP1, DPT-CP1, Fujitsu Quaderno) over their local HTTP(S) API, replacing
Sony's discontinued Digital Paper App. It works, but it's a terminal tool: every
action is a command, pairing requires copy-pasting a PIN at a prompt, browsing
means re-running `list-documents`, and uploads are one file at a time.

This project builds a **native macOS app** (`~/src/sony-dpt-rp1-mac-app`) that
exposes the same capabilities through a real UI: a Finder-like document browser,
drag-and-drop upload, a guided pairing flow, and settings panels — so a
non-technical user can manage their device without the command line.

Locked-in decisions:
- **Backend:** reimplement the protocol natively in Swift (no Python dependency).
- **v1 scope:** core document management, device status, Wi-Fi & system config,
  and sync & templates.
- **Distribution:** Developer ID **signed + notarized**, hardened runtime.

## Approach

A standalone project split into a reusable protocol framework + a SwiftUI app, so
the protocol is unit-testable against the Python reference outputs.

```
sony-dpt-rp1-mac-app/
├── project.yml                      # XcodeGen spec (reproducible .xcodeproj)
├── DigitalPaperKit/                 # protocol framework (no UI)
│   ├── Crypto/                      # the risky part — see "Crypto port"
│   ├── DigitalPaperClient.swift     # async REST client (8080 reg + 8443 api)
│   ├── Discovery.swift              # NWBrowser mDNS
│   ├── Registration.swift           # the pairing handshake
│   ├── CredentialStore.swift        # Keychain + import from existing dat files
│   └── Models/                      # Codable structs
├── DigitalPaper/                    # SwiftUI app
│   ├── DigitalPaperApp.swift
│   ├── ViewModels/
│   ├── Views/
│   ├── Info.plist
│   └── DigitalPaper.entitlements
└── DigitalPaperKitTests/            # crypto vectors + model decoding
```

**Layering.** `DigitalPaperKit` is pure protocol/crypto/networking (`async/await`,
no `import SwiftUI`); a single `actor DigitalPaperClient` owns the `URLSession`,
session cookie, and connection state. The app layer is `@MainActor`
`ObservableObject` view models that call into the actor; SwiftUI views observe them.

### Protocol reference (verified against source)

Registration over **HTTP :8080**, authenticated API over **HTTPS :8443**
(self-signed cert — must disable TLS validation). Root folder is `Document/`.

- **Discovery:** mDNS `_digitalpaper._tcp.local.` and `_dp_fujitsu._tcp.local.`;
  resolve IPv4 then `GET http://addr:port/register/information` → serial, model.
- **Session auth:** `GET /auth/nonce/{client_id}` → sign nonce RSA-SHA256 →
  `PUT /auth {client_id, nonce_signed}` → store `Credentials` cookie (parsed
  manually; the jar can't read the device's `Set-Cookie` format —
  `dptrp1.py:350-360`).
- **Documents:** `GET /documents2?entry_type=all` (flat, about 1300 cap → recursive
  `/folders/{id}/entries` fallback); `GET /documents/{id}/file`; `POST
  /documents2` then `PUT /documents/{id}/file`; `PUT /documents/{id}` (move/
  rename); `POST /documents/{id}/copy`; `DELETE /documents/{id}`; `GET
  /resolve/entry/path/{urlencoded}`.
- **Folders:** `POST /folders2`; `GET /folders/{id}/entries`; `DELETE /folders/{id}`.
- **Status:** `/system/status/{storage,battery,firmware_version,mac_address}`.
- **Wi-Fi:** `GET/PUT /system/configs/wifi`; `GET
  /system/configs/wifi_accesspoints`; `POST
  /system/controls/wifi_accesspoints/scan`; `PUT
  /system/controls/wifi_accesspoints/register` (SSID base64); `DELETE
  /system/configs/wifi_accesspoints/{ssid}/{security}`.
- **System config:** `GET /system/configs/`; `PUT /system/configs/{key}`.
- **Templates:** `GET /viewer/configs/note_templates`; `POST` + `PUT .../{id}/file`;
  `DELETE .../{id}`.
- **Display on device:** `PUT /viewer/controls/open2 {document_id, page}`.
- **Screenshot:** `GET /system/controls/screen_shot` (PNG).

### Crypto port (the high-risk piece — `dptrp1.py:178-348`, `1223-1262`)

Each primitive maps to a system framework; only big-integer modular
exponentiation needs a package (**attaswift/BigInt** via SPM).

| Python | Swift |
|---|---|
| `DiffieHellman` group 14 (RFC 3526, 2048-bit), `a`=32 random bytes, `ya=g^a mod p` | BigInt `power(_:modulus:)`; secure-random `a` |
| `PBKDF2(zz, n1+mac+n2, 10000, SHA256).read(48)` | `CCKeyDerivationPBKDF` `kCCPRFHmacAlgSHA256` |
| `HMAC(authKey, SHA256)` | CryptoKit `HMAC<SHA256>` |
| `AES.MODE_CBC` (key = `keyWrapKey`, **16 bytes → AES-128**) | CommonCrypto `CCCrypt` |
| `RSA.generate(2048, e=65537)` | `SecKeyCreateRandomKey` |
| `httpsig.Signer(rsa-sha256).sign(nonce)` | `SecKeyCreateSignature` `.rsaSignatureMessagePKCS1v15SHA256`, base64 |
| `wrap`/`unwrap` (HMAC kwa[:8], pad, **iv appended at end**) | byte-exact reimplementation |

**Byte-layout gotchas to replicate exactly:**
- `ya = b"\x00" + ya.to_bytes(256,"big")` (257 bytes); `yb`, `zz` are 256 bytes.
- `keyWrapKey` is 16 bytes → **AES-128**-CBC, not 256.
- `wrap()`: `ciphertext = AES-CBC(pad(data + kwa[:8]))`, output = `ciphertext + iv`
  (IV is a **trailing** 16 bytes), PKCS#7 manual pad.
- HMAC chaining order in each message (m2..m6) must match the source line-for-line.
- **Public-key PEM:** Python `publickey().exportKey("PEM")` emits
  SubjectPublicKeyInfo (`-----BEGIN PUBLIC KEY-----`). SecKey exports PKCS#1; must
  wrap into SPKI DER before PEM so the device accepts it. Private key kept as
  PKCS#1 PEM (`BEGIN RSA PRIVATE KEY`) for signing.

**Port verification:** a script runs the Python `wrap`/`unwrap`/PBKDF2/HMAC with
fixed inputs and dumps hex vectors; the Swift implementations must reproduce them
byte-for-byte in `DigitalPaperKitTests` before touching a device.

### Networking
- `DigitalPaperClient` actor holds one `URLSession` with a delegate returning
  `.useCredential(URLCredential(trust:))` for the device host (self-signed TLS).
- Disable automatic cookie handling; set the `Credentials` cookie header manually.
- Two base URLs: `http://addr:8080` (registration), `https://addr:8443` (api);
  handle IPv6/USB link-local (bracketed host, port-omission case).
- Multipart upload for `PUT /documents/{id}/file` with URL-encoded filename.

### Credentials
- Store client-id + private key in the **Keychain**, keyed per device serial
  (multi-device). On first launch, offer to **import existing** credentials from
  `~/.config/dpt/{deviceid,privatekey}.dat` and the Sony app paths
  (mirrors `find_auth_files()` — `dptrp1.py:40-73`) so existing CLI users skip pairing.

### UI (SwiftUI)
- `NavigationSplitView`: sidebar device card (name/model/serial, battery, storage
  bar) + section links (Documents, Wi-Fi, System, Templates, Sync).
- **Pairing sheet:** live mDNS device list → Pair → instructions → PIN entry →
  progress → success (replaces the CLI prompt).
- **Documents:** folder outline + file table; toolbar Upload/New Folder/Download/
  Delete/Rename/Move/"Open on device"; drag-and-drop upload, drag-out download;
  background transfer progress (replaces `tqdm`).
- **Wi-Fi / System / Templates panes** as described above; screenshot viewer.
- **Sync pane:** local↔remote folder pick, planned changes preview, then run
  (port `dptrp1.py:568` `sync` diff logic; checkpoint in app support, not `.sync`).

### Distribution
- `.xcodeproj` generated from `project.yml` via **XcodeGen**.
- Hardened runtime, **non-sandboxed** Developer ID build; entitlements
  `network.client` + `network.server` (mDNS). `Info.plist`:
  `NSLocalNetworkUsageDescription`, `NSBonjourServices` (both types), ATS
  exception for the device's local self-signed HTTPS. Release step: sign +
  `notarytool` notarize + staple.

### Build sequence
1. Scaffold (XcodeGen, framework + app + tests, SPM BigInt).
2. **Crypto layer + tests first** — validate against Python vectors; nothing works
   until this is byte-exact.
3. `DigitalPaperClient` (TLS bypass, cookie, nonce sign, `/ping`).
4. Discovery + pairing end-to-end.
5. Document models + browser.
6. Status, Wi-Fi, System, Templates panes.
7. Sync engine + pane.
8. Polish, sign/notarize.

## Trade-offs

- **Native Swift vs. wrapping Python.** Chose native: best UX, no bundled runtime,
  clean notarization. Cost is faithfully porting the pairing crypto — mitigated by
  byte-for-byte test vectors generated from the Python reference.
- **Non-sandboxed Developer ID vs. App Store sandbox.** Chose non-sandboxed: needs
  arbitrary file access (upload/download anywhere) and unrestricted local network.
  Trade-off is no Mac App Store distribution in v1.
- **BigInt dependency.** macOS has no built-in arbitrary-precision integers; the
  2048-bit DH modexp needs attaswift/BigInt. A small, well-scoped dependency rather
  than hand-rolling modular exponentiation.
- **Keychain vs. flat `.dat` files.** Keychain is the right home for a private key
  in a notarized app; we still import the CLI's flat files so existing users don't
  re-pair.

## Key Files

- `dpt-rp1-py/dptrp1/dptrp1.py:178-348` — pairing handshake (reference to port).
- `dpt-rp1-py/dptrp1/dptrp1.py:350-360` — session auth / nonce signing / cookie.
- `dpt-rp1-py/dptrp1/dptrp1.py:1223-1262` — `wrap`/`unwrap` key-wrap helpers.
- `dpt-rp1-py/dptrp1/dptrp1.py:40-73` — `find_auth_files()` credential discovery.
- `dpt-rp1-py/dptrp1/pyDH.py` — Diffie-Hellman group 14 parameters.
- `sony-dpt-rp1-mac-app/DigitalPaperKit/Crypto/*` — Swift crypto port (new).
- `sony-dpt-rp1-mac-app/DigitalPaperKit/{DigitalPaperClient,Registration,Discovery,CredentialStore}.swift` — protocol layer (new).
- `sony-dpt-rp1-mac-app/DigitalPaper/Views/*` — SwiftUI UI (new).
- `sony-dpt-rp1-mac-app/project.yml` — XcodeGen project spec (new).
