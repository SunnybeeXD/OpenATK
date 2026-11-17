# Hitscan protocol research

These notes describe the publicly served [Hitscan Control beta](https://beta.control.hitscan.com/) as inspected on 2026-11-17 (`hitscan-app-version` `1.0.31-beta.1`, release `d4f7ec24`). Everything here comes from the shipped JavaScript. **Nothing has been tested on a device**, and the bundle is evidence, not a specification. This is a beta site, so the code, firmware feed and device list can change after that date.

Sources, all under `/releases/1.0.31-beta.1-d4f7ec24/`:

- `hitscan-device.js`: the WebHID adapter, device filters and connection flow.
- `vendor/xvi-20260924.min.js`: the supplier SDK (class `XviUpdater`) that builds and parses commands.
- `hitscan-input-codec.js`: button-binding and macro encodings.
- `firmware-catalog.js`, `hitscan-firmware.js`, `web-firmware-feed.js`: the firmware catalog and the updater.

The page is a plain set of unminified scripts, apart from the vendored SDK.

## Platform

The vendored SDK is the same family as the one behind the [WLmouse](wlmouse-protocol.md) and [Lamzu](lamzu-protocol.md) configurators: the same class fields (`setReportDevice`, `readFileDevice`, `isNewProtocol`, `commonDelay` of 20 ms), the same 64-byte framing, and nearly the same method names. The Hitscan page adds its own validation layer on top (see below), so it does not call the SDK blindly. The framing also matches the [RAWM notes](rawm-protocol.md).

## Devices

Vendor ID `0x3770` (14192). PIDs are hexadecimal.

| Device | Mode | PID | Bootloader PID | Notes |
|---|---|---|---|---|
| Hyperlight X | wired | `0136` | `1136` | The page names it by PID. |
| Hyperlight N | wired | `0194` | `1194` | The page names it by PID. |
| Receiver (dongle) | wireless | `0300` | `1300` | Shared by both mice. |
| "Hitscan" (older entry) | wired | `F101` | `F100` | Listed in the firmware catalog as a retired PID. Not in the connect filters. |
| "Hitscan" receiver (older entry) | wireless | `F301` | `F300` | Firmware catalog only. |

The connect filters are exactly `3770:0136`, `3770:0194` and `3770:0300`. Any other device in the picker result is rejected as unsupported. The firmware feed configuration lists `retiredMousePids: [61697]`, which is `0xF101`.

The receiver PID is shared, so the page asks the receiver which mouse is paired. `GetDevicePID` (target `1`, length `6`, opcode `0x8B`, byte `[6] = 2`) returns the mouse PID as a big-endian 16-bit value at `[11 - hidIndex]` and `[12 - hidIndex]`. Older receiver firmware may reject it, in which case the page falls back to the product name and finally to the generic name "Hitscan device".

## Transport

- The command interface is the HID interface whose feature report 0 is 512 bits (64 bytes). The page requires exactly one such interface in the picker selection.
- Commands use `sendFeatureReport(0, 64 bytes)` and the reply comes from `receiveFeatureReport(0)`.
- Device notifications arrive on a separate interface with input report ID 4. It is paired with the command interface by VID, PID and serial number, and the page refuses to guess if two identical products are granted.
- Request bytes: `[2]` target device, `[3]` length, `[4]` category, `[5]` opcode, payload from `[6]`. Most commands carry the profile number in `[6]`.
- Reply layout: the status byte `0xA1` is at `[0]` or `[1]`, because a leading report-ID zero may shift everything by one. The SDK picks the offset by checking which position holds the opcode (for the firmware version, `[6] == 0x81` means the version is at `[7..10]`, otherwise `[5] == 0x81` means `[6..9]`). For DPI stage reads and writes only, the page also requires the reply to echo the request's target (`[2]`), category (`[4]`), opcode (`[5]`) and profile (`[6]`) at the same offset (`validateDpiReply`).
- Get and set opcodes come in pairs: the get opcode is the set opcode with bit `0x80` set. Every pair in the table below follows this.
- Targets: `2` addresses the mouse (through the receiver when wireless). `0` addresses the receiver. `1` is used by `GetDevicePID` and the lighting effect commands. The page's `setReport` replaces target `2` with the SDK's `wiredMouseDeviceID`, which is `2` by default.
- The page limits the DPI stage count to 4 and DPI values to 50 through 30000, even though the SDK allows six stages and the same table is shared with other supplier mice. It also limits the profile list to 10 entries.

## Commands

Observed from the header bytes in the SDK's own method bodies: `[3]` is the length, `[4]` the category and `[5]` the set opcode. The get opcode is the set opcode plus `0x80`. A dash means the SDK does not set that byte, which leaves it at zero. Parameters are the ones visible at `[6]` and `[7]`. I did not trace every reply layout.

### System and profiles (category 0)

| Command | Length | Set / get opcode | Parameters |
|---|---|---|---|
| Profile select | 1 | `0x05` / `0x85` | `[6]` profile |
| Profile list | 1 | get `0x86` | Returns the profile count. |
| Profile name | var / 58 | `0x0E` / `0x8E` | `[6]` profile, `[7]` name length, GBK text |
| Reset profile | 1 | `0x0D` | `[6]` profile |
| Factory default | 2 | `0x00` | `[6] = 0xC0`, `[7] = 1` or `2` |
| Firmware version | 16 | get `0x81` | Target `2` mouse, `0` receiver. Version at `[7..10]` or `[6..9]`. |
| Serial number | 20 | get `0x82` | Target `2` |
| ID (EID) | 1 | get `0x82` | Target `2` |
| Battery | 2 | get `0x83` | Target `2`, level at `[7]` and charge state at `[8]`, or `[6]` and `[7]` |
| Signal strength | 2 | get `0xA7` | Target `2`, two bytes in the same positions |
| Sleep time | 3 | `0x07` / `0x87` | `[6]` profile, 16-bit big-endian value in `[7..8]`. `0` is sent as `0xFFFF`. |
| Shut down | 4 | `0x00` | `[6] = 0xF0` |
| Debounce | 2 | `0x08` / `0x88` | `[6]` profile, `[7]` value. The SDK also has a "new" form that sends a list, with length `1 +` the list size. |
| Per-button debounce | 19 | `0x12` / `0x92` | `[6]` profile |
| Scan rate | 2 | `0x1F` / `0x9F` | `[6]` profile, `[7]` value |
| Scan time | 5 | `0x13` / `0x93` | `[6]` profile, 16-bit value |
| Button scan sequence | 4 | `0x18` / `0x98` | `[6]` profile |
| Scroll wheel hop / anti-misoperation | 4 | `0x19` / `0x99` | `[6]` profile, `[7]` value (the page's "tournament" setting) |

### Sensor and DPI (category 1)

| Command | Length | Set / get opcode | Parameters |
|---|---|---|---|
| Polling rate | 2 | `0x00` / `0x80` | `[6]` profile, `[7]` rate code (below) |
| LOD | 2 | `0x08` / `0x88` | `[6]` profile, `[7]` value. A LOD of 1 mm or more is sent as the millimeter value. Below 1 mm it is sent as `10 * mm \| 0x80` (0.7 mm becomes `135`). |
| Separate X/Y DPI | 2 | `0x0D` / `0x8D` | `[6]` profile, `[7]` on or off |
| Angle tune | 2 | `0x14` / `0x94` | `[6]` profile, `[7]` value |
| Angle snap | 2 | `0x04` / `0x84` | `[6]` profile, `[7]` on or off |
| Motion sync | 2 | `0x09` / `0x89` | `[6]` profile, `[7]` on or off |
| Hyper mode | 2 | `0x0B` / `0x8B` | `[6]` profile, `[7]` on or off |
| Tracking mode | 2 | `0x13` / `0x93` | `[6]` profile, `[7]` on or off |
| Ripple control | 2 | `0x0A` / `0x8A` | `[6]` profile, `[7]` on or off |
| Polling info level | 2 | `0x12` / `0x92` | `[6]` profile, `[7]` value |
| Sensor model | 1 | get `0x8F` | No profile |
| DPI maximum | 2 | get `0x8C` | |
| DPI stage table | 26 / 10 | `0x01` / `0x81` | `[6]` profile, `[7]` stage count, then four bytes per stage from `[8]`: X high, X low, Y high, Y low |
| Stage count / active stage | 2 | `0x02` / `0x82` | `[6]` profile, `[7]` value. The SDK uses this opcode for both names. The page treats `[7]` as a stage count in `1..4`. |

Polling rate codes used by the page: 125 Hz is `8`, 250 is `4`, 500 is `2`, 1000 is `1`, 2000 is `32`, 4000 is `64` and 8000 is `128`.

### Lighting (category 2)

| Command | Length | Set / get opcode | Parameters |
|---|---|---|---|
| Lighting enable / DPI indicator | 2 | `0x04` / `0x84` | `[6]` profile, `[7]` value. The SDK uses this opcode for both names. |
| DPI stage colors | 19 | `0x01` / `0x81` | `[6]` profile, three bytes per stage |
| Lighting effect | 6 | `0x00` / `0x80` | Target `0` or `1`, `[6] = 1` |
| Lightness | 3 | `0x02` / `0x82` | `[6]`, `[7]` |

The page rejects a DPI color of `0,0,0` (`hasBlackDpiColor`).

### Buttons (category 3)

| Command | Length | Set / get opcode | Parameters |
|---|---|---|---|
| Button binding | var | `0x00` / `0x80` | `[6]` profile, `[7]` physical button, then function ID and data (below) |
| Button combine | 2 | `0x01` / `0x81` | `[6]` profile, `[7]` value |
| Button combine target | 3 | `0x04` / `0x84` | `[6]` profile, `[7]` value |
| SPDT state | 3 | `0x03` / `0x83` | `[6]` profile, `[7]` left, `[8]` right |
| DPI power mode | 0 / 6 | `0x00` / `0x80` | `[7] = 20` |

`SPDT` is the bundle's name for the per-click switch setting. The firmware release notes mention swipe-click protection "when SPDT is off". Dongles of firmware `2.15` trim trailing zero bytes before forwarding, which drops the right-click flag, so the page sends length `4` and a trailing marker byte `1` for those mice (`0.0.2.15`, `9.1.2.15`, `1.1.2.15`, `1.1.2.16`) when the right flag is off.

### Macros (category 4)

| Command | Length | Set / get opcode | Parameters |
|---|---|---|---|
| Allocate | 6 | `0x01` | `[6..7]` macro ID, size |
| Macro size | 6 | get `0x81` | `[6..7]` macro ID |
| Delete | 2 | `0x02` | `[6..7]` macro ID |
| Macro data | var | `0x03` / `0x83` | `[6..7]` macro ID |
| Macro name | var | `0x06` / `0x86` | `[6..7]` macro ID, name length |
| Macro list | 8 | get `0x85` | `[7]` entry count, then cursor bytes. The SDK hard-codes three entries and the page overrides the count and length. |

### Bootloader (category `0xB0`)

| Command | Length | Opcode | Bytes |
|---|---|---|---|
| Enter bootloader | 1 | none | `[6] = 0xB0` |
| Bootloader version | 6 | get `0x80` | |
| Erase | 8 | `0x01` | |
| Verify | 32 | `0x83` | `[6] = 32` |
| Exit bootloader | 1 | `0x04` | `[6] = 0xB0` |

The bootloader appears as a separate USB device on the bootloader PID listed above. Programming sends firmware data in packets after an erase, then verifies.

## Button bindings

A binding is a function ID plus data bytes (at most 53). The codec in `hitscan-input-codec.js`:

| Function | ID | Data |
|---|---|---|
| Disabled | `0` | none |
| Mouse button | `1` | left `1`, right `2`, middle `3`, back `4`, forward `5`, scroll up `16`, scroll down `17` |
| Key | `4` | `[modifier bits, HID usage]`. Modifiers: left Ctrl `1`, Shift `2`, Alt `4`, Meta `8`, right variants `16`, `32`, `64`, `128`. |
| Media / consumer | `5` | 16-bit usage, high byte first (for example play/pause `0xCD`, volume up `0xE9`, mute `0xE2`) |
| DPI | `7` | cycle `[6]`, up `[1]`, down `[2]`, lock `[5, X hi, X lo, Y hi, Y lo]` |
| Profile switch | `8` | `[3]` |
| Polling loop | `13` | `[3]` |
| Macro | `16` count, `17` held, `18` toggle | `[ID high, ID low]`, plus a run count for function `16` (`1` for run once) |

Unknown function IDs are kept as `custom` bindings and written back unchanged.

## Macro events

Macro data is a byte stream of two-byte events, except the longer delay forms:

| Byte | Meaning |
|---|---|
| `0x01`, `mask` | Mouse button state. Bits: left `1`, right `2`, middle `4`, back `8`, forward `16`. |
| `0x02`, `usage` / `0x03`, `usage` | Key down / key up (HID usage) |
| `0x09`, `bit` / `0x0A`, `bit` | Modifier down / up |
| `0x10`, `delta` | Wheel, signed byte, nonzero within `-127..127` |
| `0x20`, `ms` | Delay up to 255 ms. `0x21` adds a second byte for up to 60,000 ms. |

The page limits a macro to 1000 events and requires every pressed key to be released by the end.

## Firmware

The page's catalog lists files under `/releases/.../firmware/<date>/`, and a separate feed configuration points at `https://beta.updates.hitscan.com/firmware/tests/stable-218-217/`. The feed code verifies an Ed25519 signature against a public key named `hitscan-firmware-1` and checks SHA-256 digests. Each catalog entry also carries a SHA-256 and a byte count per file.

| Catalog ID | Mouse | Mouse version | Receiver | Receiver version | Format |
|---|---|---|---|---|---|
| `Hitscan136` (Hyperlight X) | `3770:0136` | `0.0.2.18` | `3770:0300` | `0.0.2.17` | Intel HEX |
| `Hitscan194` (Hyperlight N) | `3770:0194` | `0.0.2.18` | `3770:0300` | `0.0.2.17` | Intel HEX |
| `Hitscan` (retired) | `3770:F101` | `0.0.0.4` | `3770:F301` | `0.0.0.4` | `.xvi` |

Each Hyperlight model ships two mouse images, `WCH564C` and `54L15`, and two receiver images, `WCH564C` and `54L05`. The names look like two MCU variants. Both are listed under one version, and I did not find where the page chooses between them. The stable 2026-11-13 release notes for both mice mention better battery reporting, swipe-click protection, rapid-click handling, profile-cycling that skips disabled profiles, and profile LEDs (red for profile 1, blue for 2, green for 3).

## Caveats

- I did not trace every reply layout or the bytes beyond the header for each command, so the tables list the header and the parameters visible at `[6]` and `[7]`.
- The lighting effect, lightness and DPI power mode commands take parameters I did not decode.
- The retired `Hitscan` entry and the `.xvi` format appear only in the firmware catalog. The page cannot connect to those devices in normal mode.
- The page is a beta and its feed path contains `tests/`, so the firmware set may change.
