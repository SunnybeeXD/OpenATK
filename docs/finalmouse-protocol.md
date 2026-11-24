# Finalmouse Xpanel protocol notes

The configurator is [fm/index.html](../fm/index.html). It covers the Ultralight X and the Starlight X.

Source: the public Xpanel web app at https://xpanel.finalmouse.com/ (SvelteKit). Build checked on 2026-11-24: `/_app/version.json` reports `1795507215230`, entry `start.CAQRMqmm.js` and `app.Djmw3LY6.js`. When Xpanel ships a new build, compare its command enum (the chunk that lists `CMD_ID_*`) with the table below.

This is an independent implementation of the wire format. **No physical hardware has been tested.**

## Devices

Vendor ID `0x361D`, configuration usage page `0xFF00`.

| Product ID | Device |
|---|---|
| 0x100 | Ultralight X dongle |
| 0x300, 0x301 | Starlight X dongle |
| 0x310, 0x311 | Starlight X, cable |

Xpanel also knows vendor `0x361D` products `0x101`, `0x102`, `0x200`, `0x201` and `0x202`, and vendor `0x1FC9` products `0x21` and `0x22`. Those are bootloader and firmware-update interfaces and are not used here.

## Frame

Output report, 63 bytes: `[2 + n, 0x80 | cmd, n, args...]`. Replies arrive as input reports with the same layout. A request with no arguments reads, a request with arguments writes. Ultralight X reads DPI and polling with commands 3 and 4, and the reply carries that same command.

## Commands used

| Cmd | Name | Payload |
|---:|---|---|
| 5 | VBAT | u16 millivolts |
| 11, 12 | RF and mouse firmware | text |
| 13 | RSSI | i8 |
| 14, 15 | Serial, manufacture date | text |
| 16, 17 | DPI, polling rate | u16 |
| 18 | Motion sync | u8 |
| 20 | Dongle LED mode | u8 |
| 21, 25 | Lift-off preset, custom | u8 |
| 23, 24 | Bhop mode, timeout | u8 |
| 31 | Click mode | modeR, modeL, relR, relL |
| 36, 37, 38 | Link, charging, battery | see page |
| 53, 55 | TMR actuation, MSP | u16 pairs |
| 54 | Dongle LED color | r, g, b |
| 57, 62, 63, 61 | Profiles | below |

## Profiles (Starlight X, newer firmware)

Xpanel stores every mouse setting in the active profile, so switching reloads them. There are at most 5 slots and slot 0 cannot be removed. Firmware without profiles never answers command 57, and the page hides the tab.

| Cmd | Read | Write |
|---:|---|---|
| 57 | reply `active, count` | `[slot]` |
| 63 | reply `active, count, enabledMask` | `[slot, 0 or 1]`, enables or disables a slot |
| 62 | `[slot]`, reply `slot, utf8 name, NUL` | `[slot, utf8 name]`, 31 bytes at most |
| 61 | `[slot]`, reply `slot, mode, brightness, r, g, b` | the same six bytes |

Names and colors are only offered through the dongle, as in Xpanel. A color write reuses the stored mode and brightness, and is refused when the slot has no stored entry. The color is the dongle LED's Custom Color for that profile. A missing enable mask means every slot is on. Hotkey on the mouse: hold left, middle and right, then press forward or back to change profile.

## Known in Xpanel but not used here

LED brightness (26), square test (19), SQUAL (22), TMR calibration and live reports (27 to 30, 60), uptime (32), buttons and cumulative counters (33 to 35), click stats (59), rapid-trigger status (56), dongle pairing (40 to 42), and click mode bytes 4 and 5 (`intR`, `intL`). Pairing and anything that changes firmware are deliberately left out.
