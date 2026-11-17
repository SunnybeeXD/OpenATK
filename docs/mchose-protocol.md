# MCHOSE M HUB protocol research

These notes describe the publicly served [MCHOSE M HUB](https://www.mchose.com.cn/#/) driver page as inspected on 2026-11-17. Everything here comes from the shipped JavaScript and the JSON configs it loads. **Nothing has been tested on a device**, and the bundle is evidence, not a specification. This is a large, frequently changing app, so details can drift after that date.

Sources:

- `www.mchose.com.cn/assets/main-*.js` (about 7.6 MB, with a few smaller chunks) for the HID code, mouse filters and model tables.
- Three remote configs on the CDN, each a zipped JSON file wrapped in base64 under `__compressBase64__`: `configCenter/custom/cardList.json`, `custom/mouseConfig.json` and `custom/newMouseConfig.json`.

## Platform

The page is a Vue app. It loads its device lists from `cdn.mchose.com.cn/configCenter` and filters for devices with hard-coded WebHID filters. The product keys it uses internally have the form `<name>$$$<vendor ID>$$$<product ID>`, with decimal IDs. The main MCHOSE vendor ID is `0x3837`, since products named "MCHOSE ..." use it. MCHOSE also sells headsets (K20, G9, V9, X9, MagDock) and keyboards through the same page, so the code mixes all three.

## Mouse device filters

The mouse picker uses these filters (hexadecimal; the bracketed values are usage pages):

| Vendor ID | Products |
|---|---|
| `5253` | any PID (`FF01/FF0B`) |
| `3837` | `4010` (`FF01/FF0B`), `4018` (`FF01/FF0B`), `4023` (`FF01/FF0B`), `1012` (`FF00`), `4019` (`FF01/FF0B`), `4021` (`FF01/FF0B`), `4011` (`FF01/FF0B`), `100A` (`FF01/FF0B`), `1009` (`FF01/FF0B`), `4110` (`FF01/FF0B`), `4015` (`FF01/FF0B`), `4016` (`FF01/FF0B`), `401B` (`FF01/FF0B`), `1001` (`FF01/FF0B`), `4150` (`FF01/FF0B`), `4022` (`FF01/FF0B`), `100B` (`FF01/FF0B`), `100C` (`FF01/FF0B`), `418C` (`FF01`), `4245` (`FF01`), `4042` (`FF01`), `4012` (`FF01`), `1008` (`FF01`), `4013` (`FF01`), `201A` (`FF02`), `201B` (`FF02`), `3016` (`FF00`) |
| `0BDA` | `4762` (`FF01/FF0B`) |
| `41E4` | `1102` (`FF01/FF0B`), `1101` (`FF01/FF0B`), `1204` (`FF00`), `1001` (`FF00`), `1003` (`FF00`), `2201` (`FF00`), `2001` (`FF04`), `2203` (`FF00`), `2004` (`FF00`) |
| `A8A4` | `2255` (`FF01`) |
| `A8A5` | `2255` (`FF01`) |
| `05AC` | `024F` (`FF00/FF04`) |
| `258A` | `010C` (`FF00`), `01B9` (`FF00`), `01BB` (`FF00`) |
| `3554` | `FA09` (`FF04`) |

Usage pages `FF01` and `FF0B` are the common mouse interfaces. A few devices use `FF00`, `FF02` or `FF04`. Vendor `5253` is accepted for any PID. Vendors `41E4` and `5253` also appear in MCHOSE product keys (for example `41E4:3502` for the G9 PRO and `5253:1020` for several A7 and K7 models), which suggests shared OEM hardware. The others (`0BDA`, `A8A4`, `A8A5`, `05AC`, `258A`, `3554`) do not appear in any product key I found, so I do not know whether they are MCHOSE products.

## Mice

### Newer generation

The page has a model table for 19 newer mice (`newMouse*` lists). Wired PIDs are on `3837`. The dongle PIDs are the wireless receivers the model works with (`1014`, `1016`, `1018`, `101C`, `101D` are the page's list of new wireless PIDs). The sensor column comes from the page's own `newMouse3955` and `newMouse3395` lists. The MCU column is `Nordic` if the model is in its Nordic upgrade list (`allowUpdateDevice` and `isNordicMouseDevice`) and `WCH` if it is in `newMouseWCH`, which uses a WCH chip (the dongle images are labelled `564C`). Max polling is the largest rate set in the model's entry.

| Model | Wired PID | Dongle PIDs | Max DPI | Sensor | MCU | Max polling |
|---|---|---|---|---|---|---|
| K7 V2 Pro | 403B | 1014, 1018 | 26000 | 3395 | Nordic | 8K |
| K7 V2 Pro+ | 4027 | 1014, 1018 | 42000 | not listed | Nordic | 8K |
| K7 V2 Ultra | 403C | 1014, 1018 | 50000 | 3955 | Nordic | 8K |
| K7 V2 Ultra+ | 4028 | 1014, 1018 | 50000 | 3955 | Nordic | 8K |
| A7 V3 | 4030 | 1014, 1018 | 26000 | 3395 | Nordic | 8K |
| A7 V3 Pro | 4031 | 1014, 1018 | 42000 | not listed | Nordic | 8K |
| A7 V3 Pro+ | 4032 | 1014, 1018 | 42000 | not listed | Nordic | 8K |
| A7 V3 Ultra | 403D | 1014, 1018 | 50000 | 3955 | Nordic | 8K |
| A7 V3 Ultra+ | 4033 | 1014, 1018 | 50000 | 3955 | Nordic | 8K |
| A7 V3-X | 403A | 1014, 1018 | 50000 | 3955 | Nordic | 8K |
| A7 Magnetic | 403F | 1014, 1018 | 50000 | 3955 | Nordic | 8K |
| K5 V2 | 4040 | 101C | 42000 | 3395 | Nordic | 8K |
| K5 Pro | 4037 | 1014, 1018 | 26000 | 3395 | Nordic | 8K |
| K5 Ultra | 4038 | 1014, 1018 | 50000 | 3955 | Nordic | 8K |
| R7 Ultra | 4036 | 1014, 1018 | 50000 | 3955 | Nordic | 8K |
| V7 | 402A | 1016 | 26000 | 3395 | WCH | 1K |
| V7 Pro | 403E | 101D | 42000 | not listed | WCH | 1K |
| G3 V3 | 4029 | 101D | 12000 | 3395 | WCH | 1K |
| G3 S | 4041 | 101D | 18000 | 3395 | WCH | 1K |

"3955" and "3395" are the page's labels. I am assuming they mean the PixArt PAW3955 and PAW3395. Four models have no sensor in either list, and I left them blank. The A5 V3 family (Pro, Ultra, Ultra+, Ultra+ 3955) is also in these lists and in the firmware config, but its model-table row was not among the 19 I parsed. Product keys give `4026` for the A5 V3 Ultra+ and `4034` for the A5 V3 Ultra+ (3955).

Polling rates are `125, 500, 1000` for the 1K models and `125, 500, 1000, 2000, 4000, 8000` for the 8K ones. The page's DPI presets are 200 to 4200 plus the model maximum (12000, 18000, 26000, 42000 or 50000).

Firmware for these models is a pair of images for the mouse (`Mouse_Main` and `Mouse_Sub`) and a pair for the dongle (`Dongle_Main` and `Dongle_Sub`), served from `configCenter/static/binaries/`. A second dongle set (`Dongle_*_Low`) exists for some models. Versions in `newMouseConfig.json`:

| Model | Mouse version | Dongle version | Low dongle version |
|---|---|---|---|
| A5 V3 Pro | 4 | 6 | 6 |
| A5 V3 Ultra+ | 36 | 6 | 6 |
| A5 V3 Ultra+(3955) | 12 | 6 | 6 |
| K7 V2 Pro+ | 16 | 6 | 6 |
| K7 V2 Ultra+ | 15 | 6 | 6 |
| A7 V3 | 9 | 6 | 6 |
| A7 V3 Pro | 17 | 6 | 11 |
| A7 V3 Pro+ | 13 | 6 | 11 |
| A7 V3 Ultra | 2 | - | 11 |
| A7 V3 Ultra+ | 30 | 6 | 11 |
| A7 V3-X | 3 | - | 11 |
| K5 Pro | 16 | - | 11 |
| K5 Ultra | 15 | - | 11 |
| V7 | 38 | 38 | - |
| V7 Pro | 13 | 11 | - |
| G3 V3 | 22 | 10 | - |

### Older generation

`mouseConfig.json` lists the older models and their firmware images. The key is a model name, or for some dongles a decimal PID.

| Model | Firmware image |
|---|---|
| M7 | `M7_v5.10.7.0` |
| M7 Pro | `M7Pro_v5.8.7.0` |
| M7 Ultra | `M7Ultra_v5.2.7.0` |
| L7 | `L7_v5.16.5.0` |
| L7 Pro | `L7Pro_v5.12.5.0` |
| L7 Pro+ | `L7Pro+_v5.32.5.0` |
| L7 Ultra | `L7Ultra_v5.14.5.0` |
| L7 Ultra+ | `L7Ultra+_v5.34.5.0` |
| A7 | `A7_v5.6.7.4` |
| A7 Pro | `A7Pro_v5.4.7.4` |
| A7 Ultra | `A7Ultra_v5.0.7.4` |
| A7 Ultra(RE) | `A7Ultra(RE)_v5.26.5.0` |
| A7 V2 Pro | `A7V2Pro_v5.42.2.4` |
| A7 V2 Pro+ | `A7V2Pro+_v5.48.2.4` |
| A7 V2 Ultra | `A7V2Ultra_v5.44.2.4` |
| A7 V2 Ultra+ | `A7V2Ultra+_v5.46.2.4` |
| A7X Ultra | `A7XUltra_v5.30.3.0` |
| AX5 V2 old | `AX5V2OLD_v4.4.4.3` |
| AX5 V2 new | `AX5V2NEW_v4.8.4.3` |
| K7 Ultra | `K7Ultra_v5.28.5.0` |
| A5 V3 | `A5V3_v2.8.2.0` |
| A5 V2 Ultra | `A5V2Ultra_v2.6.6.0` |
| A5 ultra | `A5Ultra_v2.0.11.0` |
| G3 Ultra 8K | `G3Ultra8K_v6.0.4.2` |
| G3 Ultra 4K | `G3Ultra4K_v6.2.5.2` |

| Dongle PID | Firmware image |
|---|---|
| `1001` | `K7Ultra_v5.1.4.0` |
| `1009` | `A7XUltra_v5.3.2.0` |
| `100A` | `1k_v2_dongle_v5.15.2.0` |
| `100B` | `8k_v2_dongle_v5.17.2.0` |
| `100C` | `4k_v2_dongle_v5.9.2.0` |
| `1020` | `8k_v1_dongle_v5.7.6.0` |
| `1021` | `1k_v1_dongle_v5.5.6.0` |
| `1102` | `4k_v2_dongle_v5.9.2.0` |
| `4762` | `4k_v2_dongle_v5.9.2.0` |

The PIDs in the table above are the only ones I found tied to names or images for the older mice. The rest of the `3837` PIDs in the filter list have no names in anything I found. The older models show no sensor or MCU in the code.

## Mouse protocols

### Older generation: inverted feature reports

- Commands are feature reports with report ID `0x11` or `0x12`. The page sends `sendFeatureReport(id, bytes)` and reads the answer with `receiveFeatureReport(id)`.
- Every byte after the report ID, in both directions, is XORed with `0xFF`. A reply is accepted when its second byte, inverted, equals the command byte. The page retries up to 6 times, with a 600 ms timeout for the whole wait.
- Commands, written as `<report ID> <command>`:

| Command | Meaning |
|---|---|
| `0x11 0x03` | receiver status |
| `0x11 0x04` | mouse version (two request forms: with and without an `AA` marker) |
| `0x11 0x06` | device information |
| `0x11 0x1B` | lighting |
| `0x12 0x63` | button name |
| `0x12 0x65` | macro |
| `0x12 0x67` | all settings |
| `0x12 0x68 0x00`, `0x01`, `0x02` | onboard profile 1, 2 and 3 |
| `0x12 0x77` | long macro |

I only traced the read side. A device whose product name is `G3 Mouse` is skipped by this path.

### Newer generation: 16-bit command IDs

- Commands are 64-byte output reports: `sendReport(0x4D, ...)`, so the report ID is `0x4D`.
- Layout after the report ID: `[1]` is `1`, `[2]` flags (`1` means a checksum follows), `[3]` payload length, `[4]` and `[5]` the command ID little-endian, `[6]` a business code and `[7]` a sequence number. Payload starts at byte 8. When the flag is `1`, a checksum byte follows the payload: the XOR of bytes 2 through the last payload byte.
- Replies arrive as input reports. The command ID is read from the data bytes 3 and 4 (low byte first), and the payload starts at data byte 7. The page waits up to 3 seconds and serialises commands.
- Read IDs and their write counterparts (write ID is the read ID plus `0x0100` where both exist):

| Read | Write | Meaning |
|---|---|---|
| `0x0001` | `0x0101` | mouse keys: six slots (left, right, middle, forward, back, DPI), each a type byte and 2 to 7 value bytes (`0xFF` means empty) |
| `0x0002` | `0x0102` | all settings |
| `0x0003` | `0x0103` | DPI table |
| | `0x0104` | single DPI |
| | `0x0105` | reset to defaults |
| `0x0009` | `0x0109` | lift-off distance |
| `0x000A` | `0x010A` | adaptive power |
| | `0x010B` | adaptive power heartbeat |
| `0x0900` | | device information |
| `0x0901` | | firmware version |
| | `0x0906` | format data |
| | `0x0910` | board name |

Device information (`0x0900`) is little-endian pairs: vendor ID (bytes 0 and 1), product ID (2 and 3), maximum profile count (4), macro save type (5), shared macro data size (6 and 7), macro unit size (8 and 9), connection status (10), charge status (11), battery level (12) and game mode (13). Further IDs (`0x0905`, `0x090B`, `0x090C`, `0x09F0`, `0x09F2`, `0x09F5`) are recognised but handled as no-ops in the code I read.

## Keyboards

The card list holds 30 magnetic-switch ("cizhou") keyboards. Each entry lists two or four identities. The normal interface is usage page `0x0001` and the configuration interface is usage page `0xFF00`, usage `1`. Eight identities use usage page `0xFF80`, usage `1` instead. Vendor `19F5` appears only on the Ace 60 and Ace 60 Pro, as alternate identities beside `41E4`. The keyboard protocol comes from a separate SDK (`CZ_SHARED_DATA/loader.js`), which I did not analyse.

| Model | Vendor:product pairs |
|---|---|
| Ace 60 | 41e4:2101, 41e4:2102, 19f5:FC30, 19f5:FF1B |
| Ace 60 Pro | 41e4:2103, 41e4:2104, 19f5:FC31, 19f5:FF0F |
| Ace 60 Pro ISO FR | 3837:3040, 3837:3041 |
| Ace 60 Pro Nordic | 3837:3002, 3837:3022 |
| Ace 60X I | 41e4:2126, 41e4:2127 |
| Ace 60X II | 41e4:2112, 41e4:2113 |
| Ace 68 I | 41e4:2114, 41e4:2115 |
| Ace 68 Pro | 41e4:2116, 41e4:2117 |
| Ace 68 III | 3837:3003, 3837:302A |
| Ace 68 Air II | 41e4:2120, 41e4:2121 |
| Ace 68 Air III | 41e4:2132, 41e4:2133 |
| Ace 68 Air 2 | 3837:300A, 3837:300B |
| Ace 68 GT | 3837:3007, 3837:3009 |
| Ace 68 Turbo 16K | 3837:3026, 3837:3027 |
| Ace 68 Turbo 8K | 3837:3028, 3837:3029 |
| Ace 68 V2 III | 3837:3024, 3837:3025 |
| Ace 75 8K | 3837:303C, 3837:303D |
| G75 V2 | 3837:2021, 3837:2022, 3837:3033, 3837:2010 |
| G87 V2 | 3837:2015, 3837:2019, 3837:3033, 3837:2010 |
| G98 V3 | 3837:2025, 3837:2026, 3837:1015, 3837:1017 |
| God 60 | 3837:3020, 3837:301A |
| GT 75 | 3837:302D, 3837:302F |
| Jet 75 I | 41e4:2118, 41e4:2119 |
| Jet 75 II | 41e4:211A, 41e4:211B |
| K87 V3 | 3837:2023, 3837:2024, 3837:1015, 3837:1017 |
| K87S | 3837:200E, 3837:200F, 3837:3033, 3837:2010 |
| K99 V3 | 3837:2020, 3837:201F, 3837:3033, 3837:2010 |
| Mix 87 I | 41e4:2122, 41e4:2123 |
| Mix 87 III | 3837:300D, 3837:302C |
| Zero75X | 41e4:211C, 41e4:211D |

## Caveats

- I did not decode packet layouts for individual settings in either mouse protocol, the older-generation write side, the keyboard SDK, or the headsets.
- The older mouse models have no PIDs, sensors or MCUs in the sources I found.
- Where the page's lists leave a sensor or MCU out, I left it blank.
