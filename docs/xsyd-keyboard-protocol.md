# XSYD keyboard protocol (from the xsyd.top web driver)

Source: the public JavaScript of https://xsyd.top (the "星闪悦动" web driver, v2 bundle). Read from the shipped
bundle only. Nothing here has been tested against a device. Items marked (inferred) come from how the driver
parses replies, not from a capture.

## Transport

- WebHID, usage `1`, usage pages `0xFFB0` (65456) and `0xFF80` (65408).
- Requests: `device.sendReport(0, frame)`. Report ID 0, 64 bytes, zero padded. There is no checksum at this layer.
- Replies: `inputreport` events. The driver queues them and hands the next one to the waiting request, with retries.
- The device filter list (vendor and product IDs) is not in the bundle. The /connect route uses the same main bundle.
  The catalog is fetched from an API, AES decrypted client side, and keyed by `vid-pid` with a usage page and usage per
  entry. Use the capture page to read it from a real session instead. OpenATK matches on the HID collection
  (usage 1 on `0xFFB0` or `0xFF80`) and does not keep a model list.

## Frame

```
byte 0   category
byte 1   command
byte 2+  arguments
```

Replies mirror this (inferred): byte 0 category, byte 1 command, then the data. Offsets below are the ones the
driver uses when it parses a reply.

All multi-byte numbers are little endian unless marked.

## Categories

| id | name |
|----|------|
| 1 | Device |
| 2 | Global |
| 3 | LayoutAndKey |
| 4 | Performance |
| 5 | Lighting |
| 6 | HigherKey |
| 7 | Macro |
| 8 | FirmwareUpgrade |
| 10 | CustomCommand |
| 12 | Displayer |
| 13 | ThreeMode |
| 14 | Voice |
| 15 | Touch |
| 16 | Handle |
| 17 | ThreeD |

## Device (1)

| request | reply |
|---------|-------|
| `[1, 1]` protocol | `[2]` main, `[3]` sub, `[4]` hardware, `[5]` software version |
| `[1, 2]` device info | `[2]` type, `[3]` subtype, `[4..7]` board ID big endian, `[8..11]` app version, `[12..15]` PCB version, `[16]` run mode, `[17..28]` serial, `[29..40]` build timestamp (ASCII) |
| `[1, 3]` features | `[2]` switch type bits: 1 mechanical, 2 magnetic, 4 optical, 8 inductive, 16 magnetic 3D. `[3]` connection bits: 1 USB, 2 2.4G, 4 BLE, 8 USB3. `[4]` bit 1 RGB, bit 2 knob. `[5]` bit 1 small screen, 2 full screen, 4 haptic, 8 voice playback, 16 voice recognition, 32 gamepad, 64 dot matrix |

## Global (2)

Frame: `[2, command, action, value?]`. Action: `0` read list, `1` read, `2` write. Reply value is at byte 3.

| command | name | notes |
|---------|------|-------|
| 1 | ResetFactory | argument is a scope: 0 all, 1 calibration, 2 performance, 3 lighting, 4 layout, 5 higher key, 6 macro, 7 axis |
| 2 | SaveParam | same scopes, plus 15 for high polling rate reset |
| 3 | ConfigSwitch | `[2,3,0]` reply byte 3 is the slot count, `[2,3,1]` reads the current slot, `[2,3,2,i]` selects slot i (0 to 3 is config 1 to 4). `[2,3,3,i]` reads the name of config i (reply bytes `[4..35]`, UTF-8). `[2,3,4,i,...utf8]` sets it, 32 bytes max |
| 4 | SystemSetting | value 0 Windows, 1 Mac |
| 5 | ReportRateSetting | value 0 8 kHz, 1 4 kHz, 2 2 kHz, 3 1 kHz, 4 500 Hz, 5 250 Hz, 6 125 Hz. Action 0 returns the list the board supports: byte 3 is the count, then that many values |
| 6 | CalibrationSetting | value 0 start, 1 stop |
| 7 | AxisLibraryQuery | `[2,7,0]`, reply byte 3 is the count, then that many 16 bit axis IDs from byte 4. An empty list means a "v2" board |
| 8 | EffectAreaQuery | lighting areas |
| 9 | ModifyDefaultAxis | `[2,9,0,value]` sets, `[2,9,1]` reads, value at byte 3. One byte, so it cannot be a 16 bit id. Whether it is a position in the axis list is not confirmed, and the set reply is not parsed by the driver |
| 10 | DoubleLightingQuery | |
| 11 | SpecialLightingQuery | |
| 12 | RtPrecisionQuery | `[2,12,0]`, reply byte 3 divided by 1000 is the minimum rapid trigger step in mm |
| 13 | SleepTimeQuery | |
| 14 | MacroSpaceInfoQuery | `[2,14,0]`, reply byte 3 macro count, bytes `[4..5]` macro number |
| 16 | ShakeOptimizationSwitch | anti-shake, open or close |
| 18 | USBModeSetting | |

"Open web driver": `[10, 1, 1, 2, 0]`.

## Layout and keys (3)

Keycodes are 16 bit.

| request | reply |
|---------|-------|
| `[3, 1, layer, row]` get layout row | `[2]` layer, `[3]` row, `[4..]` 16 bit codes (21 keys max per row) |
| `[3, 2, layer, row, ...codes]` set layout row | |
| `[3, 3, layer, row, col]` get key code | `[2]` layer, `[3]` row, `[4]` col, `[5..6]` keycode |
| `[3, 4, layer, row, col, code]` set key code | |
| `[3, 5, row]` get layout style (command 5, GetKeyLayoutStyle) | 21 entries of 16 bit little endian from byte 3: bits 15 to 11 row times 4, bits 10 to 4 column times 4, bits 3 to 0 size code. Size 0 no key, 12 knob, 13 to 15 screen |
| `[3, 6, system << 4 or fn, row]` get default layout row | `[2]` is `system << 4 or fn`, `[3]` row, `[4..]` codes |

Layout styles: 0 104 key, 1 87, 2 99, 3 68, 4 75, 5 84.

The driver reads 6 rows of 21 columns and 4 layers (Fn0 to Fn3). A key with code 0 is not present. Size codes map to
key width and height in key units: 1 is 1x1, 2 is 1.25, 3 is 1.5, 4 is 1.75, 5 is 2, 6 is 2.25, 7 is 2.5, 8 is 2.75,
9 is 6.25, 10 is 1x2, 11 is the ISO enter shape, 15 is a screen.

### Keycodes (from the driver tables)

| range | meaning |
|-------|---------|
| `0x0000` | no key. `0x0001` pass-through to the layer below |
| `0x0004` to `0x0073`, `0x00E0` to `0x00E7` | USB HID keyboard usages (4 is A, 41 is Esc, 224 to 231 are the modifiers) |
| `0x1000 < v < 0x2000` | combo: `0x1000 + (modifiers << 8) + usage`, modifier bits 1 Ctrl, 2 Shift, 4 Alt, 8 Win. The driver's "system" keys are combos (`0x1329` is Ctrl+Shift+Esc, `0x1807` is Win+D) |
| `0x2000 + n` | media, n is a USB consumer usage (`0x20E9` volume up, `0x20CD` play or pause) |
| `0x4000` to `0x4BFF` | mouse: `0x4100` left, `0x4200` right, `0x4300` middle, `0x4400` forward, `0x4500` back, `0x4600` to `0x4900` move, `0x4A01` and `0x4B01` wheel |
| `0xF100` to `0xF103` | layer keys Fn0 to Fn3 (the driver also writes pass-through to the higher layers when one is set) |
| `0xF2xx` | control: `0xF200` factory reset, `0xF201` Windows layout, `0xF202` Mac layout, `0xF203` calibrate, `0xF205` to `0xF208` configs, `0xF209` lock Win key |
| `0xF3xx`, `0xF4xx`, `0xF5xx` | lighting, wireless mode, macro slots |

The driver's `setKeyCode` does not call SaveParam afterwards.

## Performance, the magnetic switch settings (4)

Per key. Travel values are millimetres multiplied by 1000 (so 1.0 mm is 1000).

```
get:   [4, 1, row, col]
set:   [4, 2, row, col, mode,
        normalPress   u16,
        normalRelease u16,
        rtFirstTouch  u16,
        rtPress       u16,
        rtRelease     u16,
        pressDeadStroke   u16,
        releaseDeadStroke u16,
        axis, calibrate,
        axisV2Id u16, axisRangeMax u16, axisCoefficient u16]
```

Reply to get:

| byte | field |
|------|-------|
| 4 | mode |
| 5..6 | normalPress |
| 7..8 | normalRelease |
| 9..10 | rtFirstTouch |
| 11..12 | rtPress |
| 13..14 | rtRelease |
| 15..16 | pressDeadStroke |
| 17..18 | releaseDeadStroke |
| 19 | axis |
| 20 | calibrate |
| 21..22 | axisV2Id |
| 23..24 | axisRangeMax |
| 25..26 | axisCoefficient |

`mode` is 0 fixed point (uses normalPress), 1 rapid trigger, 2 interval rapid trigger (the driver's `Normal`, `RT` and `IntervalRT`). The driver writes `calibrate` as 0 on every set and edits one key at a time. Travel limits in the UI are the rapid trigger step from `[2,12,0]` up to the key's axis range (3.4 mm when none is known), and 0 to 1 mm for dead zones. The set reply uses the same layout as the get reply.

Key `[4, 1, row, col]` has no row or column echo documented, so OpenATK only checks category, command and length, plus that written fields come back as sent.

Live key data: `[4, 3, sub, row]` with sub 0 ADC, 1 route, 2 calibrate, 3 key status. Reply: `[2]` sub, `[3]` row, then 16 bit values from byte 4.

### Switch data (the vendor's Axis tab)

The per-key performance packet carries the switch. On v1 boards (non-empty axis list) the per-key `axis` byte is the
position in the board's own id list. On v2 boards (empty list) the key uses `axisV2Id`, `axisRangeMax` (micrometres,
3400 is 3.4 mm) and `axisCoefficient`. The vendor page fills these from a remote catalog (brands, names, ranges) that
is not in the bundle and is not reproduced here. After a switch change the driver writes `calibrate` as 0, and the keys
need the vendor calibration flow (`calibrate` 0 none, 1 calibrated, 2 in progress). The driver's v1 write sends only the
`axis` field changed. Wrong values mis-scale travel. OpenATK copies switch fields between keys, picks from the board's
list, and offers numeric entry on v2 boards, each as a read-modify-write that is read back.

## Higher key modes (6)

Key mode IDs the UI uses: 0 none, 1 DKS, 2 MPT, 3 MT, 4 TGL, 5 END, 6 SOCD, 7 RS. SOCD resolution: 0 cover, 1 priority A, 2 priority B, 3 neutral. Packet layouts were not decoded.

## Power and connection (category 13)

| request | reply |
|---------|-------|
| `[13, 1]` basic info | `[2]` mode, `[3]` charging, `[4]` battery. Mode 0 USB, 1 2.4G, 2 to 4 Bluetooth 1 to 3 |
| `[13, 2, ...]` set sleep | shallow and deep sleep times as 32 bit values |
| `[13, 3]` get sleep | `[2..5]` shallow, `[6..9]` deep |

## Not decoded yet

Lighting (5), macros (7), voice (14), touch (15), the screen (12), and the key higher-function packets. The helper
functions are in the same bundle region and can be read the same way.

## Do not implement

Firmware upgrade (8): app to boot, flash, validate, boot to app. A bad flash can brick the board and none of it is
needed to configure it.
