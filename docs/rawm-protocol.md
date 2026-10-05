# RAWM Leviathan V4 GT protocol (from RAWM HUB v3.0)

Source: the public JavaScript and JSON config of https://www.rawmtech.com/hub3.html, which frames
https://www.rawmhub.com/hub3/. Read from the shipped bundle only. Nothing here has been tested against a device.
The older hub at https://www.rawmtech.com/hub.html (library.min.js) does not know this mouse and has no magnetic
switch code. It also filters on vendor 0x1915, which is why the V4 GT never shows up there.

## Device

| model | vendor | product | notes |
|-------|--------|---------|-------|
| Leviathan V4 GT, wired | 0x373E | 0x0098 | |
| Leviathan V4 GT, 8K dongle | 0x373E | 0x0099 | the mouse is reached through the dongle |

Config values for the V4 GT (`Config/env-models.json`): DPI 50 to 45000 in steps of 1, 6 DPI stages, LOD 0.7 / 1 / 2 mm,
polling 125 / 250 / 500 / 1000 / 2000 / 4000 / 8000 Hz, new protocol (`IsNewProtocol` 1). The profile count is read from the mouse.
Bootloader product IDs are 0xB098 (mouse) and 0xB099 (dongle). Firmware flashing is not implemented here.

## Transport

- WebHID. Two HID interfaces of the same USB device are used:
  - the one with a **feature report of 64 bytes** (report ID 0) carries commands and replies;
  - the one with an **input report with ID 4** carries notifications.
- Request: `sendFeatureReport(0, 64 bytes)`. Wait 30 ms. Reply: `receiveFeatureReport(0)`.
- Request layout:

```
[0] 0
[1] 0
[2] target   2 mouse, 0 or 1 dongle
[3] length   payload bytes after the command byte (fixed per command, see tables)
[4] category
[5] command  get commands have bit 7 set (0x80 | n)
[6..] arguments
```

- Reply: some firmwares return the buffer with a leading byte and some without. Detect it from the firmware version
  reply (`[2,16,0,0x81]`): if byte 6 is 0x81 the reply has the extra byte (`hidIndex` 0), if byte 5 is 0x81 it does not
  (`hidIndex` 1). Strip the extra byte and index the reply as `N`:

```
N[0] 0xA1 means ok. Above 0xA1 means busy, resend. Below 0xA1 means not ready, read again.
N[2] target, N[3] length, N[4] category, N[5] command echo, N[6..] arguments echoed, then the values
```

- Retry rule used by the hub: if `N[0]` is neither 0xA1 nor 0x02, up to 5 rounds of "wait, read again up to 30 times,
  then resend". A stale reply to an earlier command shows up as a wrong command echo in `N[5]`.

## Commands

`p` is the profile number, 1 based. Values are in `N`.

| what | request (`[3]`,`[4]`,`[5]`,args) | reply |
|------|--------------------------------|-------|
| firmware, target t | `t`: `[16,0,0x81]` | `N[6..9]` version bytes |
| EID | `2`: `[2,0,0x82]` | `N[6]`, `N[7]` |
| battery | `2`: `[2,0,0x83]` | `N[6]` charging, `N[7]` percent |
| profile count | `[1,0,0x86]` | `N[6]` |
| current profile | `[1,0,0x85]` | `N[6]` |
| set profile | `[1,0,5,p]` | |
| reset profile | `[1,0,13,p]` | |
| polling get | `[2,1,0x80,p]` | `N[7]` key (16 means 1) |
| polling set | `[2,1,0,p,key]` | |
| LOD get / set | `[2,1,0x88,p]` / `[2,1,8,p,v]` | `N[7]` |
| glass mode | `[2,1,0x8E,p]` / `[2,1,14,p,v]` | `N[7]` |
| motion sync | `[2,1,0x89,p]` / `[2,1,9,p,v]` | `N[7]` |
| ripple control | `[2,1,0x8A,p]` / `[2,1,10,p,v]` | `N[7]` |
| angle snap | `[2,1,0x84,p]` / `[2,1,4,p,v]` | `N[7]` |
| angle tune | `[2,1,0x94,p]` / `[2,1,20,p,v]` | `N[7]`, signed, -30 to 30 |
| sensor work state | `[3,1,0x98,p]` / `[3,1,24,p,v]` | `N[7]` 1 low power, 2 high performance, 3 competition |
| tracking mode | `[2,1,0x93,p]` / `[2,1,19,p,v]` | `N[7]` (competition only) |
| DPI X/Y separate | `[2,1,0x8D,p]` / `[2,1,13,p,v]` | `N[7]` |
| button combination | `[2,3,0x81,p]` / `[2,3,1,p,v]` | `N[7]` |
| sleep time | `[3,0,0x87,p]` / `[3,0,7,p,hi,lo]` | `N[7]<<8 \| N[8]` seconds; 0, 0xFF00, 0xFFFF mean off |
| scroll hysteresis | `[4,0,0x99,p]` / `[4,0,25,p,on,hi,lo]` | `N[7]` on, `N[8]<<8 \| N[9]` window 100 to 1000 |
| active DPI stage | `[2,1,0x82,p]` / `[2,1,2,p,stage]` | `N[7]` 1 based |
| DPI stages | get `[10,1,0x81,p,6]` set `[26,1,1,p,count,...]` | `N[7]` count, then 4 bytes per stage: X hi, X lo, Y hi, Y lo from `N[8]` |
| DPI stage colours | `[19,2,0x81,p]` / `[19,2,1,p,...18 bytes]` | RGB per stage from `N[7]` |
| receiver LED | target 1: get `[5,2,0x80,1]` set `[5,2,0,1,255,mode,0,0]` | `N[8]` mode: 12 connection, 6 battery, 13 battery warning |

LOD byte: 1 or 2 means mm. Below 1 mm it is `(mm*10) | 128`, so 0.7 mm is 135.
Angle tune is sent as a signed byte (`256 + v` for negatives).
Sleep time is seconds, the hub UI uses 1 to 30 minutes.

### Magnetic and optical switch (left and right click)

Key 1 is the left click, key 2 the right click. Travel is in 10 steps. The hub writes 9 for release when
"separate press/release travel" is off, so a stored release of 9 means "same as press".

| what | request | reply |
|------|---------|-------|
| switch type get | `[8,0,0x95]` | `N[7]` left, `N[8]` right: 3 magnetic, 2 optical |
| switch type set | `[8,0,21,eid,left,right]` | |
| travel get | `[4,3,0x85,p,key]` | `N[8]` press, `N[9]` release |
| travel set | `[4,3,5,p,key,press,release]` | |
| rapid trigger get | `[3,0,0x98,p,key]` | `N[8]` 0 to 15 |
| rapid trigger set | `[3,0,24,p,key,value]` | |
| calibration state | get `[6,3,0x86]`, set `[3,3,7,state]` | see below |

`eid` is the value of the EID query with 255 turned into 0.

UI rules from the hub: press below 3 and release below 5 show a warning. "Reset All" writes press 3, release 9, rapid
trigger 0 for both keys and switch type 2 (optical) for both.

Calibration (`state` argument of the set command; the reply is a full status report):

- `5` read status, `4` start the two-button routine. The older routine starts with `1` and reads status with `3`.
- Status fields in `N`: `N[7]` step (7 done, 8 failed, 9 cancelled), `N[9]` result code, `N[25]` required action mask,
  `N[27]` equals 7 for the two-button routine, `N[30]` and `N[31]` left and right progress, `N[32]` bits 1 and 2 left
  and right ready.
- Steps: 1 release both, 2 press left, 3 release left, 4 press right, 5 release right, 6 verifying, 7 success,
  8 failed, 9 cancelled, 10 press both, 11 release both.
- From the plain calibration status read: `N[10]` non-zero means the switch is not calibrated, `N[11]` equal to 64
  means it needs recalibration.

## Notifications (input report ID 4)

`s[0]` is the report ID (4), `s[1]` the type, then data.

| type | meaning |
|------|---------|
| 1 | DPI stage: `s[2]` stage, X `s[3..4]`, Y `s[5..6]` (big endian) |
| 4 | same, with an extra byte: stage `s[3]`, X `s[4..5]`, Y `s[6..7]` |
| 3 | battery: `s[2]` percent, `s[3]` charging |
| 6 | link: `s[2]` 0 offline, 1 online |
| 7 | LOD changed, `s[2]` |
| 8 | polling rate changed, `s[2]` key |
| 9 | factory reset happened |
| 15, 16, 17 | motion sync, ripple control, angle snap, `s[2]` 1 on |
| 34 | button combination, `s[2]` 1 on |
| 35 | DPI X/Y separate, `s[2]` 1 on |

## Polling rate keys

125 → 8, 250 → 4, 500 → 2, 1000 → 1, 2000 → 32, 4000 → 64, 8000 → 128.
Low power mode allows up to 1000 Hz. High performance and competition modes allow 1000 Hz and above.

## Not implemented

Button remapping, macros, profile names (stored as GBK), firmware updates, factory reset. Firmware flashing can brick the
mouse and none of it is needed to configure it.
