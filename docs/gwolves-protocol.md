# G-Wolves (mouse.fit) protocol notes

Read from the code of the G-Wolves web hub (mouse.fit), which is the same "DriverCore" app family as the RAWM hub. Nothing here has been checked against a real mouse. The page is `gwolves/index.html`.

## Scope

The hub has two driver classes. Models with `XVI=0` (the "JM" family) use the 16 byte EEPROM protocol below. Models with `XVI=1` (24 older models) use the 64 byte feature report protocol already documented in [`rawm-protocol.md`](rawm-protocol.md). Only the `XVI=0` family is implemented.

| MID | Model | Wired PID | Sensor | Notes |
| --- | --- | --- | --- | --- |
| 2 | HTS Plus | 5418 | 3950 | |
| 4 | Lycan | 4718 | 3950 | |
| 5 | HTXU | 5618 | 3950 | |
| 6 | Lycan | 4719 | 3955 | |
| 7 | HTXU | 5619 | 3955 | |
| 8 | HTS Plus | 5419 | 3955 | |
| 9 | Fenrir Pro | 3619 | 3955 | |
| 10 | HTX Mini | 2719 | 3955 | |
| 11 | HTS Plus Pro | 5219 | 3955 | `ButtonType=1`, magnetic |
| 12 | WARG | 4219 | 3955 | |
| 17 | Fenrir Asym | 3519 | 3955 | |

Vendor ID is 0x33E4. The wireless dongle is 0x3854 for every one of these, so the model is found with the EID command (below).

## Transport

Output and input report ID 8, 16 bytes of data after the ID.

```
[cmd, 0, addrHi, addrLo, len, payload..., crc]
crc = (85 - sum(b0..b14) - 8) & 255
```

Replies arrive as input report 8 with `data[0] == cmd`. Input report 8 with `data[0] == 10` is a notification, not a reply.

| cmd | Meaning |
| --- | --- |
| 1 | EID: `len=8`, 4 random bytes at 5..8. Reply `data[10]` is the MID (0 is treated as 2 by the hub), `data[11]==1` is a 4K dongle |
| 4 | Battery: `data[5]` percent, `data[6]` charging |
| 7 | EEPROM write, up to 10 bytes |
| 8 | EEPROM read, up to 10 bytes, reply payload at `data[5..]` |
| 14 / 15 | Get / set profile, `data[5]` is index minus 1 |
| 18 | Mouse firmware, `data[5]` and `data[6]` |
| 46 | Start magnetic button calibration: `len=10`, payload `[1, 0, 3]` |

## EEPROM map

Most values are stored as pairs `[v, (85 - v) & 255]`. A read is valid only if the two bytes add up to 85 modulo 256. The hub reads an invalid pair as 0, the page treats it as unknown.

| Address | Value |
| --- | --- |
| 0 | Polling rate code: 1000 `0x01`, 500 `0x02`, 250 `0x04`, 125 `0x08`, 2000 `0x10`, 4000 `0x20`, 8000 `0x40` |
| 2 | DPI stage count (max 7) |
| 4 | Active DPI stage, index from 0 |
| 10 | Lift off. Three options: 0.7 is 3, 1 is 1, 2 is 2. Five options (3955): index plus 1 |
| 12 + 4n | 3950 DPI row `[x, y, hi, crc]`, step 50, `hi` holds the two high bits of x (bits 2-3) and y (bits 6-7) |
| 0x1B00 + 6n | 3955 DPI row `[xLo, xHi, yLo, yHi, hi, crc]`, step 1, stored as DPI minus 1 |
| 44 + 4n | Stage colour `[r, g, b, crc]`, crc is `85 - sum` of the first bytes |
| 171 / 175 / 177 | Motion sync, angle snap, ripple control (0 or 1) |
| 173 | Sleep time in units of 10 seconds |
| 225 | Competitive mode (0 or 1) |
| 239 / 245 | Left / right trigger point, stored value is the slider value minus 1, slider 1..20 |
| 241 / 247 | Left / right rapid trigger, byte is `(enabled << 7) \| value`, value 1..10 on the slider |
| 243 / 249 | Tactile feedback (read by the hub, no control in its UI) |

## Magnetic buttons (HTS Plus Pro)

The hub shows trigger point sliders for each button, a Rapid Trigger section behind an expander (wired only, with the warning that RT is factory calibrated) and a Button Calibration card (wired only).

### Calibration

Command 46 starts it. The mouse's LED blinks white and then goes solid green. The hub waits 2 seconds, then follows notifications:

- Notification: `data[0] == 10`. `data[5]` is a flag byte: 1 DPI changed, 2 polling changed, 4 profile changed, 64 battery. When `data[5] == 0` it is a live depth report: `data[13] & 127` is the left button depth and `data[14] & 127` the right, 0 to 100.
- Step 2: both depths reach 100. Step 3: both return to 0. Step 4: done.

No failure state exists in the hub. The mouse never reports a result, so "Calibration Successful" only means the page saw a full press and release. The page adds a timeout and a "no readings" failure, blocks writes while it runs, and suppresses the context menu (the right button held fully would open it).

The hub colours a depth bar green once `depth / 5 >= trigger point`, orange before that. The page does the same.

## Not covered

Button remapping and macros, lighting, debounce, sensor virtual position, long distance mode, profile switching, factory reset and firmware updates.
