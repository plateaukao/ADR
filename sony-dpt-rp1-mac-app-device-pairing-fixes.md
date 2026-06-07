# Digital Paper macOS — Fixes Found During Real-Device Pairing

## Problem

The native macOS app built cleanly and passed all crypto unit tests, but the
first attempts to pair with a real Sony DPT-CP1 failed at successive stages:

1. `HTTP -1: Bad URL /register/information`
2. `The data couldn't be read because it isn't in the correct format`
3. `HTTP 403: Bad parameters for registration process` (after the PIN + cert step)
4. `Failed to decode EntryList` (after pairing succeeded, when listing documents)

Each error unblocked the next, so they were diagnosed and fixed in sequence.

## Root Cause

1. **IPv6 URL handling.** The device was connected over USB, which exposes it at
   a *link-local IPv6* address (`fe80::aa1d:16ff:fe03:464d%en1`). URLs were built
   by string concatenation (`http://\(host):8080`). For IPv6 the host must be
   bracketed (`http://[fe80::…]:8080`), and the zone id (`%en1`) — required to
   route link-local traffic — was being stripped during discovery. The
   unbracketed URL made `URL(string:)` return nil → "Bad URL".

2. **Empty-body JSON parse.** The registration handshake's first call,
   `PUT /register/cleanup`, returns an empty body. The `reg()` helper called
   `JSONSerialization.jsonObject(with:)` with `try`, which throws on empty data —
   surfacing as a generic decode error before the PIN step was reached.

3. **Uppercase client-id.** The final `POST /register` sends
   `wrap(clientID + publicKeyPEM)`. Swift's `UUID().uuidString` is uppercase,
   but the Python reference uses `str(uuid.uuid4())` (lowercase). The device
   validates the client-id format and rejected the uppercase UUID with
   "Bad parameters". (The public-key PEM was *proven identical* to pycryptodome's
   output via a fixed-key test, ruling it out.)

4. **String-encoded numbers.** `GET /documents2` returns `file_size` and
   `total_page_num` as JSON *strings* (`"123456"`), but the `Entry` model decoded
   them as `Int`, failing the whole list decode.

## Solution

1. Added `dpHostForURL()` to bracket IPv6 literals and percent-encode the zone
   (`%en1` → `%25en1`); stopped stripping the zone in discovery; relaxed the TLS
   delegate's host match (unreliable for bracketed/zoned IPv6). Also made
   discovery **prefer IPv4** (Wi-Fi) and fall back to IPv6 (USB) only when no
   IPv4 route exists, so the address shown is stable and routable.
2. Made `reg()` tolerant of empty/non-JSON bodies (`try?` + empty check → `{}`).
3. Lowercased the generated client-id UUID to match the reference exactly.
4. Gave `Entry` a custom decoder that accepts Int-or-String for numeric fields.

After these, pairing, authentication, and document listing all succeed against a
real DPT-CP1.

## Key Files

- `DigitalPaperKit/DigitalPaperClient.swift` — `dpHostForURL()`, base-URL build, decode logging.
- `DigitalPaperKit/Discovery.swift` — zone preservation, IPv4-preferred resolution.
- `DigitalPaperKit/Networking/InsecureTLSDelegate.swift` — relaxed host match.
- `DigitalPaperKit/Registration.swift` — empty-body tolerance, lowercase client-id.
- `DigitalPaperKit/Models/Models.swift` — flexible `Entry` decoder.
- `DigitalPaperKitTests/PublicKeyPEMTests.swift` — proves SPKI PEM == pycryptodome.

## Lessons Learned

- **Unit-test crypto isn't enough; the transport and serialization edges only
  show up against real hardware.** Every failure here was outside the crypto core
  (which was already byte-exact).
- **Digital Paper over USB is link-local IPv6** — bracketing + zone preservation
  are mandatory, and a device on both USB and Wi-Fi needs a deterministic address
  preference.
- **The device API encodes numbers as strings and returns empty bodies** for some
  endpoints — decoders must be defensive.
- **Match the reference byte-for-byte, including incidental details** like UUID
  casing; the device validates more than expected.
- Logging the raw HTTP status/body and per-step handshake markers made each
  failure a one-shot diagnosis.
