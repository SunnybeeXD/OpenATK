# Pulsar Bibimbap protocol research

These notes describe the publicly served [Pulsar Bibimbap](https://bbb.pulsar.gg/) hub as inspected on 2026-11-17 (hub config `1.2.3`, mouse catalog `1.3.14`). Everything here comes from the shipped JavaScript and the JSON configs it loads. **Nothing has been tested on a device**, and the bundle is evidence, not a specification. The site can change after that date.

Sources:

- `bbb.pulsar.gg/cfg.json`: the hub's device groups. Its app bundle is `js/app.3283b4c5.js`.
- `bbb.pulsar.gg/cMouse/cfg.json` and `js/app.3c6e7884.js`: the main mouse configurator and its catalog.
- `bbb.pulsar.gg/vMouse/assets/index-BkdSefSO.js`, `zywoo/assets/index-0625d99c.js`, and the Flutter builds `nKey/main.dart.js` and `sKey/main.dart.js`.

## Structure

The site is a hub plus five separate configurator sites. The hub asks the browser for any device in its list, reads the device's vendor and product IDs, and sends the browser to the sub-site named by the matching entry's `router`. Each sub-site is its own app with its own protocol.

| Router | Vendor IDs | PIDs | Interface filter |
|---|---|---|---|
| `/cMouse` | 3710 | 75 | - |
| `/cMouse` | 3554 | 1 | - |
| `/sKey` | 3710 | 7 | - |
| `/sKey` | 3710 | 1 | - |
| `/zywoo` | 3710 | 2 | - |
| `/nKey` | 3710 | 4 | usage page `0xFF60`, usage `0x61` |
| `/vMouse` | 3710 | 3 | - |

The hub config lists these PIDs (hexadecimal):

- `/cMouse` on `3710`: 5603 5406 5407 5501 5502 5503 5504 3414 3415 3501 3502 3503 3504 3505 3506 3507 3508 3509 3510 3511 3512 3513 3514 3515 3516 3517 3518 3519 3520 3521 3522 3523 3524 3525 3526 3527 3528 3529 7501 7502 7503 7504 7505 7506 7507 7508 7509 7510 9502 9601 7601 F004 F005 3601 5601 7602 7604 3603 7603 9503 3611 3604 3605 3606 3607 3608 3609 3612 3613 3614 3615 3618 3619 3610 7605
- `/cMouse` on `3554`: F40A
- `/sKey` on `3710`: 2404 2502 2503 2504 2506 2507 8601 and F003
- `/zywoo` on `3710`: 5405 7401
- `/nKey` on `3710`: 2402 2403 2407 2408
- `/vMouse` on `3710`: 9604 5602 9605

## Hub shell

The hub itself speaks the COMPX protocol described below (output report 8) to read a device's identity, battery and pairing state, and to run firmware upgrades. The commands it uses are `EncryptionData` (1), `PCDriverStatus` (2), `DeviceOnLine` (3), `DongleEnterPair` (5), `GetPairState` (6), `StatusChanged` (10), `ReadVersionID` (18) and `GetDongleVersion` (29). It shows each recently used device with a picture named `img/<router>/<cid hex><mid hex>.png`, falling back to `demo.png`.

## cMouse: COMPX

The main configurator uses the same protocol as ATK's COMPX, documented in [PROTOCOL.md](PROTOCOL.md). The framing, the checksum and the command numbers all match it.

- Frames are 16 bytes sent as output report 8 with `sendReport(8, frame)`. Replies arrive as input reports on the same device.
- Byte 15 is a checksum: `85 - (sum(bytes 0..14) + 8)` truncated to a byte. The `8` is the report ID, folded in as in the ATK notes.
- A write is confirmed by comparing the first 3 bytes of the reply to the request (5 bytes for command 8), or by a reply with `1` in byte 1. The page tries up to 5 times, waiting up to 200 ms for each reply.
- Frames start with a command byte. The bundle's command names, with their numbers:

| # | Command | # | Command |
|---|---|---|---|
| 1 | EncryptionData (identity) | 22 / 23 | Set / GetLongRangeMode |
| 2 | PCDriverStatus | 24 / 25 | Set / GetPulsarDongleLightParam |
| 3 | DeviceOnLine | 29 | GetDongleVersion |
| 4 | BatteryLevel | 35 / 36 | Set / GetPulsarDongleKeyFunction |
| 5 | DongleEnterPair | 37 / 38 | Set / GetPulsarDongleDPILightParam |
| 6 | GetPairState | 39 / 40 | Set / GetPulsarDongleOButtonCurrentMode |
| 7 | WriteFlashData (EEPROM write) | 41 / 42 | Set / GetPulsarDongleOButtonFunction |
| 8 | ReadFlashData (EEPROM read) | 43 | GetRSSIValue |
| 9 | ClearSetting | 51 | GetKeyCalibrationParam |
| 10 | StatusChanged | 176 / 177 | MusicColorful / MusicSingleColor |
| 11 | SetDeviceVidPid | 240 / 241 | Write / ReadKBCIdMID |
| 12 | SetDeviceDescriptorString | | |
| 13 | EnterUsbUpdateMode | | |
| 14 / 15 | Get / SetCurrentConfig | | |
| 16 | ReadCIDMID | | |
| 17 | EnterMTKMode | | |
| 18 | ReadVersionID | | |
| 20 / 21 | Set / Get4KDongleRGB | | |

Commands 1 to 10, 13 to 16, 18, 20 to 25 and 29 have the same numbers as entries in the ATK COMPX table, though some names differ (command 1 is `DownLoadData` there and `EncryptionData` here, and 24 and 25 are the dongle light mode there). Commands 11, 12, 17, 35 to 43, 51, 176, 177, 240 and 241 are not in the ATK table. I did not decode their payloads.

### Identity

`EncryptionData` replies carry the mouse's `CID` at byte 9, `MID` at byte 10, a connection `type` at byte 11 and the dongle type at byte 12. The `type` values the page distinguishes:

| Type | Meaning |
|---|---|
| 0 | wireless, 1K |
| 1 | wireless, 4K |
| 2 | wired, 1K |
| 3 | wired, 8K |
| 4 | wireless, 2K |
| 5 | wireless, 8K |

### Settings map

Settings live in EEPROM as in ATK's COMPX. The offsets the page uses match the ATK map for every setting I compared:

| Offset | Setting | Offset | Setting |
|---|---|---|---|
| `0x00` | report rate | `0xA9` | debounce time |
| `0x02` | DPI stage count | `0xAB` | motion sync |
| `0x04` | current DPI | `0xAD` | sleep time |
| `0x0A` | lift-off distance | `0xB1` | ripple control |
| `0x0C` | DPI values (4 bytes per stage) | `0xB3` | moving-off light |
| `0x2C` | DPI colors | `0xB5` / `0xB7` | performance state / performance |
| `0x4C` | DPI effect mode | `0xB9` | sensor mode |
| `0x4E` / `0x50` | DPI effect brightness / speed | `0xBD` / `0xBF` | angle tune / angle tune state |
| `0x52` | DPI effect state | `0x100` | shortcut keys |
| `0x60` | key functions | `0x300` | macros |
| `0xA0` | light | `0x1B00` | 3955 DPI table |

The ATK notes label `0xAF` as linear correction where Pulsar's code calls it angle, so the names do not line up everywhere. Pulsar adds settings that ATK's map does not list: power-save battery (`0xD7`) and time (`0xD9`), fan mode (`0xE7`), and left and right trigger, fast-trigger and tactile-feedback values (`0xEF` to `0xF9`). These match the catalog's fan and tactile-button MID lists. As in ATK's map, most bytes are followed by an `85 - value` inverse.

Button functions are `Disable` 0, `MouseKey` 1, `LeftKey` 256, `DPISwitch` 2, `LeftRightRoll` 3, `FireKey` 4, `ShortcutKey` 5, `Macro` 6, `ReportRateSwitch` 7, `LightSwitch` 8, `ProfileSwitch` 9, `DPILock` 10 and `UpDownRoll` 11.

## cMouse catalog

The catalog covers one CID, `87`, with 160 MIDs in 34 groups. It names no models. The `Edition` column is the group's UI theme, and `Firmware image` is the model code in the group's firmware file name. All groups share these dongle MCUs: `CX52650N` for the 1K and 2K dongles and `CH32V305` for the 4K dongle. Sensor labels are the catalog's own (`pulsar x1`, `3950`, `3955`).

| MIDs | Edition | Sensor | Mouse MCU | Max DPI | Firmware image |
|---|---|---|---|---|---|
| 1-6, 9, 10, 12-16, 41-44, 85, 95, 96 | General | Pulsar X1 | NRF52833 | 32000 | `Mouse-DM161-3710-3414` v3.05 |
| 7, 8, 37, 40 | TenZ | Pulsar X1 | NRF52833 | 32000 | `Mouse-DM169-3770-3415` v3.03 |
| 11, 45-66 | VSPO | Pulsar X1 | NRF52833 | 32000 | `Mouse-IM33-3710-7504` v3.04 |
| 17, 18, 116 | General | Pulsar X1 | NRF52833 | 32000 | `Mouse-DM175-3710-3506` v3.03 |
| 19, 20 | General | Pulsar X1 | NRF52833 | 32000 | `Mouse-DM176-3710-3507` v3.04 |
| 21, 22 | General | Pulsar X1 | NRF52833 | 32000 | `Mouse-DM177-3710-3508` v3.04 |
| 23, 24, 117-119 | General | Pulsar X1 | NRF52833 | 32000 | `Mouse-DM178-3710-3509` v3.04 |
| 25, 26 | General | Pulsar X1 | NRF52833 | 32000 | `Mouse-DM179-3770-3510` v3.03 |
| 27, 70, 79-81, 83, 84, 109 | General | Pulsar X1 | NRF52833 | 32000 | `Mouse-DM181-3710-3524` v3.04 |
| 28, 30-33, 35 | General | Pulsar X1 | NRF52833 | 32000 | `Mouse-DM175-3710-3506` v3.03 |
| 29, 76 | General | Pulsar X1 | NRF52833 | 32000 | `Mouse-DM188-3710-3528` v3.04 |
| 34, 71 | General | Pulsar X1 | NRF52833 | 32000 | `Mouse-DM185-3395-3710-3525` v3.05 |
| 36 | General | Pulsar X1 | NRF52833 | 32000 | `8K-Mouse-X2F` v3.03 |
| 38 | DarkTheme | Pulsar X1 | NRF52833 | 32000 | `Mouse-IM31-3710-7501` v3.03 |
| 39 | DarkTheme | Pulsar X1 | NRF52833 | 32000 | `Mouse-IM41-3395-3710-7503` v3.04 |
| 67 | General | Pulsar X1 | NRF52833 | 32000 | `8K-Mouse-X2F-5th` v3.03 |
| 68, 69, 100 | ZywOo | 3950 | NRF52833 | 32000 | `Mouse-zywoo-3710-7506` v3.04 |
| 72, 73, 77, 78, 82, 86-90, 102, 103, 105, 106 | General | Pulsar X1 | NRF52833 | 32000 | - |
| 74, 75, 104 | General | Pulsar X1 | NRF52833 | 32000 | - |
| 91, 127-129 | FS | 3950 | NRF52833 | 32000 | - |
| 92, 94 | DarkTheme | 3950 | NRF52833 | 32000 | - |
| 93 | DarkTheme | 3950 | NRF52833 | 32000 | `Mouse-Merge-554` v4.01 |
| 97, 98 | General | Pulsar X1 | NRF52833 | 32000 | - |
| 99 | DarkTheme | 3950 | NRF52833 | 32000 | - |
| 101 | Feinmann | 3955 | NRF52833 | 42000 | `Mouse-fs01` v5.09 |
| 107, 110 | TenZ | 3955 | NRF52833 | 42000 | - |
| 108, 113, 115, 121, 126, 137-140, 142-160 | General | 3955 | 54 | 42000 | - |
| 111 | General | 3955 | NRF52833 | 42000 | - |
| 112, 120, 124, 125 | DarkTheme | 3955 | NRF52833 | 42000 | `Mouse-Susanto-X-IR` v5.08 |
| 114 | DarkTheme | 3955 | NRF52833 | 42000 | - |
| 122, 123 | TenZ | 3955 | NRF52833 | 42000 | - |
| 130-132 | General | Pulsar X1 | NRF52833 | 32000 | `Mouse-DM161-3710-3414` v3.05 |
| 133-136 | ZywOo | 3955 | NRF52833 | 42000 | - |
| 141 | General | 3955 | NRF52833 | 42000 | - |

The mouse MCU is `NRF52833` for every group except the one whose catalog value is `54` (28 MIDs, all with the 3955 sensor). I do not know which part `54` refers to.

The catalog also lists these dongle firmware files:

| Version | File |
|---|---|
| v2.25 | `8K-Dongle-3710-5406-V2.25-213DD3B7.bin` |
| - | `Dongle-CD01-V2.08-61cd8c18.bin` |
| - | `Dongle-CD03-V4.07-8b781788.bin` |
| v4.00 | `8K-Dongle-3710-5406-V2.24-DC7B13B0.bin` |
| v5.08 | `Dongle-f01-v5.08-99F48260.bin` |
| v5.03 | `Dongle-XS-2-V5.03-871CC117.bin` |

The firmware engine is built into the page. It uses report commands `Cmd_PrepareDownLoad` 176, `Cmd_DownLoadFile` 177, `Cmd_DeviceState` 91 and `Cmd_DeviceError` 90, with packet markers 192 and 193 for next and last packet. Device states are erase backup 1, erase main 2, check OK 5, prepare 16, device to boot mode 17 and success 136. Each image carries a header with its own bootloader and normal-mode endpoint strings (`vid_..&pid_..`), the command to enter update mode, and a checksum `0x55555555 - sum(bytes 8..headLength)`. The page requests images relative to its own URL. When I tried a few of those paths directly, the server returned its 404 page, so I could not confirm that the files can be downloaded.

## vMouse

`vMouse` is the web driver for the **Pulsar eS Xlite** ("Ver 1.2.2"). Its built-in record gives mouse PID `9604` and dongle PID `5602`, in black and white. The hub also routes `9605` to it, and I could not tell what that one is. The app's own filter list covers vendor `3710` (PIDs `9502`, `9604`, `9600`, `9605`, `9501`, `9503`) and vendor `3057`. It also tries to load device records from `/vMouse/api/device.php`, which does not exist on this server, so it falls back to the built-in record. The bundle names no sensor or MCU.

The protocol is not COMPX:

- Packets are 63 bytes sent as feature report 14: `[0] = 0xA5`, `[1]` command, `[2]` type (`1` read, `2` write), `[3]` payload length, payload from `[4]` (up to 59 bytes). If the device rejects the feature report, the page tries `sendReport(14, ...)`.
- Replies come from `receiveFeatureReport(14)`, possibly with a leading `14`. A valid reply starts with `0xA5` and echoes the command in `[1]`. A command byte of `0xFF` means not ready, and the page keeps polling.
- Writes wait 80 ms afterwards (400 ms for commands 20 and 21, 1500 ms for 23).

| Command | Meaning | Payload and reply |
|---|---|---|
| `0x01` | firmware version | reply `[4]` low, `[5]` high |
| `0x02` | DPI stage count and active stage | `[4]` count (1 to 6), `[5]` active |
| `0x03` | DPI LED | read index, reply `[5..7]` is RGB |
| `0x04` | DPI value | index, flag, X as 16 bits little-endian, Y as 16 bits little-endian. 50 to 42000. |
| `0x05` | debounce | `[4]`, `[5]` rapid-trigger flags, `[6]`, `[7]` their values, `[8..10]` legacy debounce |
| `0x06` | DPI X/Y binding | `[4]` 1 means bound |
| `0x07` | polling rate | code 0 to 5 for 125, 500, 1000, 2000, 4000, 8000 Hz |
| `0x08` | sensor setting | `[4]` 1 gaming or 0 standard, `[5]` motion sync |
| `0x09` | lift-off distance | codes 1, 2, 4, 7, 11 for 0.7, 0.8, 1.0, 1.2, 1.4 mm |
| `0x0A` | mouse PID | `[4]` low, `[5]` high |
| `0x0B` | battery | `[4] * 5` percent, `255` means not ready |
| `0x0C` | macro setting | button, value |
| `0x0D` | dongle firmware version | |
| `0x0F` / `0x10` | wireless connected / charging | `[4] == 1` |
| `0x14` | current profile | `[4]` |
| `0x15` | profile enabled flags | `[4..7]` |
| `0x17` | factory reset | |
| `0x18` | angle tune | `[4]` enabled, `[5]` signed angle |
| `0x19` | color ID | |
| `0x1A` | start dongle pairing | |
| `0x1B` | dongle left button | |
| `0x1C` | angle snap | |
| `0x1D` | status change flags | profile, DPI, turbo, rate, battery (`[4..8]`) |
| `0x1E` | dongle LED | |
| `0x1F` | mouse LED | enabled, brightness 1 to 10 |

## zywoo, nKey and sKey

- **`zywoo`** (PIDs `5405`, `7401`) is a VIA-style app. It filters on usage page `0xFF60` and usage `0x61`, which is QMK's raw HID interface, and writes with `sendReport(0, ...)`. Its code mentions mouse settings (DPI, polling, lift-off, macros) and a keymap. I did not decode its commands, and the bundle names no sensor or MCU.
- **`nKey`** (PIDs `2402`, `2403`, `2407`, `2408`) is a Flutter build that uses WebHID. It filters on vendor `3710`, usage page `0xFF60` and usage `0x61`, and also opens a second interface on usage page `0xFF1C`, usage `0x1C`. It ships keymap presets as `assets/keymapPresets/pulsar_keymap_preset_<vid>_<pid>_...json` and checks firmware with `v_manager/firmwareUpgrade/checkVersion` on `bbb.pulsar.gg`. I did not decode its commands.
- **`sKey`** (hub PIDs `2404`, `2502`, `2503`, `2504`, `2506`, `2507`, `8601`, `F003`) is a Flutter build with no WebHID code. It links to `sKey/BibimbapInstaller.exe` and has WebSocket and platform-channel code, so it appears to depend on a local helper program. Its protocol is not in the web bundle.

## Caveats

- I did not decode the payloads of the Pulsar-specific COMPX commands, the vMouse debounce and macro bytes, or anything in `zywoo`, `nKey` or `sKey`.
- The catalog holds no model names. The device's USB product name is shown at run time but is not in the shipped files.
- The per-MID pictures live at `cMouse/img/devices/mouse/<cid hex><MID hex>.png` (154 of the 160 exist). I did not copy any into the repo.
