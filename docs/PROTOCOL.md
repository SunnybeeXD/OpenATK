# ATK mouse HID protocols

Two unrelated wire formats ship under the ATK brand. Which one a device speaks is
determined by the vendor HID interface it exposes, not by model name — the same
model can appear in both families as different hardware revisions.

| Family | Interface | Frame | Checksum |
|---|---|---|---|
| BITMOUSE | `usagePage 0xFF05`, `usage 1` | 63 bytes | additive |
| COMPX | `usagePage 0xFF04`, `usage 2` | 16 bytes | `85 − sum` |

Vendor ID is `0x373B` throughout.

Both use **output report ID 8** (`sendReport`, *not* `sendFeatureReport`) and receive
replies asynchronously as **input reports**. Correlate a reply to its request by the
command byte; there is no sequence-number matching in practice.

Devices with `receiver: true` in the vendor registry are wireless dongles. A dongle
enumerates under its own PID and reports a generic product name, so identify the
paired mouse from its CID/MID pair instead.

---

## BITMOUSE — `0xFF05`

### Frame

```
byte 0   checksum = sum(bytes 1..62) & 0xFF
byte 1   cmdCode  = 0x72        (0x73 marks a device-initiated report)
byte 2   paramLen               (on RX: returnStatus, 0xFF = error)
byte 3   cmdSn                  (sequence; 0 is accepted)
byte 4   target                 0 = dongle, 1 = mouse behind dongle
byte 5   commandId
byte 6   cmdLen
byte 7+  payload
```

Mouse-directed commands need `target = 1` when talking to a receiver. Dongle-scoped
commands — `GetDeviceType`, `GetDongleVersion`, pairing — use `target = 0`. A wrong
target byte produces silence, not an error.

**Input reports omit the checksum byte.** Prepend a `0x00` to realign them with the TX
layout, or subtract one from every offset. Reply payloads then start at index 7.

### Commands

| ID | Name | paramLen | cmdLen |
|---|---|---|---|
| `0x01` | SetReportRate | 3 | 1 |
| `0x02` | SetDpi | 12 | 10 |
| `0x03` | SetSilentHeight | 4 | 2 |
| `0x07` | GetBatteryLevel | 2 | 1 |
| `0x09` | GetCurrentMouseConfig | 19 | 17 |
| `0x0B` | SetLinearCorrection | 3 | 1 |
| `0x0C` | SetRippleControl | 3 | 1 |
| `0x0D` | SetMotionSync | 3 | 1 |
| `0x0F` | GetBatteryChargingStatus | 2 | 1 |
| `0x13` | Reset (factory) | 2 | 1 |
| `0x15` | SetSensorSleepTime | 5 | 2 |
| `0x16` | SetStabilizationTime | 3 | 1 |
| `0x17` | GetAddressData | 10 | 13 |
| `0x18` | SetAddressData | — | — |
| `0x1A` | GetDeviceType | 2 | 1 |
| `0x1B` | SetFarDistance | 3 | 1 |
| `0x1C` | GetDeviceVersion | 5 | 3 |
| `0x1F` | SetSensorModel | 3 | 1 |
| `0x21` | SetSensorAngle | 4 | 2 |
| `0x22` | MouseBHOP | 6 | 4 |
| `0x47` | GetChipId | 10 | 8 |
| `0x4A` | MouseCidMid | 8 | 6 |
| `0xAA` | VirtualCenterSetting | — | — |
| `0xAB` | DynamicSensitivitySetting | — | — |
| `0xAC` | DynamicSensitivityPreset | 25+2 | 25 |
| `0xAE` | GetChargeRemainingTime | 6 | 4 |
| `0x81` | GetDongleConnectStatus | — | — |
| `0x82` | SetDonglePairMode | 3 | 0 |
| `0x83` | ClearDonglePairInfo | 3 | 0 |
| `0x84` | GetDonglePairStatus | 3 | 1 |
| `0x88` | GetDongleVersion | 5 | 3 |
| `0x89` | GetMouseCidMidDongle | 8 | 6 |

### `GetCurrentMouseConfig` (`0x09`) reply

Most live state arrives in this one packet. Payload offsets:

```
+0   configIndex (profile)
+1   config version
+2   reportRate
+3   dpiValue        uint16 LE  ← unreliable, reads 0 on some firmware
+4   silentHeight
+5   offsetCalibration          ← the lift-off value actually in use
+6   motionSync
+7   linearCorrection
+8   rippleControl
+9   sensorSleepTime uint16 LE  (seconds)
+11  stabilizationTime          (ms)
+12  buttonLeftType
+13  buttonRightType
+14  buttonMiddleType
+15  buttonBackType
+16  buttonForwardType
```

Read sensitivity from the DPI table, not from `dpiValue`. The vendor's own software
never reads that field either.

### Polling rate

```
1000 Hz = 0   500 Hz = 1   250 Hz = 2   125 Hz = 3
8000 Hz = 4  4000 Hz = 5  2000 Hz = 6
```

Note this is an arbitrary index, not a divider or a bitfield.

### DPI table

Not in the config packet. It lives in address space and is read via `GetAddressData`
in ten-byte chunks: addresses `10n + 1` for `n = 0..6`, concatenated into 70 bytes.

```
+0        currentIndex (active stage)
+1        stage count
+2 + 8i   xDpi uint16 LE
+4 + 8i   yDpi uint16 LE
+6 + 8i   colour, stored B, G, R, pad
```

DPI is a plain little-endian uint16 — no packing, no multiplier nibble.

`SetDpi` (`0x02`) payload:

```
[stageIndex, xLo, xHi, yLo, yHi, B, G, R, pad, enable]
```

`enable = 1` makes that stage active.

### Other address-space reads

| Address | Length | Content |
|---|---|---|
| `1` | 10 × 7 | DPI table (above) |
| `74` | 1 | sensor performance mode |
| `75` | 1 | far-distance (long range) flag |
| `2692` | 2 | sensor angle |

### Sensor performance mode

Read from address `74`, written with `SetSensorModel` (`0x1F`), payload `[mode]`:

`0` Auth, `1` LowPerformance, `2` HighPerformance, `3` Office, `4` Game,
`5` GameHighPerformance.

The vendor UI presents three choices and only ever writes three of these six —
Basic Mode → `0`, Competitive Firmware → `4`, Competitive Firmware MAX → `5`.
Whether the competitive tiers appear at all is gated on firmware flags the
device doesn't report over HID, so a device can answer the read with a mode it
will refuse to be set to.

### Sensor angle

Read from address `2692`, two bytes, `[enable, degrees]`. Written with
`SetSensorAngle` (`0x21`), payload `[enable, degrees]` — same order.

`degrees` is a signed byte in two's complement, and the vendor UI clamps it to
±30°: `display = raw > 30 ? raw − 256 : raw`, `raw = deg < 0 ? deg + 256 : deg`.

Note that COMPX stores the same two fields in the opposite order.

### Lift-off distance

`SetSilentHeight` (`0x03`) payload is `[height, offsetCalibration]`. The live path
always sends `height = 0` and carries the value in `offsetCalibration`.

```
offsetCalibration = code − 1
mm                = (code + 6) / 10        code 1 = 0.7 mm … code 11 = 1.7 mm
```

So 0.7 mm writes `0` and 1.7 mm writes `10`. Read back as
`mm = (offsetCalibration + 7) / 10`.

⚠️ The vendor bundle also defines `uiSilentHeightToProtocol = {1:2, 2:3, 3:1}` and its
inverse. **These are dead code** — no call sites anywhere. Implementing them scrambles
the mapping.

Devices whose sensor is PAW3950 Ultra or PAW3955 Master get the continuous
0.7–1.7 mm range. Other sensors use a three-level picker in the vendor UI.

### Sleep and debounce

Sleep is a uint16 LE in **seconds**. The vendor's option list is
`30, 60, 120, 180, 300, 1200, 1500, 1800`.

Debounce is one byte of milliseconds: `0, 1, 2, 4, 8, 15, 20`. Hardware flagged
`noZeroKeyDebounce` in the vendor registry drops the `0` option; most do not.

---

## COMPX — `0xFF04`

### Frame

```
byte 0     commandId
byte 1     commandStatus          (0 when sending)
byte 2-3   eepromAddress          uint16 BIG endian
byte 4     dataValidLen
byte 5-14  payload
byte 15    checksum
```

```
checksum = 85 − (sum([8, ...bytes 0..14]) & 0xFF)
```

The literal `8` is the report ID, folded into the sum despite not being in the buffer.
This is the single most common thing to get wrong.

Input reports keep this layout, so a reply's payload starts at index 5 with no
realignment needed.

### Commands

| ID | Name |
|---|---|
| `0x01` | DownLoadData |
| `0x02` | DownLoadDriverStatus |
| `0x03` | GetWirelessMouseOnline |
| `0x04` | GetBatteryLevel |
| `0x05` | SetWirelessDonglePair |
| `0x06` | GetWirelessDonglePairResult |
| `0x07` | **SetEEPROM** |
| `0x08` | **GetEEPROM** |
| `0x09` | RestoreFactory |
| `0x0A` | ReportMouseStatus |
| `0x0D` | EnterUSBUpgradeMode ⚠️ |
| `0x0E` | GetCurrentConfig |
| `0x0F` | SetCurrentConfig |
| `0x10` | GetMouseCIDMID |
| `0x12` | GetMouseVersion |
| `0x13` | DongleExitPair |
| `0x14` / `0x15` | Set / Get4KRGBMode |
| `0x16` / `0x17` | Set / GetFarDistanceMode |
| `0x18` / `0x19` | Set / GetDongleLightMode |
| `0x1D` | GetDongleVersion |
| `0x5A` / `0x5B` | upgrade status reports |

`GetBatteryLevel` returns level at `+0`, charge state at `+1`, voltage as uint16 at `+2`.

### EEPROM map

**Nearly every stored byte is followed by its `85 − value` inverse.** The map's `*CRC`
entries are those companion bytes.

```
0x00 reportRate          0x01 reportRateCRC
0x02 maxDpi              0x03 maxDpiCRC
0x04 currentDpi          0x05 currentDpiCRC
0x0A silentHeight        0x0B silentHeightCRC
0x0C dpi1   0x14 dpi3   0x1C dpi5   0x24 dpi7      (4 bytes/stage, 2 stages per row)
0x2C dpi1Color  0x34 dpi3Color  0x3C dpi5Color  0x44 dpi7Color
0x4C dpiRGBLightingEffects   0x4E brightness  0x50 speed  0x52 dpiRGBEnable
0x54-0x5F  articleLamp R/G/B, effects, brightness, breath speed, energy saving
0x60-0x9C  key0..key15 (4 bytes each)
0xA0 decorationLight
0xA9 stabilizationTime   ← debounce
0xAB motionSync
0xAD closeLedTime        ← sleep, stored in units of ten seconds
0xAF linearCorrection
0xB1 rippleControl
0xB3 moveCloseLights
0xB5 sensorEnable   0xB7 sensorTime   0xB9 sensorMode   ← one 6-byte row
0xBB rfTxTime
0xBD angle               ← sensor rotation, 4-byte row
0xE3 rollingDelay
0x100-0x2E0  keyShortcuts0..15
0x300+       macro0..15
0x1B00+      paw3955Dpi1..8 (6 bytes each)
0x1B30 dynamicSensitivity   0x1B34 dynamicSensitivityPoints
0x1B48 sensorCenterPoint    0x1B4C fastTriggerDebounce
```

Three rows are read-modify-write, because several settings share them:

- **`0x00`, 10 bytes** — `[rate, ~rate, maxDpi, ~maxDpi, currentDpi, ~currentDpi, bhop, ~bhop, buttonOpMode, ~buttonOpMode]`
- **`0xA9`, 10 bytes** — `[debounce, ~, motionSync, ~, closeLedTime/10, ~, linearCorrection, ~, rippleControl, ~]`
- **`0xB5`, 6 bytes** — `[sensorSleepEnabled, ~, sensorSleepTime/10, ~, sensorModel, ~]`

Writing a whole row with stale neighbours silently clobbers them.

### Sleep — two clocks, not one

COMPX keeps two independent idle timers and the vendor's single "sleep time"
control writes **both**:

- `closeLedTime` at `0xAD` (inside the `0xA9` row), the value read back as the
  device's sleep setting;
- `sensorSleepTime` at `0xB7` (inside the `0xB5` row), the sensor's own timer,
  written together with `sensorSleepEnabled = 1` at `0xB5`.

Both hold **units of ten seconds**. Writing only `closeLedTime` leaves the
sensor scanning past the timeout, so the setting appears to take and the mouse
doesn't actually sleep on it. BITMOUSE has no equivalent split — its
`SetSensorSleepTime` (`0x15`) is a single uint16 of seconds.

### Sensor performance mode

`sensorModel` at `0xB9`, inside the `0xB5` row. Same enum and same three-value
vendor UI as BITMOUSE — see above.

### Sensor angle

`0xBD`, four bytes, `[degrees, ~degrees, enabled, ~enabled]`. Same signed-byte
±30° encoding as BITMOUSE, but note the fields are in the **opposite order**:
COMPX puts the angle first, BITMOUSE puts the enable flag first.

### Polling rate

```
1000 Hz = 0x01   500 Hz = 0x02   250 Hz = 0x04   125 Hz = 0x08
2000 Hz = 0x10  4000 Hz = 0x20  8000 Hz = 0x40
```

Dividers below 1000 Hz, flags above. Stored as `[value, 85 − value]`.

### DPI — PAW3950 Ultra and similar

Four bytes per stage: `[xDpi, yDpi, mode, crc]`, two stages per row.

```js
// encode one axis
let v = dpi, doubled = 0;
if (v > 30000) { doubled = 1; v = Math.round(v / 2); }
let code, flag;
if (v <= 10000) { code = Math.floor(v / 10) - 1;        flag = doubled; }
else            { code = Math.floor((v - 10050) / 50);  flag = 2 | doubled; }
byte   = code & 0xFF;
nibble = ((code >> 8) << 2) | flag;

mode = ((yNibble & 0x0F) << 4) | (xNibble & 0x0F);
crc  = (85 - ((xByte + yByte + mode) & 0xFF)) & 0xFF;
```

Decoding inverts it: bits 2–3 of the nibble extend the value byte, bit 1 selects the
50-step range above 10,000, bit 0 doubles above 30,000. This yields 10 DPI steps at
the low end and a 42,000 ceiling.

### DPI — PAW3955 Master

Different mechanism entirely. Six-byte rows at `0x1B00 + 6n`:

```
[xLo, xHi, yLo, yHi, flags, crc]

base  = dpi − 1              (values below 40,000)
flags = (xDoubled ? 1 : 0) | (yDoubled ? 16 : 0)
crc   = (85 − (xLo + xHi + yLo + yHi + flags)) & 0xFF
```

Decode: `dpi = (lo | hi << 8) + 1`, doubled if the matching flag bit is set.

### Lift-off distance

EEPROM `0x0A`, two bytes, `[code, 85 − code]`. Same millimetre mapping as BITMOUSE —
`mm = (code + 6) / 10` — but COMPX stores the **code itself**, where BITMOUSE stores
`code − 1`. Getting these two confused shifts every value by one step.

### Far distance

Not in EEPROM. Its own command pair, `0x16` set / `0x17` get, with the mode byte at
payload `+0` and `dataValidLen = 10`.

---

## Notes for implementers

- **Don't poll while gaming.** At 8000 Hz the config channel shares bandwidth with
  motion reports.
- **A sleeping mouse doesn't answer.** Battery and config reads time out until it
  moves. Degrade gracefully rather than throwing.
- **Debounce slider writes.** Dragging a lift-off slider raw will flood the dongle;
  the vendor UI waits 100 ms after the last change.
- **Avoid `EnterUSBUpgradeMode` (COMPX `0x0D`) and the bootloader paths.** Factory
  reset — COMPX `0x09`, BITMOUSE `0x13` — is the safe recovery.

## Provenance

Recovered by reading ATK's own web configurator (`hub.atk.pro`, ATK V HUB Web
3.2.21), whose client bundle carries the command enums, EEPROM address maps and unit
conversions as readable identifiers. Cross-checked against
[libatk-rs](https://github.com/cyberphantom52/libatk-rs),
[MyATxMouseControl](https://github.com/666mille/MyATxMouseControl),
[ATK_tray](https://github.com/Fan4Metal/ATK_tray),
[0x44oge-ATK](https://github.com/ReformedDoge/0x44oge-ATK) and
[OpenMouse](https://github.com/OpenMouse-Project/mouse-protocol), whose ATK codec
independently derives the same `(code + 6) / 10` lift-off mapping.

Confirmed on hardware for the ATK Zero over its 8K dongle (`0x373B:0x1155`). The
COMPX side is transcribed from the vendor bundle and cross-checked against prior
projects, but has not been exercised on hardware by this author — corrections
welcome.

This document was produced with AI assistance; see the README's *AI use* section.
