# Rapoo VT nrf54L and LM20RT protocols

The standalone configurator is [rapoo/index.html](../rapoo/index.html).

Source: the public client served by [Rapoo AHUB](https://hub.rapoo.com/device/mouse/settings), inspected on 2026-11-13.
Bundle: https://hwsoft.rapoo.com/webdriver/AHUB_WEB/dist/assets/js/index-Bc6MfG2Y.js
SHA-256: `ac2f5830b36fd97505933f028a5ec1f6f855eb1b3cc46a134f8770e34760f0cc`.

This is an independent implementation of the wire format. No Rapoo source is shipped.
**No physical hardware has been tested.** The tests use an in-memory WebHID fixture.

## Scope and device selection

The 69 listed VT_nrf54L models and the two LM20RT VT2 RT models documented below are supported. Vendor ID is 0x24AE, configuration usage page 0xFF00, usage 2. Interface selection matches those IDs and the configuration usage, as AHUB does. Do not require output report 6 and feature report 8 to be described in the same collection: browsers can expose report descriptors in sibling or child collections, or omit that metadata before opening. The initial read-only configuration exchange establishes whether the commands actually work; editing stays disabled until it succeeds. Firmware-only interfaces (usage 14 or usage 1, without configuration usage 2) are excluded. The first product ID in each manifest is wired; the second is the receiver, as used by the vendor driver’s detectConnectionType.

If the picker returns a sibling interface, the page also checks already-authorized configuration interfaces with the same VID/PID as the selected device. It refuses to guess between multiple candidates. Connection details are available before a successful connection and include selected device IDs, collection usages, advertised report IDs and errors. Copying them uses the clipboard when available and otherwise selects the text for manual copying.

Other protocols are deliberately excluded: VT_CH584 (SE models), Telink3228C_Mouse (ULTRA), keyboards, bases and earlier unlisted mice. A similar product name does not establish compatibility.

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

The current profile is at absolute 0x10C. Switching writes [slot, slot] to 0x10C–0x10D, matching Yx.setCurrentConfig. The page can create, rename and delete user profiles; slot 0 cannot be deleted. Creating a profile writes its name only, preserving the slot’s stored settings and current selection. UTF-8 profile labels may not reproduce names encoded by older software.

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

The activity log records the first 40 incoming reports of any ID, for diagnosing receivers that do not report battery. Battery status 2 means charging and shows the bolt. Battery is shown only after a valid status report arrives. A profile notification invalidates editing and queues a refresh.

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

Lighting effects, pressure macros, RF pairing, reset, firmware updates and other Rapoo protocol families are not implemented. No calibration or firmware commands are sent. Real-device validation should compare reads to AHUB, change one setting, verify it in AHUB and after reconnecting, and include the activity log in any issue.

## Button remapping, macros and profile management

Additional source cross-check: https://hid.rapoo.cn/AHUB_WEB/dist/assets/js/index-BmzKunBE.js (Chinese AHUB, inspected 2026-11-14). The supported VT model button layouts come from its manifests; only actual model controls are exposed.

Button records are four bytes at profile base + [0,4,8,12,16,20,24,28,32,36,40,44,48,52,56]. Mouse actions use [3,0,mask,0], a plain keyboard key [0,0,usage,0], keyboard combinations [2,usage1,modifierMask,usage2], macro binding [5,0,slot,0], disable [7,0,0,0], DPI up/down [8,0,5-or-6,0]. Existing unknown/double-click/composite records are preserved. Each remap rereads all mappings and refuses to remove the last physical non-wheel left-click assignment.

Twelve macro slots are shared across profiles. Names are 16 UTF-8 bytes at 0xFD00 + slot*16. Payloads are at 0x10000 + slot*0x1000, limited to 4096 bytes and transferred in 24-byte chunks. The LE16 length includes a four-byte header: length, then LE16 repeat/playback value (65534 toggle, 65535 while held). Ordinary events contain LE16 ((delay<<1)|press) and one key byte; extended 247/248 events carry signed mouse movement/state. Payload and name commits are zero-length writes at their base+1 followed by 200 ms, then read-back verification. Saving or deleting a globally bound macro is rejected until every binding is removed. Unknown formats remain read-only; pressure macros are excluded. Recording uses only the explicitly focused area and stops on Escape, blur, tab changes or disconnect, releasing held keys in the draft. Imported files are local drafts until the user saves.

Profile names are limited to 16 UTF-8 bytes. Deletion follows AHUB: switch an active deleted slot to default, clear its name, wait, issue an empty name write and restore vendor button defaults. The default/last profile is protected. Settings JSON backups are model-specific, validated and previewed before restore. They exclude names, button mappings, macros, firmware, pairing and global communication protocol; macros have their own export/import.

Validation: `node --test tests/rapoo.cjs tests/rapoo-ui.cjs tests/rapoo-buttons.cjs tests/rapoo-macros.cjs tests/rapoo-profiles.cjs tests/sensor-mode.cjs`. Hardware validation is still required.


## Button selector artwork

The button selector follows a numbered mouse-and-rows layout. It uses the locally bundled VT3S MAX V2 top-view illustration for standard mice and Rapoo’s public [VT2 RT V2 Polar Day thumbnail](https://hwsoft.rapoo.com/webdriver/manifests/VT2%20RT%20V2/thumb_Polar_Day.png) for RT models, with a local-image fallback. Rapoo retains ownership of its imagery. The caption identifies the layout as illustrative; physical positions vary by model. Numbering is contiguous across the connected model’s actual controls, with the underside control labeled separately. Hovering or focusing a marker/label highlights the corresponding row. Each row has its own action dropdown. Simple mappings save and verify immediately through the existing driver; keyboard shortcuts and macros open the explicit editor and require Save assignment. The last-left-click guard remains enforced. Failed saves and profile changes reload the mappings so dropdowns show the stored assignments. The detailed editor and read-assignments control remain available under a disclosure. The layout stacks on narrow screens.


The disconnected and unsupported-browser screens cycle through bundled Rapoo VT3S MAX V2, VT9 and VT1 MAX thumbnails every five seconds, with their model names. Pause/Play controls stop or resume the slideshow; reduced-motion preferences keep it static, and it stops while the document is hidden or a device is connected. The device card uses a matching thumbnail for those three models, or the explicitly labeled VT3S MAX V2 illustration for other models. Image provenance is recorded in [assets/rapoo/README.md](../assets/rapoo/README.md).


## Korean hub comparison: DC mode

Inspected [Rapoo Korea](https://hubkr.rapoo.com/home) on 2026-11-14. Its parameters screen places **DC Switch** beside the press/release debounce controls and shows it when `productInfo.dcSwitch` is enabled. The public product metadata flags its VT nrf54L entries; its non-VT devices use other protocols and are outside this configurator's scope.

| Item | Korean hub | OpenATK |
| --- | --- | --- |
| DC switch | Exposed in the debounce card; advertised behavior requires official Korean firmware | Added under Buttons & power as DC mode (Korean firmware), with the same firmware requirement |
| Persistence | One byte per active onboard profile | Same address, read on connect/refresh/profile change |
| Switch encoding | Off writes 0, on writes 1; reads interpret any nonzero value as on | Same; writes are read-back verified |
| Debounce settings | Separate press/release bytes | Kept independent; changing DC only writes its byte |
| Settings backup | Vendor configuration system | DC included as an optional boolean; older backups leave it unchanged |

Wire format: profile base `0x600 + profile * 0x400`, offset **730** (`MOUSE_DCSWITCH` / `LOW_DC_SWITCH`), one-byte read/write through the existing VT nrf54L A4/A5 EEPROM commands. The existing target byte selects cable (`0xFF`) or receiver (`0xA5`). The same field is implemented and read by the global AHUB VT driver, including the newer supported models absent from Korea's catalog, but sharing an EEPROM field does not establish that global firmware implements the same behavior. OpenATK exposes the field for its existing VT nrf54L models only and labels it as requiring Korean firmware; no additional device protocol is enabled. The client has no verified way to identify the regional firmware variant, so a readable field, an enabled toggle or successful read-back must not be treated as confirmation that DC behavior is active.

The official Korean-market notice supplied by the user states that Freeflow-distributed Korean models use proprietary firmware distinct from global products. According to that notice, enabling DC MODE provides improved release-click response and anti-slam-click behavior on those Korean models. It explicitly says that DC MODE will not actually work on non-Korean-release products even if the web driver detects it. These are vendor claims; they have not been measured or verified on hardware here. This corrects the earlier inference that a shared command implied global feature support. The meaning of the acronym remains unspecified. No firmware update, pairing or reset is involved. Initialization remains read-only. Physical-device validation is still required.

Primary implementation references:

- Korea entry bundle: https://hubkr.rapoo.com/assets/index-Bi8gQvIB.js (profile address table and public product metadata loader).
- Korea parameters UI: https://hubkr.rapoo.com/assets/index-D4bnHIW4.js (capability gate and debounce-card placement).
- Korea getter/setter: https://hubkr.rapoo.com/assets/useParameters-DmaGWNVI.js (`getDCSwitch` / `setDCSwitch`).
- Korea public model data: https://hubkr.rapoo.com/enc.data (decoded by its shipped client).
- Global client: https://hwsoft.rapoo.com/webdriver/AHUB_WEB/dist/assets/js/index-Bc6MfG2Y.js (`LOW_DC_SWITCH`, `getDcSwitch`, `setDcSwitch`, `getAllPerfCfg`).

Validation covers cable/receiver packet bytes, profile isolation, preservation of adjacent EEPROM bytes, nonzero read semantics, invalid values, stale-profile protection, read-back failure, UI wiring, backup round trips and legacy backup preservation. Run `node --test tests/rapoo.cjs tests/rapoo-ui.cjs tests/rapoo-buttons.cjs tests/rapoo-macros.cjs tests/rapoo-profiles.cjs tests/sensor-mode.cjs`.

## VT2 RT V2 / VT2 RT Master V2 (LM20RT)

Source: the current public [Chinese AHUB](https://hub.rapoo.cn/) client, inspected 2026-11-14: https://hid.rapoo.cn/AHUB_WEB/dist/assets/js/index-exv-sdE5.js. Its manifests select **LM20RT**, not VT_nrf54L; protocol compatibility was checked against the LM20RT address table, `qP` device, `VP` DPI, `DP` profiles, `GP` keys, `ZP` performance and `XP` RT feature implementations. This support is an independent implementation of the shared transport and RT fields, not merely a product-ID alias.

| Model | Cable PID | Receiver PID | VID / configuration usage |
| --- | --- | --- | --- |
| VT2 RT V2 | 19232 / `0x4B20` | 6944 / `0x1B20` | `0x24AE`, page `0xFF00`, usage 2 |
| VT2 RT MASTER V2 | 19233 / `0x4B21` | 6945 / `0x1B21` | Same |

The manifests specify PAW3955U, optical main switches and encoder, 1–60000 DPI in steps of 1, 0.7–1.7 mm LOD, key-scan adjustment, eight profiles and 4096-byte standard macros. Cable and receiver use the same output report 6 / feature report 8, A4/A5 commands, target FF/A5 and profile layout as the existing driver. Input report 7 shares the existing battery/DPI/profile/rate field positions. Firmware-only interfaces are still excluded. The Master's pairing-only PID 5210 is not added as a configurable RT device.

The RT card appears only on the two verified LM20RT models. It exposes separate left/right actuation level, rapid-trigger enable and level, press/release vibration, press/release sound selection and sound volume, plus the shared feedback type. Labels use AHUB's levels rather than inventing a physical travel conversion. Stored unknown values are not automatically replaced; edits validate the manifest ranges.

All addresses below are **profile-relative**, added to `0x600 + profile * 0x400`:

| Field | Left offset | Right offset | Accepted write values |
| --- | --- | --- | --- |
| Rapid-trigger enable | 740 | 748 | 0 off / 1 on; reads treat nonzero as on |
| Actuation level | 744 | 752 | 1–10 |
| Rapid-trigger level | 745 | 753 | 1–10 |
| Press vibration | 756 | 760 | 0–10 |
| Release vibration | 757 | 761 | 0–10 |
| Shared feedback type | 758 | Shared | 0–2, shown as Feedback 1–3 |
| Press sound | 764 | 768 | 1–10 |
| Release sound | 765 | 769 | 1–10 |
| Sound volume | 766 | 770 | 0–100 |

Initialization reads the two blocks 740–763 and 764–770 without writing. Each edit writes and verifies exactly one byte, preserving the holes/reserved bytes. Existing profile guards and transport serialization apply. Standard models never read or write the RT region. Profile changes re-read RT settings; settings backups include a validated optional `rt` object only for RT models. Legacy backups lacking it leave RT settings unchanged, and RT backups cannot be restored to standard mice.

Hardware-free demos: `rapoo/index.html?demo=rt` and `?demo=rt-dongle`. The simulated models run the same read/write and verification code. Physical-device validation is pending. Calibration, live trigger polling, factory reset and firmware updates are not implemented; use AHUB for calibration. OpenATK sends no calibration or firmware commands.

Validation covers both models and both transports, all 17 field offsets and ranges, read-only initialization, neighbor-byte preservation, stale-profile rejection, failed read-back handling, profile isolation, RT backup validation/round trips, legacy backup preservation, UI edits/rollback, standard-model hiding and both RT demos.


VT2 RT V2 is the default simulated mouse: the connection-screen demo links and `?demo=1` use cable mode, and `?demo=dongle` uses its receiver. The aliases `?demo=rt` and `?demo=rt-dongle` remain supported. Use `?demo=standard` or `?demo=standard-dongle` for the previous VT3S MAX V2 simulation. The simulated HID product name follows the selected model.

