# WLmouse protocol research

These notes describe the publicly served [WLmouse web configurator](https://gm.wlmouse.gg/) as inspected on 2026-11-14. The integration and protocol observations have **not been tested on physical hardware**; the vendor bundle is evidence, not a protocol specification. Catalog and bundle files can change after that date.

Sources: the [model catalog](https://gm.wlmouse.gg/Config/env-models.json), the hub entry bundle `static/js/index-DRmc0iTz.js`, and the hub's lazy-loaded `static/js/index-NBMZkZyk.js` (settings UI) and `static/js/index-BqBgWVTi.js` (device selection). The transport routines are embedded in the entry bundle. The catalog supplies model IDs and limits; the UI and transport supply framing and command behavior.

## Catalog models

All listed models have VID `36A7` and `IsNewProtocol=1`. PIDs below are hexadecimal; a dash means no 1K PID was listed. Each model has up to six DPI stages and a minimum of 50 DPI. LOD values are in millimeters. “Wired max” denotes the maximum wired polling rate; the complete sets are described below.

| Model | Wired PID | 1K PID | 8K PID | DPI max / step | LOD | Wired max (Hz) |
| --- | --- | --- | --- | --- | --- | --- |
| HUAN | A864 | — | A863 | 30,000 / 50 | 0.7, 1, 2 | 8,000 |
| HUAN M | A859 | — | A863 | 50,000 / 1 | 0.7, 1, 2 | 8,000 |
| BEAST MIAO | A867 | A882 | A866 | 30,000 / 50 | 0.7, 1, 2 | 1,000 |
| STRIDER | A873 | A882 | A872 | 30,000 / 50 | 0.7, 1, 2 | 1,000 |
| YING | A875 | A882 | A874 | 30,000 / 50 | 0.7, 1, 2 | 1,000 |
| SWORD X | A879 | A882 | A878 | 30,000 / 50 | 0.7, 1, 2 | 1,000 |
| BEAST MINI | A886 | A882 | A885 | 26,000 / 50 | 1, 2 | 1,000 |
| BEAST MINI PRO | A869 | A882 | A868 | 30,000 / 50 | 0.7, 1, 2 | 1,000 |
| BEAST MAX | A881 | A882 | A880 | 30,000 / 50 | 0.7, 1, 2 | 1,000 |
| BEAST X | A884 | A882 | A883 | 26,000 / 50 | 1, 2 | 1,000 |
| BEAST X PRO | A871 | A882 | A870 | 30,000 / 50 | 0.7, 1, 2 | 1,000 |
| BEAST G | A861 | A882 | A860 | 30,000 / 50 | 0.7, 1, 2 | 8,000 |
| BEAST X V2 | A857 | — | A856 | 50,000 / 1 | 0.7, 1, 2 | 8,000 |

The 1K set is 125, 250, 500, and 1,000 Hz. The 8K set adds 2,000, 4,000, and 8,000 Hz. Wired rates use the set corresponding to the stated maximum; the 1K receiver uses the 1K set and the 8K receiver uses the 8K set. `A882` is shared by ten models and `A863` by HUAN and HUAN M, so a PID alone cannot identify the connected mouse; the UI asks the user to select a model when needed. The vendor catalog enables separate X/Y DPI, angle tuning, hyper mode, and sleep for all listed models; its UI reads angle snap, motion sync, and ripple control without model-specific gates. The catalog marks additional LOD gear control for HUAN M and BEAST X V2. Legacy-protocol branches exist in the vendor transport but no current catalog model selects them.

## Implemented scope and framing

The independent `wlmouse/` integration implements device selection, state reads and writes for DPI stages and colors, polling, LOD, profile selection, X/Y separation, angle snap, motion sync, ripple control, tracking, hyper mode, debounce, and sleep. It reads firmware, battery and profile names. Its button API reads five physical mouse buttons and supports a subset of assignments; the UI exposes mouse, DPI and cycle assignments. The API additionally accepts keyboard and consumer-control assignments. Firmware updates, display control, macro storage/editing, profile naming/reset, and receiver button mappings are not implemented. Angle tuning is exposed by the driver API; consult the current UI for its controls.

The command interface uses 64-byte feature report 0. A separate 512-byte LCD interface is not a mouse command interface. Requests have byte 2 = target device, byte 3 = length, byte 4 = category, byte 5 = opcode, and payload from byte 6. A normalized response has byte 0 = status, byte 4 = category, byte 5 = opcode, and payload from byte 6. The remaining header fields are not interpreted. Some WebHID responses include an extra leading report-ID zero; strip that prefix before applying these response offsets. The implementation serializes commands and checks status and echoed category/opcode. All subsequent response offsets in this document refer to this normalized form.

## Further observations: profiles and buttons

The UI uses profile IDs starting at 1. Group 0 commands are get selected ID 133, set selected ID 5 (data: profile), get list 134, get name 142 (data: profile), set name 14 (data: profile, length, bytes), and reset 13 (data: profile). Names use GBK in the vendor app, with a length byte; the normalized get response's name length is at byte 7 and name starts at byte 8. The vendor refreshes settings after switching profiles. These commands affect the device; profile selection is not just a browser setting.

Get button is group 3 command 128; set is group 3 command 0. Request bytes 6 onward are `[profile, physicalButton, 0, type, dataLength, ...data]`, and byte 3 is `5 + dataLength`. For a generic read the UI sends type 255 and dataLength 10 with zero-filled data. The normalized response type is at byte 9, data length at 10, and data at 11. Physical button IDs are left 1, right 2, middle 3, back 4, forward 5, and DPI 20. Model-specific controls can differ.

| Type | Data | Meaning in vendor UI |
| --- | --- | --- |
| 0 | empty | Disabled |
| 1 | one byte | Mouse left/right/middle/back/forward = 1–5; wheel up/down = 16/17 |
| 2 | 1, 1, 2, 0, 100 | Left double click |
| 4 | modifier mask, HID keycode | Keyboard shortcut |
| 5 | usage high, usage low | Consumer control |
| 7 | 1, 2, or 6 | DPI up, down, or cycle up |
| 7 | 5, DPI high, DPI low, DPI high, DPI low | DPI lock |
| 8, 13, 14 | 3 | Cycle profile, polling rate, or lift-off distance |
| 16 | macro ID high, low, repetitions | Play macro N times |
| 17, 18 | macro ID high, low | Play macro while held, or toggle |

The response bytes at normalized offsets 6 and 7 are candidate profile and physical-button echo fields, but the vendor UI does not validate them and no hardware capture has confirmed them. This implementation conditionally permits remapping only if both match each requested assignment; devices without those echoes remain readable but cannot be remapped. This check aims to prevent a stale response from undermining the last-left-click guard. The vendor reads assignments and refuses an edit that would remove the last left-click mapping. Any implementation exposing writes should enforce this across the device's actual mapped physical buttons, not merely a stale UI count. A receiver-specific path uses a different device byte and separate buttons; do not assume mouse IDs apply to it.

## Observed macro storage and event encoding (not implemented)

Macro commands use group 4 and 16-bit big-endian IDs. Allocate command 1 carries ID and 32-bit big-endian size. Write command 3 carries ID, 32-bit big-endian offset, one-byte length, and bytes; the vendor writes chunks of at most 51 bytes. Get size is command 129; get data is 131; list is 133; delete is 2. Names use set 6 and get 134, with a one-byte ID in the vendor implementation and GBK text. Macro operations use longer delays than ordinary setting commands. Deletion also restores buttons assigned to the macro in the vendor UI.

The vendor UI serializes a stream of variable-length events: keyboard key down/up `02 key` / `03 key`, modifier down/up `09 mask` / `0a mask`, mouse button state `01 mask`, wheel `10 01` / `10 ff`, and delay opcodes `20` through `23` followed by 1–4 big-endian delay bytes in milliseconds. Mouse state masks use bits 1, 2, 4, 8, and 16 for left through forward. This describes serialization observed in the downloaded UI; it has not been validated on a physical mouse and should not be used to infer device limits or recovery behavior.
