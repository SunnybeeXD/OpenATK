# Rapoo VT nrf54L protocol

The standalone configurator is [rapoo/index.html](../rapoo/index.html).

Source: the public client served by [Rapoo AHUB](https://hub.rapoo.com/device/mouse/settings), inspected on 2026-11-13.
Bundle: https://hwsoft.rapoo.com/webdriver/AHUB_WEB/dist/assets/js/index-Bc6MfG2Y.js
SHA-256: `ac2f5830b36fd97505933f028a5ec1f6f855eb1b3cc46a134f8770e34760f0cc`.

This is an independent implementation of the wire format. No Rapoo source is shipped.
**No physical hardware has been tested.** The tests use an in-memory WebHID fixture.

## Scope and device selection

Only manifests selecting the VT_nrf54L driver are supported. Vendor ID is 0x24AE, configuration usage page 0xFF00, usage 2. Interface selection matches those IDs and the configuration usage, as AHUB does. Do not require output report 6 and feature report 8 to be described in the same collection: browsers can expose report descriptors in sibling or child collections, or omit that metadata before opening. The initial read-only configuration exchange establishes whether the commands actually work; editing stays disabled until it succeeds. Firmware-only interfaces (usage 14 or usage 1, without configuration usage 2) are excluded. The first product ID in each manifest is wired; the second is the receiver, as used by the vendor driver’s detectConnectionType.

If the picker returns a sibling interface, the page also checks already-authorized configuration interfaces with the same VID/PID as the selected device. It refuses to guess between multiple candidates. Connection details are available before a successful connection and include selected device IDs, collection usages, advertised report IDs and errors. Copying them uses the clipboard when available and otherwise selects the text for manual copying.

Other protocols are deliberately excluded: VT_CH584 (SE models), LM20RT (RT models), Telink3228C_Mouse (ULTRA), keyboards, bases and earlier unlisted mice. A similar product name does not establish compatibility.

## Transport

- Wired target byte: 0xFF. Wireless target: 0xA5.
- Requests: sendReport(6, payload), not sendFeatureReport.
- Replies: receiveFeatureReport(8); ACK at byte 0, EEPROM data from byte 4.
- ACK 1 is success, ACK 2 is busy. Read again up to five times, with 100 ms between busy replies. Initial delay is 1 ms wired, 10 ms receiver.
- Commands are serialized. A 3 s hung USB call invalidates the transport until reconnection. Writes are never automatically resent.
- Read: [target, 0xA4, length, addressLE32].
- Write: [target, 0xA5, length, addressLE32, ...values].
- Each write is followed by a read of the same bytes and must match exactly. The active profile is rechecked before each setting operation. Connection and refresh never write or initialize configuration.

Relevant vendor symbols: Hk (device, notifications and connection target), l1 (addresses), Wx (DPI), ek (performance), Yx (profiles), J6/Ix (frames), Ql/Sl (EEPROM operations), QC (transport), s1 (per-rate capability tables).

## EEPROM map

Profile p is zero-based (0–7). Its base is 0x600 + p * 0x400.

| Setting | Offset from profile base | Encoding |
|---|---:|---|
| Polling | 640 | Keys below |
| Key scan rate | 641 | 3/4/5/6 = 1K/2K/4K/8K, only on models exposing keyScanRate |
| Lift-off | 644 | One-based index into the model’s LOD list, **not mm times ten** |
| Motion sync | 645 | 0 off, 1 on |
| X DPI stages | 648 | Seven uint16 little-endian values |
| Enabled DPI stages | 662 | Count minus one |
| Active DPI stage | 664 | Zero-based index |
| Press debounce | 704 | 0–16 ms, then 18–32 ms in steps of 2 |
| Release debounce | 705 | Same |
| Sleep | 706 | 2–120 minutes, 255 never |
| Corrections | 707 | Bit 0 angle snap, bit 1 ripple; **0 enabled, 1 disabled**; preserve other bits |
| Sensor angle | 708 | Signed int8, -30 to +30 degrees |
| Glass tracking | 709 | 0 off, 1 on |
| Y DPI stages | 712 | Seven uint16 little-endian values |
| Wireless RF strategy | 728 | 0 adaptive, 1 maximum RF |
| Low battery light | 729 | 0 off, 1 on |
| Sensor performance | 732–738 | One byte per polling option, in table order below |
| Profile name | 1004 | 16-byte NUL-terminated name; used only to enumerate existing profiles |

Communication protocol is a single byte at absolute 0x60, shared by all profiles: 0 Turbo, 2 Initial. The page exposes it only for models whose manifest sets `rfPacketType` to `always`. Models with `wirelessOnly` also require receiver firmware 0.74 or newer, which the page cannot read, so they are not offered.

The current profile is at absolute 0x10C. Switching writes [slot, slot] to 0x10C–0x10D, matching Yx.setCurrentConfig. The page does not create, delete or rename profiles. UTF-8 profile labels may not reproduce names encoded by older software.

| Hz | Wire key | Allowed performance values |
|---:|---:|---|
| 125 | 8 | 1, 0 |
| 250 | 4 | 1, 0 |
| 500 | 2 | 2, 1, 0 |
| 1000 | 1 | 5, 4, 3, 2, 1 |
| 2000 | 132 | 5, 4, 3, 2 |
| 4000 | 130 | 5, 4, 3 |
| 8000 | 129 | 5, 4, 3 |

Performance values: 0 Office, 1 Balanced, 2 Power, 3 Hyper, 4 Competition Hyper, 5 Rampage Competitive. Changing polling does not overwrite the stored mode for that rate.

## DPI and lift-off families

| Family | DPI | LOD list |
|---|---|---|
| Standard | 50–26000, step 50 | 1.0–2.0 mm, step 0.1 |
| Ultra | 10–10050, step 10; 10050–45000, step 50 | 0.7–1.7 mm, step 0.1 |
| V2 | 1–60000, step 1 | 0.7–1.7 mm, step 0.1 |

These are capability families, not a guess from the model name. The registry stores them per manifest. X and Y are independent tables. The count byte is never included in a DPI table write. Reducing enabled stages first selects a remaining stage. Increasing the count requires valid stored DPI values in every enabled stage.

## Notifications

Input report ID 7 contains a compact status payload, without a report-ID byte prepended:

| Bytes | Meaning |
|---|---|
| 0 | Low nibble connection protocol, high nibble sensor |
| 1 | Active DPI stage |
| 2–3 / 4–5 | X / Y DPI, uint16 little-endian |
| 6 / 7 | Battery status / percentage |
| 9 / 10 | Key scan / polling key, if present |
| 11 | Current profile, if present |
| 16 | Sensor mode for the current polling rate, if present |

Battery status 2 means charging and shows the bolt. Battery is shown only after a valid status report arrives. A profile notification invalidates editing and queues a refresh.

## Supported device IDs

These are 69 of the 77 VT_nrf54L manifests in the inspected bundle. The other 8 (ESM612ACE, ESM612MAX, ESM612PRO, ESM622MAX, ESM622PRO, ESM652PRO, ESM672MAX, ESM672PRO) are wired-only, have one PID each and use the cybercafe status report with a prefix byte this page does not parse, so they are not supported. All use VID 0x24AE. This table records protocol evidence, **not hardware confirmation**.

| Model | Wired PID | Receiver PID | DPI family | Key scan control | RF protocol control |
|---|---|---|---|---|---|
| VT0 MAX MASTER | 0x464A | 0x144A | Ultra | Yes | Yes |
| VT0 MAX | 0x4620 | 0x1420 | Ultra | Yes | No |
| VT0 | 0x4610 | 0x1410 | Standard | No | No |
| VT0 Air MAX | 0x46A1 | 0x14A1 | Ultra | Yes | No |
| VT1 MAX | 0x4644 | 0x1444 | Ultra | Yes | No |
| VT1 | 0x4615 | 0x1415 | Standard | No | No |
| VT1S MAX V2 | 0x4B0A | 0x1B0A | V2 | Yes | Yes |
| VT1S V2 | 0x466A | 0x146A | Ultra | No | No |
| VT2 MAX MASTER V2 | 0x4675 | 0x1475 | V2 | Yes | Yes |
| VT2 MAX V2 | 0x4B09 | 0x1B09 | V2 | Yes | Yes |
| VT2 MAX | 0x4623 | 0x1423 | Ultra | Yes | No |
| VT2 V2 | 0x4668 | 0x1468 | Ultra | No | No |
| VT2 | 0x4622 | 0x1422 | Standard | No | No |
| VT2 Air MAX V2 | 0x4B12 | 0x1B12 | V2 | Yes | Yes |
| VT2K MAX | 0x46A4 | 0x14A4 | Ultra | Yes | No |
| VT2S MAX MASTER V2 | 0x4676 | 0x1476 | V2 | Yes | Yes |
| VT2S MAX V2 | 0x4B04 | 0x1B04 | V2 | Yes | Yes |
| VT2S V2 | 0x465D | 0x145D | Ultra | No | No |
| VT2S Air MAX V2 | 0x4B13 | 0x1B13 | V2 | Yes | Yes |
| VT3 MAX MASTER V2 | 0x466D | 0x146D | V2 | Yes | Yes |
| VT3 MAX V2 | 0x4B06 | 0x1B06 | V2 | Yes | Yes |
| VT3 MAX | 0x4617 | 0x1417 | Ultra | Yes | No |
| VT3 PRO V2 | 0x46A5 | 0x14A5 | V2 | Yes | Yes |
| VT3 V2 | 0x4662 | 0x1462 | Ultra | No | No |
| VT3 | 0x4612 | 0x1412 | Standard | No | No |
| VT3 Air MAX V2 | 0x4B0C | 0x1B0C | V2 | Yes | Yes |
| VT3S MAX MASTER V2 | 0x466E | 0x146E | V2 | Yes | Yes |
| VT3S MAX MASTER | 0x464B | 0x144B | V2 | Yes | Yes |
| VT3S MAX V2 | 0x4B07 | 0x1B07 | V2 | Yes | Yes |
| VT3S MAX | 0x4621 | 0x1421 | Ultra | Yes | No |
| VT3S PRO V2 | 0x46A6 | 0x14A6 | V2 | Yes | Yes |
| VT3S V2 | 0x4664 | 0x1464 | Ultra | No | No |
| VT3S | 0x4611 | 0x1411 | Standard | No | No |
| VT3S Air MAX V2 | 0x4B0D | 0x1B0D | V2 | Yes | Yes |
| VT3S Air Max | 0x46A2 | 0x14A2 | V2 | Yes | No |
| VT4 MAX MASTER V2 | 0x4677 | 0x1477 | V2 | Yes | Yes |
| VT4 MAX V2 | 0x4B03 | 0x1B03 | V2 | Yes | Yes |
| VT4 V2 | 0x465B | 0x145B | Ultra | No | No |
| VT4 Air MAX V2 | 0x4B14 | 0x1B14 | V2 | Yes | Yes |
| VT6 MAX | 0x4652 | 0x1452 | Ultra | Yes | No |
| VT6 | 0x4651 | 0x1451 | Standard | No | No |
| VT7 MAX MASTER V2 | 0x4670 | 0x1470 | V2 | Yes | Yes |
| VT7 MAX V2 | 0x4B05 | 0x1B05 | V2 | Yes | Yes |
| VT7 MAX | 0x4616 | 0x1416 | Ultra | Yes | No |
| VT7 PRO V2 | 0x46A7 | 0x14A7 | V2 | Yes | Yes |
| VT7 V2 | 0x4660 | 0x1460 | Ultra | No | No |
| VT7 | 0x4613 | 0x1413 | Standard | No | No |
| VT7 Air MAX V2 | 0x4B0E | 0x1B0E | V2 | Yes | Yes |
| VT7S MAX MASTER V2 | 0x4671 | 0x1471 | V2 | Yes | Yes |
| VT7S MAX V2 | 0x4B02 | 0x1B02 | V2 | Yes | Yes |
| VT7S PRO V2 | 0x46A8 | 0x14A8 | V2 | Yes | Yes |
| VT7S V2 | 0x4659 | 0x1459 | Ultra | No | No |
| VT7S Air MAX V2 | 0x4B0F | 0x1B0F | V2 | Yes | Yes |
| VT8 MAX MASTER V2 | 0x4678 | 0x1478 | V2 | Yes | Yes |
| VT8 MAX V2 | 0x4B0B | 0x1B0B | V2 | Yes | Yes |
| VT8 V2 | 0x466C | 0x146C | Ultra | No | No |
| VT8 Air MAX V2 | 0x4B15 | 0x1B15 | V2 | Yes | Yes |
| VT9 MAX MASTER V2 | 0x4673 | 0x1473 | V2 | Yes | Yes |
| VT9 MAX V2 | 0x4B08 | 0x1B08 | V2 | Yes | Yes |
| VT9 MAX | 0x4618 | 0x1418 | Ultra | Yes | No |
| VT9 PRO V2 | 0x46A9 | 0x14A9 | V2 | Yes | Yes |
| VT9 V2 | 0x4666 | 0x1466 | Ultra | No | No |
| VT9 | 0x4614 | 0x1414 | Standard | No | No |
| VT9 Air MAX V2 | 0x4B10 | 0x1B10 | V2 | Yes | Yes |
| VT9S MAX MASTER V2 | 0x4674 | 0x1474 | V2 | Yes | Yes |
| VT9S MAX V2 | 0x4B01 | 0x1B01 | V2 | Yes | Yes |
| VT9S PRO V2 | 0x46AA | 0x14AA | V2 | Yes | Yes |
| VT9S V2 | 0x4653 | 0x1453 | Ultra | No | No |
| VT9S Air MAX V2 | 0x4B11 | 0x1B11 | V2 | Yes | Yes |

## Validation and limits

Run `node --test tests/rapoo.cjs tests/sensor-mode.cjs`. Tests cover packet bytes, both targets, read-only initialization, DPI boundaries, correction polarity and reserved bits, per-rate modes, profiles, verification failures, busy/timeout handling, serialization and notifications.

Open `rapoo/index.html?demo=1` or `?demo=dongle` for a simulated wired mouse or receiver. Both use the same Rapoo driver against an EEPROM-backed HID simulation. No WebHID API is accessed in demo mode.

Remapping, macros, lighting effects, RF pairing, reset, firmware updates and other Rapoo protocol families are not implemented. No calibration or firmware commands are sent. Real-device validation should compare reads to AHUB, change one setting, verify it in AHUB and after reconnecting, and include the activity log in any issue.
