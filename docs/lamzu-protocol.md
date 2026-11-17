# Lamzu Aurora protocol research

These notes describe the publicly served [Lamzu Aurora web configurator](https://www.lamzu.net/#/project/item) as inspected on 2026-11-17 (app `LAMZU Aurora` `1.0.38`). Everything here comes from the shipped bundle and its JSON config. **Nothing has been tested on a device**, and the bundle is evidence, not a specification. The bundle and catalog can change after that date.

Sources: the [model catalog](https://www.lamzu.net/Config/env-models.json) and the entry bundle `static/js/index-DxSz_fAU.js` (HID transport and both protocol classes). Smaller chunks add the connect screen (`index-DE4vNd8L.js`), device selection and settings (`index-Bn9q780G.js`) and the firmware updater (`index-BaiREhGx.js`). The updater and the connect screen read the same catalog.

## Platform

The configurator closely resembles the [WLmouse](wlmouse-protocol.md) hub: a Vue app that reads its device list from `Config/env-models.json` and carries its transport code in the entry bundle. Its 64-byte framing matches the WLmouse and [RAWM](rawm-protocol.md) notes. The catalog has 26 model entries across three vendor IDs:

| Vendor ID | Notes |
|---|---|
| `373E` | Same vendor ID as the RAWM Leviathan V4 GT. Used by Maya X (all of its PIDs) and by the MayaX V2 8K receiver. |
| `37B0` | The main Lamzu ID. Every other model. |
| `3554` | Atlantis only. This is also an ATK/VXE vendor ID. |

The connect screen's initial device picker filters on `373E` and `37B0` only. Atlantis (`3554`) is requested by PID in the pairing flow (`F50D` and `F510`), and the add-device picker builds its filters from every catalog model.

## Protocol classes

The bundle has two HID helper classes and picks one by vendor ID alone: vendor `0x3554` (13652) gets the COMPX class, every other vendor gets the 64-byte class. The catalog's `IsCompx` flag is `1` for Atlantis and also for `Atlantis Mini(54H20)` (`37B0:003E`). The code that chooses the class does not read it, so for the `37B0` model the flag appears to control UI behavior only. I did not trace which.

### 64-byte class (`373E` and `37B0`, 25 models)

- Commands use a 64-byte feature report with report ID 0: `sendFeatureReport(0, buf)` to send and `receiveFeatureReport(0)` to read the reply.
- The command interface is the one whose feature report has `reportCount == 64`. A second interface with an input report ID 4 is used for device events.
- Request bytes: `[2]` target device, `[3]` length, `[4]` category, `[5]` opcode, payload from `[6]`. This is the framing documented for [WLmouse](wlmouse-protocol.md) and [RAWM](rawm-protocol.md).
- Replies sometimes carry an extra leading report-ID zero. The bundle handles it by testing two offsets: firmware version is read from `[7..10]` when `[6] == 0x81`, otherwise from `[6..9]` when `[5] == 0x81`.
- Observed commands:
  - Firmware version: target `n`, length `16`, opcode `0x81`.
  - Battery: target `2`, length `2`, opcode `0x83`. The reply is recognised by status `0xA1`, and the two values come back at `[7]` and `[8]`.
  - Enter bootloader (`enterBL`, used by the updater): target `n`, length `1`, with `0xB0` in byte `[6]`.
  - Bootloader version (`getBLFWVer`): target `n`, length `6`, category `0xB0`, opcode `0x80`.
  - `exitNormal`: target `n`, length `1`, category `0xB0`, opcode `4`, payload `1`. I did not see where it is called, so its purpose is inferred from its name.
- Both the mouse and its receiver are addressed through the same interface using the target byte. The updater asks for target `0` and `1` and compares the two versions.
- Catalog flag `IsNewProtocol` is `1` for all 26 models. The bundle copies it onto the helper as `isNewProtocol`.

### COMPX class (`3554`, Atlantis)

- Frames are 16 bytes, sent as output report 8: `sendReport(8, frame)`. Replies are read from the same device's input-report handler. The bundle recognises this interface for arrival and removal events by `collections.length > 5` and collection 4's first input report having ID 8.
- Byte 15 is a checksum: `85 - (sum(bytes 0..14) + 8)` truncated to a byte. The literal `8` is the report ID, folded in the same way the [ATK COMPX documentation](PROTOCOL.md) describes (`85 − sum`, 16-byte frames).
- Byte 0 is the command. Commands the bundle issues, with frame layout where it is visible:
  - `1`: dongle query (the bundle's `getDonglePR` and a sibling). `[4] = 8`, random bytes in `[5..8]`. The result is read from `[10]` or `[11]`.
  - `4`: battery (`getBatPer`). Reply `[5]` and `[6]`.
  - `5`: enter pairing mode. `[4] = 2`, `[7] = 11`.
  - `6`: read the pairing result from reply `[5]`.
  - `7`: write EEPROM. `[2..3]` address, `[4]` length, `[5]` value, `[6]` is `85 - value`.
  - `8`: read EEPROM. `[2..3]` address, `[4]` length (the bundle reads 10 at a time over a 256-byte map). Data is in the reply from `[5]`.
  - `14`: read profile (reply `[5]`, plus 1). Opcodes for set-current-profile and clear-settings are named constants whose values I did not resolve.
  - `18` and `29`: firmware version, reply `[5].[6]` in hex.
- Stored settings follow the same pattern as ATK COMPX: a value followed by its `85 − value` inverse.
- The dongle's own firmware version is not read; the helper returns `ff.ff.ff.ff`.

## Device catalog

PIDs are hexadecimal. A dash means the catalog lists none. "Wireless / 1K" is the catalog's wireless PID, which is the 1K receiver on the models that have one, and "4K / 8K" is the 4K and 8K receiver. "Protocol" is the class the bundle would select by vendor ID. Wired max Hz is the highest wired polling rate in the catalog, and every model lists 1,000 to 8,000 Hz on the wireless receiver. All models list LOD `0.7`, `1`, `2` mm and up to five DPI stages.

| Model | UI folder | Wired | Wireless / 1K | 4K / 8K | DPI max | Wired max Hz | 20K FPS | Bootloader | Protocol | `IsCompx` |
|---|---|---|---|---|---|---|---|---|---|---|
| Maya X | MayaX | 373E:001C | 373E:001D | 373E:001E | 30000 | 1000 | no | 373E:B01C | 64-byte | 0 |
| TACHI | TACHI | 37B0:0005 | 37B0:000B | 37B0:000C | 30000 | 1000 | no | 37B0:0006 | 64-byte | 0 |
| INCA | INCA | 37B0:0009 | 37B0:000F | 37B0:0010 | 30000 | 1000 | no | 37B0:000A | 64-byte | 0 |
| Maya | Maya | 37B0:0011 | 37B0:0013 | 37B0:0015 | 30000 | 1000 | no | 37B0:0012 | 64-byte | 0 |
| PARO | PARO | 37B0:0007 | 37B0:000D | 37B0:000E | 30000 | 1000 | no | 37B0:0008 | 64-byte | 0 |
| THORN | THORN | 37B0:0017 | 37B0:0019 | 37B0:001B | 30000 | 1000 | no | 37B0:0018 | 64-byte | 0 |
| THORN V2 | THORN | 37B0:0021 | 37B0:0003 | 37B0:0023 | 30000 | 1000 | no | - | 64-byte | 0 |
| Tachi Lite | TACHI_LITE | 37B0:001C | - | 37B0:001E | 30000 | 1000 | no | - | 64-byte | 0 |
| MayaX V2 | MayaXV2 | 37B0:001F | 37B0:00ff | 373E:0016 | 30000 | 1000 | no | - | 64-byte | 0 |
| Atlantis | Atlantis | 3554:F50F | 3554:F50D | 3554:F510 | 30000 | 1000 | no | - | COMPX | 1 |
| Atlantis OG Champion | AtlantisOG | 37B0:0025 | - | 37B0:0027 | 30000 | 1000 | yes | - | 64-byte | 0 |
| Atlantis Mini | AtlantisMini | 37B0:0028 | 37B0:002B | 37B0:002A | 30000 | 1000 | yes | - | 64-byte | 0 |
| MAYA M(54H20) | MayaM | 37B0:002C | - | 37B0:002E | 30000 | 8000 | yes | - | 64-byte | 0 |
| THORN V2(54H20) | THORNV2 | 37B0:0030 | - | 37B0:0032 | 50000 | 8000 | yes | - | 64-byte | 0 |
| THORN V2(54H20) | THORNV2_3955 | 37B0:0040 | - | 37B0:002E | 50000 | 8000 | yes | 37B0:0041 | 64-byte | 0 |
| DM198(54H20) | DM198 | 37B0:0034 | - | 37B0:0036 | 30000 | 8000 | yes | - | 64-byte | 0 |
| DM198_OP(54H20) | DM198_OP | 37B0:0038 | - | 37B0:0036 | 30000 | 8000 | yes | - | 64-byte | 0 |
| MAYA X(54H20) | MayaX | 37B0:003A | - | 37B0:003B | 30000 | 8000 | yes | - | 64-byte | 0 |
| MAYA (54H20) | Maya | 37B0:003C | - | 37B0:0036 | 30000 | 8000 | yes | - | 64-byte | 0 |
| Atlantis Mini(54H20) | Atlantis | 37B0:003E | - | 37B0:003F | 30000 | 8000 | yes | - | 64-byte | 1 |
| ORCUS | ORCUS | 37B0:0042 | - | 37B0:0036 | 50000 | 8000 | yes | - | 64-byte | 0 |
| Maya X(LM20) | MayaX(LM20) | 37B0:0044 | - | 37B0:0048 | 50000 | 8000 | yes | 37B0:0044 | 64-byte | 0 |
| MAYA M(LM20) | MayaM(LM20) | 37B0:0052 | - | 37B0:0048 | 50000 | 8000 | yes | 37B0:0052 | 64-byte | 0 |
| Maya(LM20) | Maya(LM20) | 37B0:0050 | 37B0:0048 | 37B0:0048 | 50000 | 8000 | yes | 37B0:0050 | 64-byte | 0 |
| Mini(LM20) | Lamzu_mini(LM20) | 37B0:0046 | - | 37B0:0054 | 50000 | 8000 | yes | 37B0:0046 | 64-byte | 0 |
| Orcus V2(LM20) | ORCUSV2(LM20) | 37B0:0056 | - | 37B0:0048 | 50000 | 8000 | yes | 37B0:0056 | 64-byte | 0 |

The 12 models whose wired max is 1,000 Hz list `125;250;500;1000` wired. Features that vary: separate X/Y DPI is off for the two `IsCompx` models (Atlantis and `Atlantis Mini(54H20)`), 20K FPS is on for 16 models, scroll-wheel hop (`bhopWheelEnable`) is on for 10, and sensor offset, dynamic sensitivity and glass mode are on for the same four LM20 models (Maya X, MAYA M, Maya and Mini).

### Receiver variants

`THORNV2_3955` (`THORN V2(54H20)`, `37B0:0040`) is the only model with two 8K receivers: `37B0:002E` and `37B0:0032`, with bootloader PIDs `0033` and `002F`. Every other model lists a single 8K receiver. Most also carry an `_8KDongleExtra` list (`0001`, `000C`, `0010`, `000E`, `001B`, `0015`), which the updater adds to its device filter under vendor `37B0`. Most models list `_8KDongleIDVD` as `0001` (Tachi Lite lists `0013`). I did not work out what that field selects.

### Firmware images

The updater serves Intel HEX images from `Config/fwfiles/<FWFolder>/`. A dash in `FWFolder` means the catalog has no firmware image for that model. Bootloader mode re-enumerates under the bootloader PID in the first table.

| Model | `FWFolder` | Device image | 4K/8K receiver images | Receiver bootloader |
|---|---|---|---|---|
| Maya X | MayaX | `DM141_Mouse_840_APP_v0.0.0.19_20260512.hex` | `DM141_8K_Dongle_305_APP_v0.0.0.19_20260512.hex / DM141_8K_Dongle_820_APP_v0.0.0.19_20260512.hex` | 373E:B01E |
| TACHI | TACHI | `TACHI_3950_Mouse_840_APP_v0.0.0.15_20250401.hex` | `LAMZU_Aurora_8K_Dongle_305_APP_v0.0.0.15_20250331.hex / LAMZU_Aurora_8K_Dongle_820_APP_v0.0.0.15_20250331.hex` | 37B0:0002 |
| INCA | INCA | `INCA_Mouse_840_APP_v0.0.0.15_20250401.hex` | `LAMZU_Aurora_8K_Dongle_305_APP_v0.0.0.15_20250331.hex / LAMZU_Aurora_8K_Dongle_820_APP_v0.0.0.15_20250331.hex` | 37B0:0002 |
| Maya | Maya | `DM120_Mouse_840_APP_v0.0.0.15_20250401.hex` | `LAMZU_Aurora_8K_Dongle_305_APP_v0.0.0.15_20250331.hex / LAMZU_Aurora_8K_Dongle_820_APP_v0.0.0.15_20250331.hex` | 37B0:0002 |
| PARO | PARO | `LAMZU_PARO_Mouse_840_APP_v0.0.0.15_20250401.hex` | `LAMZU_Aurora_8K_Dongle_305_APP_v0.0.0.15_20250331.hex / LAMZU_Aurora_8K_Dongle_820_APP_v0.0.0.15_20250331.hex` | 37B0:0002 |
| THORN | THORN | `THRON_Mouse_840_APP_v0.0.0.15_20250401.hex` | `LAMZU_Aurora_8K_Dongle_305_APP_v0.0.0.15_20250331.hex / LAMZU_Aurora_8K_Dongle_820_APP_v0.0.0.15_20250331.hex` | 37B0:0002 |
| THORN V2 | - | - | - | - |
| Tachi Lite | - | - | - | - |
| MayaX V2 | - | - | - | - |
| Atlantis | - | - | - | - |
| Atlantis OG Champion | - | - | - | - |
| Atlantis Mini | - | - | - | - |
| MAYA M(54H20) | - | - | - | - |
| THORN V2(54H20) | - | - | - | - |
| THORN V2(54H20) | THORNV2_3955 | `LAMZU_Thorn_V2_8K_Mouse_radcode_54H20_v00.00.01.16_20260731.hex` | `LAMZU_Thorn_Dongle_capuapp_code_V2_v0.0.1.16_20260730.hex / LAMZU_Thorn_Dongle_capurad_code_V2_v0.0.1.16_20260730.hex` | 37B0:0033 |
| DM198(54H20) | - | - | - | - |
| DM198_OP(54H20) | - | - | - | - |
| MAYA X(54H20) | - | - | - | - |
| MAYA (54H20) | - | - | - | - |
| Atlantis Mini(54H20) | - | - | - | - |
| ORCUS | - | - | - | - |
| Maya X(LM20) | MayaX(LM20) | `LAMZU_DM141_Maya_X_V2_8K_Mouse_54LM20_App_v0.0.3.0_20261009.hex` | `LAMZU_DM141_Maya_X_V2_8K_Dongle_54LM20_App_v0.0.3.0_20261009.hex` | 37B0:0048 |
| MAYA M(LM20) | MayaM(LM20) | `LAMZU_W37_Maya_M_8K_Mouse_54LM20_App_v0.0.3.0_20261009.hex` | `LAMZU_DM141_Maya_X_V2_8K_Dongle_54LM20_App_v0.0.3.0_20261009.hex` | 37B0:0048 |
| Maya(LM20) | Maya(LM20) | `LAMZU_DM120_Maya_V2_8K_Mouse_54LM20_App_v0.0.3.0_20261009.hex` | `LAMZU_DM141_Maya_X_V2_8K_Dongle_54LM20_App_v0.0.3.0_20261009.hex` | 37B0:0048 |
| Mini(LM20) | Lamzu_mini(LM20) | `LAMZU_DM114_Atlantis_Mini_V2_8K_Mouse_54LM20_App_v0.0.3.0_20261009.hex` | `LAMZU_Crystal_V2_8K_Dongle_54LM20_App_v0.0.3.0_20261009.hex` | 37B0:0054 |
| Orcus V2(LM20) | ORCUSV2(LM20) | `LAMZU_Orcus_V2_Mouse_54LM20_App_v0.0.2.0_20260921.hex` | `LAMZU_DM141_Maya_X_V2_8K_Dongle_54LM20_App_v0.0.2.0_20260920.hex` | 37B0:0048 |

## Caveats

- Models with a `(54H20)` or `(LM20)` suffix look like chip variants. The updater branches on `FWFolder` containing `LM20`: it requests the device with a filter, waits 500 ms, then re-opens it by VID and PID. That suggests the LM20 models use a different flashing flow, but I did not read the flashing code.
- I did not decode the full opcode tables for either class, the macro or button-binding formats, or the lighting effects. `LightEffects` lists effect IDs per model in the catalog.
- The mouse list and PIDs are as shipped on 2026-11-17 and may not include models still in development.
