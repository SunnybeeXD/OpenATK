# ATK HUB firmware update over WebHID

These notes describe how the ATK HUB web app flashes firmware from the browser. They come from reading the shipped production bundle, HUB version `3.2.33` (194 minified `.js` chunks), and nothing else. **Nothing here has been tested on a device**, no ATK server was called, and no firmware was downloaded. The bundle is evidence, not a specification, and it changes between releases. Where the code does not let me decide something, the text says so and the open items are collected at the end.

Chunks read (all names are the shipped file names with the `static_` prefix and hash dropped):

| Chunk | What it holds |
|---|---|
| `demoMode.store` | All upgrade classes, the provider registry, the upgrade dialogs and their state machine, the device tables for keyboards and Waizowl/Hechi-style mice |
| `useRemoteConfig` | Base HID transport classes, the COMPX firmware header class, the mouse command enum (`EnterUSBUpgradeMode` 13, `ReportMouseUpgradeStatus` 91, `ReportMouseUpgradeErrorStatus` 90), `upgradeVersionMap`, the COMPX and BitMouse mouse tables |
| `api` (the one that exports the Evision class) | Evision V2 wired-keyboard and dongle upgrade classes (`It`, `Oe`), the DuckBread and HFD keyboard transports |
| `AtkRadioGroup` | Shared transport classes, including the OTA class used for dual-chip keyboards and the Hechi mouse transport |
| `evisionv2-upgrade` | The Vue dialog for the YOGO 75 keyboards |
| `other-setting`, `otherSetting` | The "check for update" buttons that decide which dialog opens |
| `filters` | Headset device tables |
| `via`, `via-detector`, `bykb-*` | Version reading only, no flashing (see "Devices with no in-browser path") |

## Overview

HUB does not have one updater. It has ten vendor-specific providers (several with more than one upgrade class) behind one dialog (`SingleDeviceV2`), plus a legacy two-device dialog (`MultipleDevices`) that upgrades a mouse and its receiver in sequence. Each class knows one vendor's boot protocol. The dialog does the same things for all of them:

1. Pick the device (already permitted, or through the browser's HID picker).
2. Read the current version, list online firmware (or take a local file).
3. Download or read the file, validate its format, check that it targets this device.
4. Tell the device to leave normal mode.
5. Find the device again under its boot identity, asking for a new WebHID permission if needed.
6. Stream the image in small output reports.
7. Reset the device, wait for it to come back, read the version again and show it.

```
 firmware list (REST)            local file
        |                            |
        +--------------+-------------+
                       v
          download bytes (axios GET, arraybuffer, no decryption here)
                       v
        provider.prepare(): parse header, check VID/PID, check size/CRC
                       v
   +-------------------+--------------------+
   | phase "switch": send "enter boot" cmd  |   (not sent if the device is already in boot mode)
   +-------------------+--------------------+
                       v
        device re-enumerates (new PID, or a second interface)
                       v
   phase "authorize"/"discover": getDevices() polling, or requestDevice() prompt
                       v
   phase "write": erase / prepare, then data packets, then verify / end
                       v
        device resets and re-enumerates in normal mode
                       v
   phase "reconnect": poll getDevices() for 20 s, read version
                       v
        "success" (version shown)   or   "timeout" (pick the normal-mode device manually)
```

Failure after the switch or write phase lands in phase `interrupted`: the UI tells the user to identify the device again and run the full upgrade again. There is no resume.

## Entry points

The update button lives in the mouse and keyboard settings pages (`other-setting`). The decision order is:

1. The device's controller class is checked against the classes HUB knows how to flash. If it is not one of them the user gets a message to download the firmware from the vendor site and run the desktop `.exe` (locale key `firmwareUpdateDownloadDriver`, link `https://desktop.vxe.com/home` in the legacy dialog). No flashing happens in the browser.
2. If the page runs in a plain browser rather than the Electron client (`navigator.userAgent` contains `electron/`), a prompt recommends the desktop client and offers "use web version" (`recommendClient`, `goDownloadClient`, `useWebVersion`). Choosing the web version continues.
3. The dialog is opened with a solution-provider id (`COMPX`, `BITMOUSE`, `HECHI`, `WAIZOWL`, `BITYUAN`, `ARBITER`, `DUCKBREAD`, `HFD`, `TTGK`, `BOLUTEK`). The model's `custom.upgradeTogether` flag decides between the legacy two-device dialog and the single-device dialog.
4. `SingleDeviceEntry` looks the provider up in the registry `[ap, op, ip, rp, np, sp, dp, fp, vp, bp]`. A hit opens the new dialog `SingleDeviceV2`. Without a hit (and not a headset) it falls back to the older `SingleDevice` page, which carries the same upgrade classes in its own table.
5. The YOGO 75 and YOGO 75 PRO keyboards (Evision V2) have their own dialog, `evisionv2-upgrade`.

Which upgrade is available is shown on the device card by comparing a "latest version" string against the device's version. The latest version comes from `GET {api}/firmware/{vid}/{pid}/{firmwareMark}` where `api` is `https://api-hub-cloud.atk.pro` in the bundle. I did not call it.

## Which device families use which path

All paths below are from the bundle's own tables. `0x373B` is the main ATK vendor ID, `0x3554` the VXE vendor ID, `0x1FC9` is NXP's.

| Provider | Device kind | Devices (from the tables) | Normal-mode HID interface | Boot identity |
|---|---|---|---|---|
| COMPX | Mice and their receivers | 186 table entries: 151 under `0x373B` and 35 under `0x3554` (ATK X1, F1, A9, U2, Y9, Z1, Duckbill, Ghost, ZERO, Phantom, MAD R, VXE R1 families and "Mouse 1K/4K Dongle" receivers) | usagePage `0xFF04`, usage 2 in the table; the firmware header carries its own endpoint strings (usagePage `0xFF02`, usage 2) | Taken from the firmware header, often the same VID/PID |
| COMPX `is54H20` | Mice with an nRF54H20 chip | Entries flagged `is54H20` (Duckbill Ultra/EXTREME, ZERO EX, X1 EXTREME 2.0/GT, F1 EXTREME 2.0, F1 LEVIATAN 2.0, Ghost EXTREME, X1 Air+ and others) | Keyboard-usage interface (usagePage 1, usage 6) | No re-enumeration, DFU runs inside the application |
| BITMOUSE | Mice and receivers | Entries in the BitMouse table (`useRemoteConfig`) | `0x373B`, usagePage `0xFF05` usage 1 for the data interface (PID `0x1154` is the default placeholder, replaced by the file's PID) | None: the mouse stays on its VID/PID |
| BITMOUSE Nearlink | Mice with a Nearlink dongle | Entries flagged `isNearlink` | `0x373B:0x11DB`, usagePage `0xFFB1` (DFU control) and `0xFFB3` (data), usage 1 | None |
| HECHI | Mouse and dongles | ATK A9 PRO MAX `0x373B:0x1147` (boot `0x2151`), "Mouse 1K Dongle" `0x1148` (boot `0x2152`), "Mouse 8K Dongle" `0x1196` (boot `0x215E`) | usagePage `0xFFA0`, usage 2 | Boot PIDs above, usagePage `0xFFA0`, usage 2 |
| WAIZOWL | Mouse and dongle | ATK Duckbill ELITE `0x373B:0x1282`, "Wireless mouse 8k dongle-U" `0x373B:0x1283` | usagePage `0xFF02`, usage 2 | `0x1FC9:0x0021` (NXP MCUBoot HID), usagePage `0xFF00`, usage 1 |
| BITYUAN | Keyboards | About 104 normal-mode entries (EDGE 60/63, ATK60 RX, VELOTA FUZZY/NOTHING, RS6, RS63, RS8, ATK68, Hex80 and others) | `0x373B`, usagePage `0xFF60`, usage `0x61` | Per-PID boot PID, usagePage `0xFF00`, usage 1 |
| BITYUAN `isDualChip` | Keyboards with a second MCU | VELOTA FUZZY 60 V2, VELOTA FUZZY 63, VELOTA NOTHING 68, Hex80 V2 (others may exist, the flag is set on the shared config objects) | same | same |
| ARBITER | Keyboards | ATK68 V2 `0x373B:0x105E` (boot `0x2029`), ATK68 V2 S `0x373B:0x10C2` (boot `0x2067`) | usagePage 1, usage 0 | Boot PIDs above, usagePage `0xFF00`, usage 1 |
| DUCKBREAD | Keyboards | ATK RS7 `0x373B:0x1044` (boot `0x2002`), ATK68 V2 Pro `0x373B:0x1048` (boot `0x2018`) | usagePage `0xFF60`, usage `0x61` | Boot PIDs above, usagePage `0x00FF`, usage 1 |
| HFD | Keyboards | Seven entries seen in the table range I read (ATK A87, A87 Ultra, A98, A98 Pro and unnamed siblings): `0x373B:0x111E`, `0x111F`, `0x1231`, `0x114D`, `0x114E`, `0x1151`, `0x1152` | usagePage `0xFF60`, usage `0x61` | `0x0C45:0x7040` for `0x111E` and `0x1231`; `0x373B:0x2002` for `0x111F`; `0x373B:0x212E` and `0x212F` for the A98 entries |
| EVISION_V2 | Keyboards | ATK YOGO 75 (`0x119C` wired, `0x1200` 2.4G dongle), YOGO 75 PRO (`0x119B` wired, `0x11FF` 2.4G dongle) | usagePage `0xFF60`, usage `0x61` | `0x36B0:0x33FF`, usagePage `0xFF00`, usage 1 (dongle PIDs are flashed directly) |
| TTGK | Headsets | Entries in the headset table | Headset HID interface | `0x0666:0x0888` |
| BOLUTEK | Headsets and their dongle | Entries with `connectType` dongle 1K | Two interfaces, usagePage `0xFF90` and `0xFF82` | None |

Other providers appear in the same tables (`EVISION`, `GTECH`, `JinTuoDa`, `HOLTEK`, `BYKB`, `VIA`, `KTMICRO`) but have no flashing code in the browser. See "Devices with no in-browser path".

## Common machinery

### Phases and progress

`SingleDeviceV2` is a state machine over these phases: `prepare`, `download`, `slave-write`, `switch`, `authorize`, `cancelled`, `discover`, `connected`, `missing`, `write`, `reconnect`, `timeout`, `success`, `interrupted`. Each upgrade class reports phases through a `hooks` object (`onPhase`, `onProgress`, `onDeviceConnected`, `selectBootDevice`, `onStatus`).

Progress numbers are class specific. Where a class prints "15 to 60" style ranges they are listed in its section. For dual-chip keyboards the dialog rescales: during `slave-write` it shows `(p - 20) / 32`, during `write` it shows `(p - 56) / 44`.

The "start" button is enabled when the dialog is not busy, a device is resolved, and either an online firmware is selected or (when not online-only) a non-empty local file is chosen. There is **no check that the chosen version is newer** than the installed one: re-flashing the same or an older version is allowed. After a successful write the dialog stores the version read back from the device and shows it. The "expected" version taken from the file is displayed as the target but is not compared with the read-back version. The Bolutek provider defines `versionsMatch` and `requireVersionReadback` but I found no caller that enforces them.

### Guards while an upgrade runs

- A `beforeunload` listener and a `hub:exit-check` listener call `preventDefault()` while the dialog is busy, or while a write has started and not finished.
- `FirmwareUpgradeState.start()` marks an upgrade as running. It throws if the app is already exiting, and `check()` clears the flag on its own after 300000 ms (5 minutes).
- The low-battery popup setting is turned off for the duration and restored afterwards.
- The dialog cannot be closed while busy. Closing outside the `prepare` or `success` phase, or after a write began, shows a "Leave the upgrade for now?" confirmation.
- Each `run()` is wrapped so the class is disposed afterwards and the device's previous `oninputreport` handler is put back.

### Transport behaviour (retries and timeouts)

Several HID wrapper classes sit under the upgrade classes. The retry rules differ and matter for failure handling:

| Wrapper (used by) | Matching rule | Timeout per attempt | Attempts | On exhaustion |
|---|---|---|---|---|
| Base `Xt.promiseRun` (default) | Reply whose first 16 bits equal the request code | 500 ms | 1 + 3 retries | **Resolves** with a dummy 64-byte buffer whose byte `[2]` is `0xFF`. It does not throw. |
| COMPX mouse (`rg`) | Reply whose byte `[0]` equals the first byte of the request | 3000 ms | 1 + 3 | Resolves with the dummy above |
| DuckBread, Waizowl feature path | Same byte `[0]` rule (DuckBread), byte `[2]` command id (Waizowl) | 3000 ms | 1 + 3 | Dummy buffer (`[2] = 0xFF`) |
| Hechi (`zc`) | Reply byte `[0]` equals request byte `[0]` | 3000 ms | 1 + 3 | Dummy buffer |
| BitMouse DFU (`K2`) | Reply byte `[4]` equals request byte `[5]` (the command code) | 10000 ms | 1 + 3 | **Rejects** (`Transfer failed after 3 retries`) |
| Arbiter boot (`G_`) | **Any** input report counts as the reply | 500 ms | 1 + 3 | Rejects |
| Dual-chip keyboard OTA (`ru`) | Per call: a predicate on the reply bytes | 2000 ms by default, 5000 ms for "enter OTA", 4000 ms for the final command | Retries only on a NACK (`0xB2 0xEF`), max 3, 100 ms apart | Rejects (`OTA_TIMEOUT`, `OTA_NACK_CRC`, `OTA_MAX_RETRIES`) |

Because the default wrappers resolve with a dummy buffer instead of failing, several write loops (COMPX, DuckBread without hooks, Evision wired keyboard) do not notice a missing acknowledgement at the packet level. The callers that do check replies are listed per path below.

WebHID `sendReport(reportId, data)` is given the payload without the report ID byte. Where this document says "report N, X bytes" it means `sendReport(N, X bytes)`.

### Firmware list and download

- List: `GET {api}/firmware/{vid}/{pid}/{tag}/list`, plus `POST /firmware/gray/list` with `{vid, pid, tag, currentVersion}` (a gray-release list). The two lists are merged and de-duplicated on `[version, file]`. `tag` is the model's `firmwareMark` (for example `a9`, `f1`, `dongle`, `edge60`). Some COMPX mice on vendor `0x3554` get a mark chosen from the HID product name (`r1`, `r1-se`, `r1-se+`, `r1-pro`, `r1-pro-max`, `f1-moba`, `f1-pro-max`).
- Each list item has `version`, `file` (a URL), `content` and `content_en` (release notes), and for gray items `versionId`.
- Download: `axios.get(file, {responseType: "arraybuffer"})` with a progress callback. The bytes are wrapped in a `File` (`atk.bin`, or `firmware.<bin|hex>` in the new dialog; the extension comes from the URL, then the provider's default). The bundle does not check which host the URL points at, so I cannot confirm from the code that the files live on `bpcdn.atkgear.com`. That host appears in the bundle only as the static asset CDN.
- After a successful gray-release install the app posts `/firmware/gray/upgrade/confirm` with `driverVersion: "3.2.33"`.
- There is **no signature or hash check of the downloaded bytes in the browser** except where a provider's own parser does one (BitMouse decrypts and authenticates its container, the merged dual-chip file has CRCs, DuckBread checks a checksum). Everything else relies on header matching and on the device's bootloader.

## Path 1: COMPX mice and receivers

This is the path the question calls the "mouse and dongle path". Two things first.

**Command 13 (`EnterUSBUpgradeMode`) is not sent by this code.** The identifier `EnterUSBUpgradeMode = 13` exists in the mouse command enum in `useRemoteConfig`. No other chunk of the bundle refers to it, and no upgrade class builds a command from it. COMPX mice are put into upgrade mode with a command **stored inside the firmware file** (field `resetToUpdateModeCmd`, below). Whether that stored command is the command-13 request I could not determine, because its bytes live in the firmware files, which I did not read.

**Status reports 90 and 91 are consumed here.** The COMPX HID wrapper watches input reports whose first byte is `91` (`ReportMouseUpgradeStatus`) or `90` (`ReportMouseUpgradeErrorStatus`) and republishes them on the internal channel `compx-upgrade-reporting`. See "Upgrade status reports".

### Firmware file layout

The file is a COMPX container: an 8192-byte (`0x2000`) header followed by the firmware body. All integers are little endian.

| Offset | Size | Field |
|---|---|---|
| 0 | 4 | `headCRC`. Read but **not verified** by the browser |
| 4 | 4 | `headLength` (must be at most 8192) |
| 8 | 4 | `fwLength` (must be non-zero and at most `fileSize - 8192`) |
| 12 | 4 | `nextFileAddress`. Non-zero means a second image follows (see below) |
| 16 | 4 | `version`, shown as the hex string of this value |
| 20 | 1 | `deviceType`. `210` (`0xD2`) is a mouse, `211` (`0xD3`) is a receiver |
| 21 | 1 | `cid` |
| 22 | 1 | `mid` |
| 23 | 64 | `fileId` |
| 87 | 64 | `icName` (ASCII, NULs dropped) |
| 151 | 64 | `bootInputEndPoint`, a string containing `vid_XXXX&pid_XXXX` |
| 215 | 64 | `bootOutputEndPoint` |
| 279 | 64 | `normalInputEndPoint` |
| 343 | 64 | `normalOutputEndPoint` |
| 407 | 64 | `resetToUpdateModeCmd` |
| 471 | 64 | `prepareDownLoadCmd` |
| 535 | 64 | `dataDownLoadCmd` |
| 599 | 64 | `sensorName` |
| 663 | 64 | `productName` |
| 8192 | `fwLength` | firmware body |

The endpoint strings are split on `&`, and the `vid_` and `pid_` parts are parsed as hexadecimal. The browser fixes the HID usage to usagePage `0xFF02`, usage 2 for all four.

The three command blobs share one layout: byte 0 is a length `L`, byte 1 is a feature-report flag (greater than 0 means `sendFeatureReport`, otherwise `sendReport`), byte 2 is the report ID, and bytes `3` to `L+1` are the payload that is actually sent (`L - 1` bytes). The new dialog rejects a file when any of the three length bytes is below 2 or above 62.

**Validation in the new dialog (`js()` and `op.prepare`):**

1. File size must exceed 8192 bytes.
2. `fwLength` must be non-zero and no larger than `size - 8192`; `headLength` at most 8192.
3. Both the normal and the boot endpoint must yield integer VID and PID.
4. The three command length bytes must be in 2 to 62 (skipped in "unresolved model" recovery, where only the header's boot endpoint is used).
5. The device's VID/PID must equal the header's normal endpoint or boot endpoint. When the model is already resolved, the header's **normal** VID/PID must equal the table entry's VID/PID. Otherwise `errFirmwareMismatch`.
6. If `nextFileAddress` is non-zero it must be at least `8192 + fwLength` and below the file size. The second image is parsed the same way; it must not have its own `nextFileAddress`; its normal endpoint must match the device unless the device is already in boot mode; and an `is54H20` model cannot carry a second image.
7. The version value must not exceed `0xFFFF`. It is displayed as `(v >> 8).(v & 0xFF)` in hex, for example `0x0123` becomes `1.23`.

There is no encryption or obfuscation step in the browser for this container. The CRC the header may carry is not checked here.

### Upgrade flow, standard COMPX class (`ys`)

Entry: `startUpgrade({file, isBoot, device, hooks})`.

1. Parse the header. If the device's VID/PID is neither the header's normal nor boot endpoint, show `deviceUpgrade.firmwareMismatch` and return `FirmwareError`.
2. If `nextFileAddress > 0`, a second header is parsed at that offset. Two images mean `firmwareTotal = 2`: the **second (slave) image is flashed first**, then progress is set to 100 for it, the code waits 3000 ms, and the **first (master) image** is flashed. Progress is split 50/50 between them.
3. For each image, `upgrade(info, index)`:
   1. If the device is in normal mode (`isBoot` false), the normal-mode device matching `normalInputEndPoint` is opened and `resetToUpdateModeCmd` is sent with the stored report ID and report type.
   2. Boot discovery (see "Finding the device again"). When the normal and boot VID/PID are equal the code calls `selectBootDevice` with `{automatic: true}`; otherwise the user is asked to select the boot device.
   3. `prepareDownLoad`: send `prepareDownLoadCmd` from the file, then wait up to **30000 ms** for status report 91 with task `1` (`eraseBackupArea`) or `2` (`eraseRunArea`) and status `1`.
   4. `dataDownLoad`: send the body, then wait up to **120000 ms** for status report 91 with task `0x88` (`success`).
4. When the dialog was opened on a device it considers already in boot mode and the header's normal and boot VID/PID are identical, `upgrade()` returns `Success` immediately without sending anything, on both the hooks path and the legacy path. That looks odd (nothing is flashed), and the code does not explain it. I could not tell whether such a device state can occur.

**Data packets.** Packet count is `ceil(fwLength / 32)`. Each packet is a 64-byte buffer of which the first 48 bytes are sent, using the report ID in byte 2 of `dataDownLoadCmd` and `sendFeatureReport` when byte 1 of that blob is greater than 0:

| Byte | Content |
|---|---|
| 0 | `0xB1` |
| 1 | `0xC0`, or `0xC1` on the last packet |
| 2 | Data length: 32, or `fwLength - offset` on the last packet |
| 3 | `0x00` |
| 4 to 7 | Flash address, **big endian**. Start value is bytes 7 to 10 of `dataDownLoadCmd` read big endian, plus 32 per packet |
| 8 to 15 | `0x00` |
| 16 to 47 | Data (bytes at `8192 + 32*n` of the image), padding bytes `0xFF` |

The acknowledgement is matched on `0xB1` in byte 0 with the 3000 ms and 3-retry rule above, and the dummy-buffer fallback means **a missing ack is not an error**. A failed write is detected only by status report 90, or by the 120 s wait ending. Progress for each image is `(packet + 1) / packetCount`, rescaled for the two-image case.

### Upgrade status reports (90 and 91)

Input reports arrive on the same HID interface. The wrapper looks at byte 0 of the input data:

| Byte 0 | Name | Layout |
|---|---|---|
| `0x5B` (91) | `ReportMouseUpgradeStatus` | byte 2 `task`, byte 3 `status` |
| `0x5A` (90) | `ReportMouseUpgradeErrorStatus` | byte 2 `message` (read, never shown) |

Task codes known to the bundle: `1` erase backup area, `2` erase run area, `5` check run area, `0x88` (136) success. Status `0` is "erase" and `1` is "success".

Handler rules in `ys`:

- Any report 90 rejects every pending task with `deviceUpgrade.deviceReportedFailure` and removes the listener. The error code in the report is not passed on.
- Report 91 with task `1` or `2` and status `1` resolves `prepareDownLoad`.
- Report 91 with task `0x88` resolves `dataDownLoad`. Status is not checked.
- `checkRunArea` (5) has no handler.

### nRF54H20 variant (`fs`, models flagged `is54H20`)

These mice update through feature reports on a keyboard-usage HID interface (usagePage 1, usage 6) without switching to a boot device. File layout is the same container; the body starts at byte 8192. The protocol:

- Feature report ID `12`, 121 bytes: `[0] = 0x0C`, `[1]` recipient, `[2]` event ID, `[3]` command or status, `[4]` data length, `[5...]` data (116 bytes maximum).
- Command codes: `6` SET, `7` FETCH, `8` SUCCESS.
- Busy query: recipient 0, event 3, command 7. Reply data byte `[0]` must be 0 (idle), and byte `[32]` of the raw reply must be 0 for `deviceType` 210 or 1 for `deviceType` 211, otherwise `deviceUpgrade.deviceTypeMismatch`.
- Prepare: recipient 0, event 1, command SET, data `length(4 LE) | crc(4 LE) | 0(4)`. The code then polls the busy report up to 50 times, 100 ms apart, until the device echoes the same length and CRC (`upgradeDeviceNotReady` or `firmwareCheckFailed` otherwise).
- Data: recipient 0, event 2, command SET, 116 bytes of body per report, 10 ms apart. The reply must be recipient 0, event 2, command 8. Up to 16 retries per packet, 10 ms or 100 ms apart.
- After each 32 KiB (`32768`) segment: poll the busy report up to 100 times with 300 ms plus 50 ms waits until the device reports state `1` (or `0` for the last segment), the same length and CRC, and a byte count equal to what has been sent.
- Reset: wait 3000 ms, then recipient 0, event 4, command FETCH.
- CRC: reflected CRC-32 (polynomial `0xEDB88320`) computed over 512-byte blocks with the running value carried from block to block. The initial value is 1, not `0xFFFFFFFF`.

### Legacy two-device dialog (`MultipleDevices`): receiver then mouse

Used for models with `custom.upgradeTogether` (69 COMPX entries and some BitMouse ones). Rules enforced in code:

1. The user selects one mouse and one receiver (each from devices already authorised, or through `requestDevice`) and supplies a firmware file for each. The dialog header says "Ensure Mouse and Receiver are Wired!" (`ensureMouseAndReceiverWired`). This is text only: nothing in the code reads the connection type before upgrading.
2. `isBoot` is initialised to false for both panels and never set, so this dialog does **not** support devices that are already in boot mode.
3. For COMPX only (`solution === COMPX` on either side) the files are checked before starting: the u32 at offset 16 of each file, as a hex string, must not be `"0"` (otherwise `mouseFirmwareError` or `receiverFirmwareError`), and, unless the mouse PID is in the exempt list or the receiver PID is in the (empty) exempt list, **the first hex digit of the two version strings must be equal** (`firmwareVersionMismatch`). Exempt mouse PIDs, from the bundle's decimal list: `0x1256`, `0x125A`, `0x1269`, `0x127C`, `0x127D`, `0x127E`, `0x128E`, `0x1298`, `0x12A7`, `0x12A8`, `0x12A9`.
4. Order: **the receiver is flashed first, then the mouse.** Progress is 0 to 50 for the receiver, 50 to 100 for the mouse, with a 1000 ms pause between them.
5. If the receiver fails the mouse is not attempted (`upgradeFailSubReceiver`). If the mouse fails after a good receiver update the message is `upgradeFailSubMouse` ("receiver firmware upgraded successfully").
6. Locale strings `upgradeNoticeTitle`, `syncUpgradeReminder` and `upgradeCompanionDevice` exist but nothing in the bundle uses them.

The legacy path calls the same `ys` class with no `hooks`, so boot discovery uses the older route: the Electron client polls `getDevices()` 10 times, 500 ms apart; a plain browser shows the app's own device-picker dialog (and, when the boot VID/PID differs from the normal one, a toast `deviceUpgrade.selectMouseToUpgrade`).

## Path 2: BITMOUSE mice and receivers

These mice stay on the same VID/PID and use an in-application DFU over report 8. The file has a browser-side parser and a browser-side decryption step.

### Container (`Y0`)

All integers little endian. A file either starts with the ASCII magic `FWATKPAK` or is a bare MCUboot image.

| Offset | Size | Field |
|---|---|---|
| 0 | 8 | `FWATKPAK` |
| 72 | 4 | PID |
| 76 | 4 | VID |
| 128 | 4 | `ATKE` marks an encrypted body |
| 132 | 1 | Encryption version, must be 1 |
| 133 | 1 | Algorithm, must be 1 |
| 136 | 4 | Plaintext length `n` |
| 140 | 12 | Nonce |
| 152 | 4 | Key number, must be 1 |
| 156 | 4 | Reserved, must be 0 |
| 1024 | `n` | Body (encrypted when `ATKE` is present) |
| 1024 + `n` | 16 | Authentication tag |

Errors raised: `固件文件不完整` (too short), `不支持的固件加密版本或算法`, `不支持的固件密钥编号`, `固件文件长度与头部声明不一致` (body must be exactly `n + 16`), `当前环境不支持 WebCrypto，无法解密固件`, `固件解密校验失败：密钥不对或文件已损坏`.

Decryption, using WebCrypto `HMAC`/`SHA-256` and a **fixed 32-byte master key embedded in the bundle** (the constant `xm` in `demoMode.store`; I am not reproducing its value here):

1. `encKey = HMAC-SHA256(master, "ATK-OTA-ENC-v1")` (32 bytes).
2. `macKey = HMAC-SHA256(master, "ATK-OTA-MAC-v1")`.
3. Tag check: the first 16 bytes of `HMAC-SHA256(macKey, file[0 .. 1024 + n))` must equal the 16 bytes after the body. The comparison XOR-accumulates all 16 bytes. This covers the header, so the VID/PID fields are authenticated.
4. Keystream block `j`, for each 32 bytes: `SHA-256(encKey (32) || nonce (12) || j as 4 bytes big endian)`. XOR with the body.

If the file does not start with `FWATKPAK` it is treated as a raw MCUboot image and no VID/PID is read from it. In that case the device's own VID/PID is used for the match, so **a raw image is never checked against the model**.

After decryption the image must pass `Tu`/`ik`:

- u32 at 0 is the MCUboot magic `0x96F3B83D`.
- Header size (u16 at 8) at least 32; image size (u32 at 12) non-zero.
- The TLV area starts at `headerSize + imageSize + protectedTlvSize (u16 at 10)`; its info word must be `0x6907` and its size must fit in the file.
- A TLV of type `0x10` (SHA-256) with length 32 must exist. The browser extracts this hash but neither sends it nor compares it with its own digest. Signature checking is left to the device.

Model match: the file's PID and VID (offsets 72 and 76) must equal the device's. A mismatch is `固件不匹配，请检查固件是否正确` in the legacy class and `errFirmwareMismatch` in the new dialog.

### Flow (`pc`)

All commands use report 8 and go through the BitMouse transport (10000 ms, up to 3 retries, rejects on failure).

1. `connect`: use the device itself if it matches the data interface filter `{vid, pid, usagePage 0xFF05, usage 1}`, else ask `selectBootDevice([filter], {automatic: true})`. Progress 5.
2. `enterBoot` (phase `switch`), the "init DFU" command, then progress 10:

   Payload (63 bytes after the report ID byte `0x08`): `[0] checksum`, `[1] 0x72`, `[2] 5`, `[3] 0`, `[4] 0`, `[5] 0x4B`, `[6] 4`, `[7..10] image size (u32 LE)`, rest zero. The checksum is the low byte of `payload[5..5+len] summed + [1] + [2] + [3] + [4]` where `len` is byte `[2]`. Success needs a reply of at least 7 bytes with byte `[6] == 0`, otherwise `初始化DFU失败`.
3. Write (phase `write`), progress from 15 to 90. The image is split into **48-byte** chunks. Each chunk is a DFU write, laid out like the init payload: `[1] 0x72`, `[2] len + 6`, `[3] 0`, `[4] 0`, `[5] 0x4C`, `[6] len + 4`, `[7..10] offset (u32 LE)`, `[11..] data`, with the same checksum rule. The reply carries the offset it wrote at bytes 6 to 9 (LE); it must equal the chunk's offset or the chunk is retried, up to 3 times with 100 ms between tries. After three failures: `分片 n/N 发送失败`.
4. Finish: command `0x4D` (`77`) with length 1, no reply waited for. Then 1000 ms, then progress 90.
5. Models `0x129E` and `0x1331` (decimal 4766 and 4913) then wait an extra 30000 ms in ten 3000 ms steps, ticking progress from 91 to 100. Other models jump straight to 100.

Errors are wrapped as `升级失败（步骤：<step>）：<reason>`. Steps are `初始化`, `固件解析`, `连接设备`, `进入Boot模式`, `下载固件`, `退出Boot模式`.

### Nearlink variant (`yc`)

- File: first 1024 bytes are a header (PID u32 LE at 72, VID u32 LE at 76), the rest is the image. The new dialog only checks `size > 1024` and PID/VID. It does **not** parse or decrypt this body.
- Two interfaces of `0x373B:0x11DB` are opened: DFU control usagePage `0xFFB1` and data usagePage `0xFFB3`, usage 1 each. If either is missing the code calls `navigator.hid.requestDevice` with those filters.
- DFU control (report 9, 63 bytes): `EF BE AD DE 0C 00 1E E1 <u16 LE> 00 00`. The u16 is `0x0000` to enter and `0xFFFF` to exit.
- Header packet (report 0, 64 bytes): `EF BE AD DE 18 00 D2 2D 00 00 00 00 <size u32 LE> <size u32 LE> 00 00 00 00`, sent after the enter command plus 1000 ms.
- Data: 64-byte chunks padded with `0xFF`, report 0, 2 ms apart. The reply must echo the first 12 bytes of the chunk, otherwise `分片 n/N 校验失败`.
- Exit: in the new dialog the exit command is sent and the code returns. Without hooks it waits for two device connect/disconnect events (at least 3000 ms, at most 10000 ms).

## Path 3: HECHI mouse and dongles

Container (`i0`, little endian for the multibyte fields): `[0..1]` normal VID, `[2..3]` normal PID, `[4..5]` boot VID, `[6..7]` boot PID, `[8]` minor, `[9]` major (shown as `major.minor` in decimal with two-digit minor), `[10..13]` firmware length `L`, body, then a 4-byte value at `L + 14` that the class can compute as `0x55555555 - sum(bytes[0..L))` but **does not verify** in the new dialog. The dialog checks: size above 18; `L` non-zero; `18 + L == size` (else `固件长度校验失败`); normal VID/PID equal the model's; boot VID/PID equal the model's table boot entry. The **whole file, header included**, is what gets sent, not just the body.

Flow:

1. Phase `switch`: report 11, 63 bytes `AA 01 00...`, sent with no reply wait. Then 1000 ms.
2. Boot filter `{bootVid, bootPid, usagePage 0xFFA0, usage 2}`. The user selects it (`selectBootDevice` without `automatic`). If the user cancels, the class returns `ConnectError`.
3. Phase `write`: 60 bytes of the file per report 11, 63 bytes: `[0] 0xAB`, `[1] n + 1`, `[2]` position flag (`0` first packet, `1` middle, `2` last; if the file is one packet it is `2`), `[3..]` data. 1 ms before each send. The reply must be at least 3 bytes, byte `[0] == 0xAB`, byte `[2] == 0` or `errInvalidDeviceResponse`.
4. Finish: report 11 `AC 01`, no reply, 1000 ms, then success. Progress is `packet / count * 100`.

Version read: a "get version" request on report 11; the reply is checked for the same command ID and a minimum length.

## Path 4: WAIZOWL (Duckbill ELITE and its 8K dongle), MCUBoot

The bootloader is NXP's HID MCUBoot (`0x1FC9:0x0021`).

### File

Must be a `.bin` when a `File` is given. A 64-byte header precedes the image: bytes `[0..1]` VID and `[2..3]` PID, **big endian**, and the rest of the header is ignored. The image after the header must be between 1024 and 1048576 bytes. When a device is passed (not recovery), the header VID/PID must equal the device's, else `固件文件无效或不匹配`. In recovery (`isBoot` true) no device is passed to the parser, so **no model check happens at all**. The new dialog additionally requires the whole file to be 1024 to 1048576 bytes and the online version to look like `x.y.z`.

### Flow (`li`)

1. Find the normal-mode device (`0x373B:0x1282` or `0x1283`, usagePage `0xFF02`, usage 2). The Electron client retries `getDevices()` 10 times, 500 ms apart; a browser shows the app picker.
2. Phase `switch`: `sendFeatureReport(2, 63 bytes)` with `[0] 0x0E`, `[1] 0x80`, `[2] 0x01`, `[12] 0x01`. Errors from this send are swallowed. Wait 300 ms, close the device, wait 3000 ms.
3. Boot connect: `selectBootDevice([{0x1FC9, 0x0021, usagePage 0xFF00, usage 1}])` with no `automatic`. In a plain browser this waits for the user to pick the device.
4. `GetProperty(MAX_PACKET_SIZE)`: command tag `7`, params `[11, 0]`. The reply must have tag `0xA7` and a size between 1 and 65532.
5. Erase: if the image is at most `491520` (`0x78000`) bytes, `FlashEraseRegion` (tag `2`, params `[0, 491520, 0]`), otherwise `FlashEraseAll` (tag `1`, params `[0]`). Wait up to 30000 ms for each.
6. `WriteMemory` (tag `4`, flags `1`, params `[0, byteCount, 0]`). Wait 5000 ms for the command acknowledgement, then send the image in data reports (report 2) of `min(maxPacketSize, outputReportSize - 3)` bytes. Wait up to 30000 ms for the data-phase response. Progress is `min(99, sent / total * 100)`.
7. `Reset` (tag `11`) on report 1, then progress 100 and a 1000 ms wait.

Command packet: `[tag, flags, 0, paramCount, params as u32 LE...]`. Transport framing for output reports: `[0]=0, [1]=len low, [2]=len high, [3..]=packet`, padded to the report size. Responses arrive as input report 3 with the same framing. A generic response must be tag `0xA0`, at least 12 bytes, status u32 LE at 4 and the echoed command tag u32 LE at 8; a non-zero status raises `... failed: status=0x..`. A zero-length data response raises `MCUBoot data abort`.

Errors are wrapped as `升级失败（步骤：<step>）：<reason>`. Steps: `初始化`, `固件解析`, `进入Bootloader`, `连接Bootloader`, `固件烧录`.

## Path 5: Keyboards

### BITYUAN, single-chip (`tc`)

File (`Md`), all multibyte fields **big endian**:

| Offset | Size | Field |
|---|---|---|
| 0 | 2 | normal VID |
| 2 | 2 | normal PID |
| 4 | 2 | boot VID |
| 6 | 2 | boot PID |
| 8 | 1 | version low part |
| 9 | 1 | version high part (shown as `hex(byte9).hex2(byte8)`) |
| 10 | 4 | firmware length `L` |
| 14 | `L` | firmware |
| `14 + L` | 4 | checksum, `0x55555555 - sum(firmware bytes)` |

The new dialog requires size at least 18 and `18 + L == size`. The checksum is **not verified** for this class. A device may flash a file whose header names a different PID if both PIDs belong to the same `groupName` in the table (the table groups wired, 2.4G and Bluetooth variants of a model).

Flow:

1. Phase `switch`: a 32-byte report on report ID 0, bytes `F0 01 F1 00 ...` (first three bytes `0xF0`, `0x01`, `0xF1`). This goes through the keyboard HID wrapper (3000 ms, 3 retries, dummy buffer on failure), so the call can block for up to about 12 seconds if the device reboots without answering.
2. The user selects the boot device (`selectBootDevice(bootFilters)`, no `automatic`).
3. Phase `write`: the firmware body is cut into **64-byte** reports (the last zero-padded), each sent on report 0 with 5 ms between them, no acknowledgement. Progress goes from 20 to 100.

### BITYUAN, dual-chip merged file (`Ud`)

Used when the model has `isDualChip`. Multibyte fields are little endian.

Header (96 bytes):

| Offset | Size | Field |
|---|---|---|
| 0 | 4 | magic `0xAA55AA55` |
| 4 | 4 | header size, must be 96 |
| 8 | 2 | normal VID |
| 10 | 2 | normal PID |
| 12 | 2 | boot VID |
| 14 | 2 | boot PID |
| 16 | 2 | `masterFwVer` (high byte major, low byte minor) |
| 18 | 2 | reserved |
| 20 | 4 | `slaveFlag`: `1` slaves identical, `0` different |
| 24, 28, 32, 36 | 4 each | master start, end, size, CRC |
| 40, 44, 48, 52 | 4 each | slave 1 start, end, size, CRC |
| 56, 60, 64, 68 | 4 each | slave 2 start, end, size, CRC |
| 72 | 4 | total size |
| 76 | 4 | offset of the total CRC |

Validation (`Jv`): size at least 100 (`too_small`); magic (`bad_magic`); header size 96 (`bad_header_size`); total size equals file size (`bad_total_size`); CRC offset between 96 and `size - 4` (`bad_crc_offset`); for master, slave 1 and (when `slaveFlag` is not 1) slave 2: start at least 96 and below the CRC offset, `end == start + size` or `start + size - 1`, and the region ends before the CRC offset (`bad_regions`); with slave flag 0 the slave 2 size must be above zero; each region's CRC-32 (reflected, `0xEDB88320`, standard seed and final xor) must equal its stored value, **including slave 2 even when it is unused** (`region_crc_mismatch`); finally the CRC-32 of bytes `[0, crcOffset)` must equal the u32 stored at the CRC offset (`crc_mismatch`). A variant with `regionCrcType = 1` uses `0x55555555 - sum` instead, but nothing in the bundle passes that option. Each failure shows its message in a toast and returns `FirmwareError`.

Version per slave image: bytes `[9]` and `[8]` of the slave image, formatted `hex(byte9).hex2(byte8)`. The expected master version is `masterFwVer` formatted the same way.

Device match: the device's VID must equal `normalVid`, and its PID must equal `normalPid` or share a `groupName` group with it (and the same for the boot VID/PID when recovering from boot mode).

Flow (progress points as printed by the class):

1. Progress 5 after validation. If not in boot mode, read the slave versions (`getAllVersion`, bytes at the keyboard's version report). For each slave whose installed version already equals the file's version, that chip is skipped. Any read failure just means both chips are flashed.
2. If any chip needs flashing, open the OTA interface of the same HID device. Phase `slave-write`. Send the "enter OTA" report (report ID = the first output report ID the device declares): 64 bytes `F1 02 F3 00...`, wait for a reply whose byte 0 is `0xC1`, 5000 ms. Failure shows `进入Boot模式失败，请拔插后重试` (EnterBootError).
3. Flash chips in order **1 then 2** with progress from 20 to 52, split by image size. For each chip:
   1. Header packet, 11 bytes: `A1 <chip> <size>:3 bytes big endian <71> <frames+3>:2 bytes big endian <crc16>:2 bytes big endian FE`. The third field is the byte count of the image; `71` is the hardware send size; `frames = ceil(size / 64)`. The CRC16 covers bytes 2 to 7 of the packet. Wait for a reply starting `B1 EF`.
   2. Data frames, 71 bytes each: `A2 <chip> <seq> <~seq> <64 data bytes, padded FF> <crc16 BE> FE`. The CRC16 covers the 64 data bytes. Wait for `B1 EF`. A reply `B2 EF` is a NACK and triggers up to 3 resends 100 ms apart.
   3. `A3 <chip> FE`, sent twice, each waiting for byte 0 equal to `0xC1`.
4. Final `A4 FE`, waiting up to 4000 ms for byte 0 `0xC1`, and a missing answer here counts as success.
5. Errors in the OTA step show `固件烧录失败，请检查连接与固件后重试` (DownloadFirmwareError).
6. Progress 54, wait 2000 ms, then main-chip boot discovery. With hooks, if the device is still in normal mode, phase `switch`, send `F0 01 F1`, and call `selectBootDevice` for the boot filter; the selection must match the boot filter or the result is `进入Boot模式失败，请检查设备是否正确`. Progress 56.
7. Phase `write`: main firmware in 64-byte reports on report 0, 5 ms apart, progress 56 to 100.

CRC16 used everywhere above is CRC-16/CCITT-FALSE (polynomial `0x1021`, initial value `0xFFFF`, no reflection, no final xor).

In recovery (the keyboard is already in boot mode) only the main chip is written (step 3 is skipped). The dialog tells the user this with `recoveryMainChipNotice`: the secondary MCU is checked after reconnecting and, if it does not match, the full firmware must be installed in normal mode.

### ARBITER (ATK68 V2 family)

File: **raw binary, no header, no checksum**. The new dialog only checks that the file is non-empty and that the model has a boot identity. Nothing ties the file to the board model other than the version string, so wrong-file protection depends on the user and on the bootloader.

Flow (`p0`):

1. If the device is not already a boot device: phase `switch`, send a 64-byte report on report ID 0 with `[0]=0x55`, `[1]=0x06` (SetFunc), `[3]` checksum (sum of bytes 4 to 63, low byte), `[4]=56`, `[8]=0x51`, `[10]=0xAA`, `[11]=0xBB`, rest zero. Fire-and-forget when hooks exist.
2. `selectBootDevice(bootFilters)` without `automatic`. The chosen device must match a boot filter.
3. Packets are 64 bytes on report 0: `[0]` command, `[1]` data length, `[2..5]` address (LE), `[6..]` up to 48 bytes of data.
   - Prepare: command `0x81` (129), length 2. Progress 15.
   - Download: command `0x80` (128), one packet per 48 bytes, address advancing by the chunk length. Progress 15 to 60.
   - Verify: command `0x82` (130), the same bytes again at the same addresses. Progress 60 to 95. The browser does not compare any returned data.
   - End: command `0x83` (131) length 2 with no reply, then command `0x84` (132) length 1 with address 1.
4. Any input report counts as an acknowledgement (see the transport table). Progress 100 at the end.

Failure messages: `固件文件读取失败`, `连接Boot设备失败，请检查设备是否已进入升级模式`, `固件校验失败，请检查设备是否正确`, `下载固件失败，请检查设备是否正确`, and `所选 Boot 设备与本次键盘型号不匹配。`.

### DUCKBREAD (ATK RS7 and ATK68 V2 Pro)

File (`v0`), big endian, same layout as the BITYUAN single-chip file but **with** verification: the constructor throws `固件长度校验失败` if `18 + L != size` and `固件异常校验失败` if `0x55555555 - sum(body)` differs from the stored checksum. The header's normal VID/PID must equal the model's, and the boot VID/PID must equal the table's boot entry.

Flow (`ic`):

1. Phase `switch` (normal-mode device must match `{vid, pid, usagePage 0xFF60, usage 0x61}`, otherwise `正常模式设备不匹配。`): send the VIA-style 32-byte report `96 96 96 98` (bytes 0 to 2 are the custom-command id `150`, byte 3 is the `iap` sub-command `152`, the rest zero) on report 0 through the DuckBread transport.
2. `selectBootDevice([bootFilter])`. Boot filter usagePage `0x00FF`, usage 1. The device must match.
3. Two modes, chosen by `checkYateliMcu`: boot PID `0x2002` (RS7) uses **page mode**, the other model uses **sector mode**.

| | Page mode | Sector mode |
|---|---|---|
| Start address | `0x08010000` | `0x08020000` |
| Page size | `0x800` | `0x800` |
| Sector size | n/a | `0x20000` |
| Prepare | `AA 01 <pageCount BE4> <addr BE4>` | `AA 01 <pageCount BE4> <addr BE4>` |
| Erase | `AA 02 <pageCount BE4> <addr BE4>` then wait `pageCount * 20` ms | `AA 02 <sectorCount BE4> <addr BE4>` then wait `sectorCount * 300` ms |
| Extra pause before each data packet | none | 20 ms |

4. Data packets: 64 bytes on report 0, `AA 03 <addr BE4> <chunk index u8> <len u8> <last-in-page u8> <up to 54 data bytes>`. Each page of 2048 bytes is split into 54-byte chunks. Byte 63 is the OR of every other byte in the packet. The reply is compared byte for byte at position 63: a different value raises `写入失败`. With hooks the reply must also be 64 bytes with byte 0 equal to the sent byte 0 (`升级设备未返回有效回执。`).
5. Finish: `AA 96`. In the hooks path it is sent without waiting.

Progress 5, 10, then 10 to 100 over the data packets, then 100.

### HFD (A87, A98 families)

The HFD class does not contain a protocol. It loads the firmware into a **vendor SDK** that is part of the bundle and passes it per-model parameters from the device table: `checkDeviceCmd` (a hex string such as `AA42895AFF7162CC`), `chipId` and `security`. The SDK calls the progress callback and error callback. I did not read the SDK, so the wire protocol, the report IDs and the boot handshake are **not determined**.

What the wrapper does:

- Accepts `.hex` or `.bin`. A `.bin` that looks like Intel HEX text is refused. HEX files are parsed line by line: each record must be `:` plus hex bytes, its length must equal `byteCount + 5`, the bytes must sum to 0 modulo 256, type 1 ends the file, address records must have the right size. A file without an end record or without data is refused.
- Only one HFD job at a time. A second start throws `已有 HFD 升级任务正在运行，请等待结束。`.
- `uy(checkDeviceCmd)`, `ry(chipId)`, `cy(security)` are checked for acceptance (`SDK 不接受此设备校验指令。`, `SDK 不支持此芯片型号。`).
- The write waits up to the SDK's completion, with a status hint after 120000 ms. If progress never reaches 100 the result is `SDK 任务已结束，但未报告完整写入进度，请重新检测设备状态。`.
- Recovery candidate models for a given boot device are offered when the boot PID maps to several models (`errMultipleProviders`/model picker).

### EVISION_V2 (ATK YOGO 75 and YOGO 75 PRO)

Handled by the `evisionv2-upgrade` dialog and the `It` (wired keyboard) and `Oe` (2.4G dongle) classes. The file is a raw `.bin` with a 128-byte header. The browser **does not validate it** beyond "not empty"; the bootloader answers header problems with error codes.

Files can come from the firmware list (`firmwareMark`/tag `device`, VID/PID of the connected device) or from the user's disk (`.bin`, `application/octet-stream`).

Flow for a **wired keyboard** (`It`):

1. If the selected device is not already the boot device or a dongle: `switchToBoot`. A 63-byte report on report ID 63, laid out as a single business frame: `AA 00 00 80 07 00`, payload `C0 02 00 64 00 69 0F` (`C0` is the switch-to-boot command, `64 00` is the 16-bit value 100), then the BCC byte `47`, then zeros. It waits 5000 ms for an answer with byte 0 `0xAA`, byte 6 `0xB0` (ACK) and byte 7 `0x00` (success); any other status shows `switchBootFailedAck: 0x..`. If **no** answer arrives within 5000 ms the code treats it as success (`deviceMayRestarting`).
2. The dialog disconnects, waits 3000 ms (5000 ms on macOS), then `waitForBootDevice` polls for `0x36B0:0x33FF` (500 ms interval, plus `navigator.hid` `connect` events) for up to 15000 ms (8000 ms on macOS).
3. If it is not found, a confirm box (`firmwareUpgradeAuthorizeWait`) asks the user to authorise the boot device and then `navigator.hid.requestDevice` is called with filters `{0x36B0, 0x33FF, usagePage 0xFF00, usage 1}` and `{0x36B0, 0x33FF}`. Declining raises `noBootDeviceSelected`.
4. Start packet: the first 128 bytes of the file as a business payload `A0 80 00 <128 bytes> <crc16>`.
5. Wait 2000 ms.
6. Write blocks: block size is the u16 LE at header offset 66. Each block: `A1 <len+6 LE16> <block index LE16, or FFFF for the last block> <offset LE32> <data> <crc16>`.
7. `A4 02 00 <1000 LE16> <crc16>` (switch to application). Then wait 2000 ms.

Business payloads are cut into frames of at most 56 bytes, each sent as a 63-byte report: `[0]=0xAA`, `[1]=0`, `[2]` frames remaining, `[3]=0x80` on the first frame else 0, `[4..5]` payload length LE, `[6..]` payload, then one XOR (BCC) byte over bytes `[1..5+len]`. After each frame the wired class waits 200 ms for a reply and **ignores a timeout**, so write errors are not caught by the browser on this path.

CRC16 here is CRC-16/MODBUS (polynomial `0xA001`, initial `0xFFFF`), written high byte first. Progress: 5 start, 20 start accepted, 25 to 90 writing, 92 switch to app, 100.

Flow for the **dongle** (`Oe`, PIDs `0x1200`, `0x11FF`): the dongle is flashed directly, there is no switch step. Frames are sent one at a time and each must be answered within 2000 ms (`sendPacketFailed` otherwise). After the start packet and after each block the code reads a business-level ACK (cmd `0xB0`, status in byte 1) for up to 5000 ms. A non-zero ACK status is **logged as a warning and ignored**. Known status codes: `0xE0` unknown command, `0xE1` length, `0xE2` CRC, `0xE3` block number, `0xE4` block size, `0xE5` write offset, `0xE6` read offset, `0xE7` argument, `0xE8` flash operation failed, `0xE9` status, `0xF0` header identify, `0xF1` chip ID, `0xF3` hardware version, `0xF4` software version, `0xF5` header check info, `0xF6` header block info. Progress: 2, 5, then 5 to 90, 92, 100.

At the end, both classes disconnect. Success sets the result to success and calls the dialog callback.

## Path 6: Headsets (brief)

These are outside the mouse and keyboard scope and are only summarised.

- **TTGK.** Boot VID/PID `0x0666:0x0888`. The file is a "SPV" image: at least 4096 bytes, a tag magic of `0x40565053` at offset 4 and a user flag at offset 12 whose upper 24 bits equal `0x4F414D00`. Up to N segments (count at offset 28, each 16 bytes from offset 32) are written in 256-byte chunks after a "set flash write area" command. The messages are framed with magic `BUXX`, command u16, sequence, flag, length u16, header CRC, body, body CRC. The class first reads the chip ID and refuses unknown chips. Entering update mode, handshake, and reboot are all separate commands. Write acknowledgement timeout is 1000 ms, area setup `min(500 + size/4096*100, 30000)` ms.
- **BOLUTEK** (headset and its dongle). Two HID interfaces: usagePage `0xFF90` (report 85 in/out) and usagePage `0xFF82` (report 65 out). The enter-update report is `55 <target> 00` on report 85 (target 0 dongle, 1 headset; PID `0x1262` is the dongle). Ready is signalled by an input report `02 01`; data goes out as 63-byte chunks on report 65, 1 ms apart; the device can pause the stream (`60 FF`) and resume it (`60 00`, pauses longer than 60000 ms abort); completion is `01 01` within 60000 ms; a dongle must reappear within 30000 ms. Only the online firmware list is allowed for this provider and `requireVersionReadback` is set.

## Devices with no in-browser path

For these controller families there is no flashing code in the bundle. The update button only offers the desktop client or the vendor site (`firmwareUpdateDownloadDriver`):

- Evision v1 keyboards and mice, GTECH, JinTuoDa key linkers, Holtek, KTMicro headsets, BYKB keyboards and receivers, and VIA-based keyboards.
- For VIA and BYKB the bundle only reads the firmware version (`parseFirmwareVersion` in `via` and `via-detector`; `readKeyboardFirmwareVersion` and `readReceiverFirmwareVersion` in the BYKB controller). A BYKB receiver version is read from the USB `bcdDevice`, which the web code reports as unavailable.

## Finding the device again after it re-enumerates

The browser gives a page access to a HID device only after the user picks it (`requestDevice`), or if it was picked earlier in the same profile (`getDevices`). A device that comes back under a different PID is a different device to the browser, which is why most paths ask again.

Order in `SingleDeviceV2`:

1. At open, `getDevices()` is filtered by the providers' filters. If the dialog was opened with a device and exactly one match remains, it is used.
2. A boot-mode device that is already authorised is picked up immediately (`Wt` looks through `getDevices()` first).
3. In the **Electron client**, discovery is automatic: up to 20 polls, 500 ms apart (10 s). More than one match raises `errMultipleDevices`. No match moves the dialog to `missing` and the user can retry or open the picker. After the connection a 3-second countdown (`connected` phase) runs before writing.
4. In a **plain browser**, `selectBootDevice` only polls automatically when the class passes `{automatic: true}` (COMPX with equal normal and boot IDs, BitMouse, nRF54H20). Otherwise the phase is `authorize` and the UI shows a guide (open the picker, pick the device named "Upgrade", click Connect). `navigator.hid.requestDevice` needs a user gesture, so this waits for the user. Cancelling moves to `cancelled` with "reopen the picker". Picking a device that does not match the boot filters raises `errNotUpgradeDevice`.
5. After writing, the dialog enters `reconnect` and polls `getDevices()` for the model's **normal-mode** filters for 20000 ms (500 ms steps). Found: read the version, show `success`. Not found: `timeout` with `errDeviceNotFoundAfterRestart`. From there "Reconnect the normal-mode device" opens `requestDevice` with the normal filters (in a plain browser) and reads the version from what the user picks (`errSelectNormalDevice` if it is the wrong device).

Legacy classes without hooks use `getDevices()` polling in the client and the app's own device selector (a modal, `hiddenClose`) in a browser. Delays used there: 10 tries at 500 ms for BITYUAN, DuckBread, Arbiter and COMPX; 2000 ms after the OTA step for dual-chip BITYUAN; 3000 ms after the switch for Waizowl.

## Failure cases and messages

Messages with a Chinese original are translated here; the locale key is given when it exists. `pe.*` are the result codes the classes return.

| Where | Condition | Message or result |
|---|---|---|
| All new-dialog providers | No device selected or unknown model | `errSelectRecoveryModel` ("Unable to identify the device model...") |
| All | Header or integrity check failed | `errInvalidFirmware` |
| All | File does not target this device | `errFirmwareMismatch` |
| All | Online version string not in the expected format | `errInvalidOnlineFirmware` |
| All | Empty file or download failed | `errEmptyFirmware`, `errFileEmpty`, `errDownloadFailed` |
| All | Device did not answer correctly | `errInvalidDeviceResponse`, `errReadDeviceVersion` |
| All | Boot device not connected | `errEnterBoot` (maps from result `EnterBootError`) |
| All | Write started and then failed | `errWriteInterrupted` (maps from `DownloadFirmwareError`), phase `interrupted` |
| All | Any other non-success result | `errUpgradeIncomplete` |
| All | More than one matching device | `errMultipleDevices` |
| All | Wrong model chosen during recovery | `errSameModelRequired` |
| All | `navigator.hid` missing | `errEnvironmentUnsupported` |
| Dialog | Closed during the upgrade | `errWindowClosed` |
| COMPX | Device waits for a status report too long | `deviceUpgrade.responseTimeout` ("The upgrade device timed out. Reconnect it to resume."), after 30 s (erase) or 120 s (data) |
| COMPX | Report 90 received | `deviceUpgrade.deviceReportedFailure` |
| COMPX | Several matching devices when picking the target | `deviceUpgrade.uniqueTargetNotFound` |
| COMPX | File not for this device | `deviceUpgrade.firmwareMismatch` |
| COMPX nRF54H20 | Interface not found | `deviceUpgrade.nrf54hInterfaceNotFound` |
| COMPX nRF54H20 | Not ready, wrong type, check failed | `upgradeDeviceNotFound`, `upgradeDeviceNotReady`, `deviceTypeMismatch`, `firmwareCheckFailed` |
| Two-device dialog | Bad file version, mismatched major | `mouseFirmwareError`, `receiverFirmwareError`, `firmwareVersionMismatch` |
| Two-device dialog | Receiver or mouse step failed | `upgradeFailSubReceiver`, `upgradeFailSubMouse`, `upgradeErrorOccurred` |
| BitMouse | Parse, connect, enter boot, write, exit | `固件镜像无效或未找到完整的 SHA256 TLV`, `设备未连接或未授权`, `初始化DFU失败`, `分片 n/N 校验失败`, wrapped in `升级失败（步骤：…）：…` |
| Waizowl | Wrong file, no boot device, MCUBoot status | `固件文件无效或不匹配，请检查固件是否正确`, `MCUBoot response timeout (5000ms)`, `... failed: status=0x..` |
| Arbiter, DuckBread | Any step | `固件文件读取失败`, `连接Boot设备失败…`, `固件校验失败…`, `下载固件失败…`, `写入失败`, `升级设备未返回有效回执。` |
| Dual-chip BITYUAN | Merged file bad | One of `too_small`, `bad_magic`, `bad_header_size`, `bad_total_size`, `bad_crc_offset`, `bad_regions`, `region_crc_mismatch`, `crc_mismatch`, shown as a toast |
| Dual-chip BITYUAN | Cannot reach OTA / flash fails / no boot device | `进入Boot模式失败，请拔插后重试`, `固件烧录失败，请检查连接与固件后重试`, `进入Boot模式失败，请检查设备是否正确` |
| Evision wired keyboard | Boot switch rejected / no boot device | `switchBootFailedAck`, `noBootDeviceSelected` |
| Evision dongle | No answer | `receiveTimeout`, `noAckReceived`, `sendPacketFailed` |

The two-device dialog's help text lists "Common Error 1: not connected to device / firmware error", "Error 2: firmware does not match", "Error 3: device not in boot mode" keyed from the result codes `FirmwareError`, `ConnectError`, `EnterBootError`.

## What the code does to avoid bricking, and where it does not

Measures that exist:

| Measure | Applies to |
|---|---|
| Header VID/PID must equal the connected device (or share its `groupName` for BITYUAN) | COMPX, BitMouse (when the header exists), Hechi, DuckBread, BITYUAN, Waizowl when not in recovery |
| Header boot VID/PID must equal the table's | Hechi, DuckBread |
| Firmware length consistency check | COMPX, Hechi, DuckBread, BITYUAN single-chip, dual-chip merged file |
| Checksum or CRC check in the browser | DuckBread (sum), dual-chip merged file (CRC32 on every region and on the whole file), BitMouse (HMAC tag, then MCUboot magic and a SHA-256 TLV must exist) |
| nRF54H20 CRC round trip (length and CRC read back from the device before writing) | COMPX `is54H20` |
| Dual-chip keyboards skip chips whose installed version already matches | BITYUAN dual-chip |
| Receiver flashed before the mouse, with an equal-major-version rule | Two-device dialog, COMPX |
| Exactly one target device required at each discovery step | New dialog |
| Closing, reload and exit are blocked during the write | All |
| Recovery re-runs the whole upgrade instead of resuming | All |
| Online-only firmware (no local file) | Bolutek |

Gaps I found:

| Gap | Where |
|---|---|
| No header and no checksum at all in the browser | Arbiter (raw binary), Evision V2 (only the bootloader checks) |
| `headCRC` and the optional CRC are never verified | COMPX header, Hechi trailer, BITYUAN single-chip trailer |
| A missing acknowledgement is not treated as an error | COMPX data packets, Evision wired keyboard, BITYUAN boot writes (no ack at all), Evision dongle (non-zero ACK status is only logged) |
| A raw MCUboot image has no VID/PID so no model check | BitMouse |
| No model check in recovery | Waizowl recovery |
| Nearlink body is not parsed or decrypted | BitMouse Nearlink |
| No version comparison before flashing, downgrade allowed | All |
| Post-write version is read and displayed but not compared with the file's version | All |
| The browser does not verify the downloaded file against a hash or signature from the server | All |
| The "wired" requirement is text in the dialog only. Nothing reads or blocks wireless or Bluetooth connection modes | Two-device dialog and every other path |
| HFD wire protocol and checks live inside an SDK I did not read | HFD |

## Notes on the other names in the question

- `upgradeVersionMap` is **not** part of the update flow. It sits in the BitMouse controller (`useRemoteConfig`) and maps a mouse's `cid,mid` pair to the minimum installed firmware version that supports a feature (`sensorCenter`, `dynamicSensitivity`, `bhop`), for example `"1,8": {sensorCenter: "3.0.5", dynamicSensitivity: "3.0.5"}`. `isSupportUpgradeFeature(feature)` returns true when the installed version is at least that minimum, and `canUseUpgradeFeature(feature)` falls back to a sensor check when the model has no entry. They gate UI features, not flashing.
- `upgradeTogether` is a per-model flag in the mouse tables. It selects the two-device dialog.
- No class or function with the exact names `startUpgrade`, `enterBootMode`, `connectBootDevice`, `selectBootDevice`, `prepareDownLoad`, `downloadFile`, `verifyFile`, `endTag`, `transferBoot`, `buildMCUBootCommand`, `mcubootFlashEraseRegion`, `mcubootWriteMemory`, `mcubootReset`, `sendFirmwareInChunks`, `parseMergedFirmwareFile`, `parseFirmware`, `getCurrencyBootFilter`, `delayFindBootDevice`, `releaseUpgradeDevice`, `finishUpgrade`, `enterBootloader`, `flashFirmware`, `readFlashData`, `writeFlashData` or `setFlashWriteArea` was missing from the bundle. They are spread over the classes above: Arbiter owns `enterBootMode`, `connectBootDevice`, `prepareDownLoad`, `downloadFile` (progress 15 to 60), `verifyFile` (60 to 95) and `endTag`; DuckBread owns `transferBoot` and `finishUpgrade`; Waizowl owns `buildMCUBootCommand`, `mcubootFlashEraseRegion`, `mcubootWriteMemory`, `mcubootReset`, `enterBootloader`, `flashFirmware`; BitMouse owns `sendFirmwareInChunks` and `releaseUpgradeDevice`; dual-chip BITYUAN owns `parseMergedFirmwareFile`; the single-chip and dual-chip BITYUAN classes use `getCurrencyBootFilter` and `delayCheckDevice` (the latter polls 10 times at 500 ms); TTGK owns `readFlashData`, `writeFlashData`, `setFlashWriteArea`.
- The flow in the question's summary matches the Arbiter class (`enterBootMode`, reconnect through boot filters, `prepareDownLoad`, `downloadFile` 15 to 60, `verifyFile` 60 to 95, `endTag`, reboot). It does not describe the mouse and receiver path, which is COMPX or BitMouse above.

## Not determined

- The bytes of the COMPX `resetToUpdateModeCmd`, `prepareDownLoadCmd` and `dataDownLoadCmd`, since they live in the firmware files. In particular whether the reset command is the `EnterUSBUpgradeMode` (13) request.
- The report IDs and the feature-or-output choice used by COMPX upgrade transfers, same reason.
- Which host serves the firmware files. The URL comes from the API and is not checked in the bundle. Whether any file on that host is encrypted is also unknown, except that the BitMouse path can decrypt a file that carries the `ATKE` marker.
- What the device bootloaders check on their own (signatures, version, model), and how they respond to a wrong image.
- The HFD vendor SDK protocol, and the reply bytes of the "read version" requests used after upgrades (command layouts for `cv`, `Xy`, `Qy`, `Sy`, `My`, `hv`, `gf`, `mv`, `xc`).
- Whether Chrome and Edge keep a device's WebHID permission across the reboot into and out of boot mode. The code is written to ask again where it needs to, and to fall back to a manual picker, which suggests it often does not.
- Per-model detail for every device table entry. The tables are large and use object spreads, so I give counts and examples. The full list is in `demoMode.store` (keyboards, Waizowl, DuckBread, HFD, Arbiter) and `useRemoteConfig` (COMPX, BitMouse mice).
- The HID layouts of the headset families beyond the summary in Path 6.
- Anything about the Electron client: this document covers the web bundle's behaviour when it is not running in Electron, plus the branches the code takes when it is.
