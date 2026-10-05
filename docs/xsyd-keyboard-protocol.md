# XSYD keyboard protocol (from the xsyd.top web driver)

Source: the public JavaScript of https://xsyd.top (the "星闪悦动" web driver, v2 bundle). Read from the shipped
bundle only. Nothing here has been tested against a device. Items marked (inferred) come from how the driver
parses replies, not from a capture.

## Transport

- WebHID, usage `1`, usage pages `0xFFB0` (65456) and `0xFF80` (65408).
- Requests: `device.sendReport(0, frame)`. Report ID 0, 64 bytes, zero padded. There is no checksum at this layer.
- Replies: `inputreport` events. The driver queues them and hands the next one to the waiting request, with retries.
- The device filter list (vendor and product IDs) is not in the bundle. It is fetched from an API that needs
  headers the page adds, then decrypted client side. Use the capture page to read it from a real session instead.

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
| `[1, 3]` features | `[2]` switch type bits: 1 mechanical, 2 magnetic, 4 optical, 8 inductive, 16 magnetic 3D. `[3]` connection bits: 1 USB, 2 2.4G, 4 BLE, 8 USB3. `[4]` bit 1 RGB, bit 2 knob. `[5]` bit 1 small screen, 2 full screen, 4 haptic, 8 voice |

## Global (2)

Frame: `[2, command, action, value?]`. Action: `0` read list, `1` read, `2` write. Reply value is at byte 3.

| command | name | notes |
|---------|------|-------|
| 1 | ResetFactory | argument is a scope: 0 all, 1 calibration, 2 performance, 3 lighting, 4 layout, 5 higher key, 6 macro, 7 axis |
| 2 | SaveParam | same scopes, plus 15 for high polling rate reset |
| 3 | ConfigSwitch | write value 0 to 3 selects config 1 to 4. `[2,3,3,i]` reads the name of config i (reply bytes `[4..35]`, UTF-8). `[2,3,4,i,...utf8]` sets it, 32 bytes max |
| 4 | SystemSetting | value 0 Windows, 1 Mac |
| 5 | ReportRateSetting | value 0 8 kHz, 1 4 kHz, 2 2 kHz, 3 1 kHz, 4 500 Hz, 5 250 Hz, 6 125 Hz. Action 0 returns the list the board supports: byte 3 is the count, then that many values |
| 6 | CalibrationSetting | value 0 start, 1 stop |
| 7 | AxisLibraryQuery | reply byte 3 is the count, then that many 16 bit axis IDs |
| 8 | EffectAreaQuery | lighting areas |
| 9 | ModifyDefaultAxis | |
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
| `[3, 6, system << 4 or fn, row]` get default layout row | `[2]` is `system << 4 or fn`, `[3]` row, `[4..]` codes |

Layout styles: 0 104 key, 1 87, 2 99, 3 68, 4 75, 5 84.

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

The meaning of `mode` values is not in the bundle.

Live key data: `[4, 3, sub, row]` with sub 0 ADC, 1 route, 2 calibrate, 3 key status. Reply: `[2]` sub, `[3]` row, then 16 bit values from byte 4.

## Higher key modes (6)

Key mode IDs the UI uses: 0 none, 1 DKS, 2 MPT, 3 MT, 4 TGL, 5 END, 6 SOCD, 7 RS. SOCD resolution: 0 cover, 1 priority A, 2 priority B, 3 neutral. Packet layouts were not decoded.

## Power and connection (probably category 13)

| request | reply |
|---------|-------|
| basic info | `[2]` mode, `[3]` charging, `[4]` battery. Mode 0 USB, 1 2.4G, 2 to 4 Bluetooth 1 to 3 |
| set sleep | shallow and deep sleep times as 32 bit values |
| get sleep | `[2..5]` shallow, `[6..9]` deep |

## Not decoded yet

Lighting (5), macros (7), voice (14), touch (15), the screen (12), and the key higher-function packets. The helper
functions are in the same bundle region and can be read the same way.

## Do not implement

Firmware upgrade (8): app to boot, flash, validate, boot to app. A bad flash can brick the board and none of it is
needed to configure it.
