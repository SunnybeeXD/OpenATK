# OpenATK

A browser-based control panel for ATK gaming mice. One HTML file, no install, no driver, no background service.

Set sensitivity, polling rate, lift-off distance, tracking corrections, click debounce and sleep timeout — from a tab.

> **Not affiliated with ATK.** This is an independent, unofficial tool.
> Settings written here persist in the mouse exactly as if you'd changed them in ATK HUB.

---

## Try it

Download [`index.html`](index.html) and open it. That's the whole app.

or use https://sunnybee.lol/openatk

If `file://` gives you trouble, serve it locally:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

**Chromium only** — Chrome, Edge or Opera. It's built on [WebHID](https://developer.mozilla.org/en-US/docs/Web/API/WebHID_API), which Firefox and Safari don't implement and have no plans to.

**Close ATK HUB first.** Both programs talk to the same HID interface and will race each other.

---

## Supported hardware

Two different vendor protocols ship under the ATK name, and the app speaks both. It picks one automatically from the interface the device exposes.

| Family | Interface | Notes |
|---|---|---|
| BITMOUSE | `0xFF05` / usage 1 | 63-byte output reports |
| COMPX | `0xFF04` / usage 2 | 16-byte EEPROM frames |

Confirmed on hardware:

| Device | PID | Family |
|---|---|---|
| ATK Zero (8K dongle "dongle-L1") | `0x1155` → mouse `0x1154` | BITMOUSE |
| ATK A9 Mini + | `0x1251` | BITMOUSE |
| ATK A9 Mini + | `0x1269`, `0x128E` | COMPX |
| ATK F1 Ultimate 2.0 | `0x11E4` | COMPX |
| ATK F1 EXTREME 2.0 | `0x11E3` | COMPX |
| ATK F1 Ultra Max 2.0 | `0x126E`, `0x11ED` | COMPX |
| ATK X1 Ultra Max 2.0 | `0x1274` / `0x11EC` / `0x12FF` | COMPX |
| ATK F1 V3 LEVIATAN + | `0x129D` | COMPX |

There is a longer list of devices that should work but nobody has reported back on, plus
the details behind each entry, on the **[tested hardware page](tested.html)** — live at
[sunnybee.lol/openatk/tested.html](https://sunnybee.lol/openatk/tested.html).

Note that F1 Ultra Max 2.0 ships under two PIDs with different sensors — `0x126E` is a PAW3950 Ultra, `0x11ED` a PAW3395 Ultra. They use different DPI encodings and different lift-off ranges, and the app picks the right one per device.

The app carries a name registry covering **251 product IDs and 195 CID/MID pairs** across both families, so most ATK and VXE mice on these two interfaces should at least connect and identify. Anything on a different vendor interface won't appear in the browser's device picker at all.

Wireless receivers report a generic product name — "Wireless mouse 8k dongle-L1" and the like — so the app reads the CID/MID pair and resolves the actual paired mouse.

**If your mouse works, please open an issue** with the model and PID so the confirmed table can grow. If it doesn't, open one with the activity log (see below).

---

## What you can change

| Setting | Range |
|---|---|
| Sensitivity | 800 / 1600 / 3200 DPI, written to the active stage |
| Polling rate | 125 – 8000 Hz |
| Lift-off distance | 0.7 – 1.7 mm in 0.1 mm steps, or three fixed steps depending on sensor |
| Movement smoothing | on / off |
| Straight line correction | on / off |
| Ripple correction | on / off |
| Long range mode | on / off |
| Sensor performance | Basic, Competitive, Competitive Max |
| Sensor rotation | on / off, −30° to +30° in 1° steps |
| Click debounce | off, 1, 2, 4, 8, 15, 20 ms |
| Sleep after | 30 s – 30 min |

Reads: battery and charging state, connection type, firmware versions, serial, sensor mode, and the full DPI stage table.

On COMPX devices "Sleep after" now writes both of the two idle timers the firmware
keeps — the LED/device clock and the sensor's own — because writing only the first,
as the app previously did, leaves the sensor scanning past the timeout. That matches
what ATK HUB does from its single sleep control.

Every control writes immediately. If a write fails the control snaps back to its previous position, so what's on screen always reflects what's on the mouse.

**Device info and troubleshooting** at the bottom of the page holds firmware details, a refresh button, factory reset, and a raw activity log of every frame sent and received. That log is the thing to paste into a bug report.

---

## How it works

[`docs/PROTOCOL.md`](docs/PROTOCOL.md) documents both wire formats in full: frame layout, checksum rules, opcode tables, EEPROM addresses, and the DPI and lift-off encodings.

The short version — both families use output report ID 8 with replies arriving as input reports, and they agree on nothing else. BITMOUSE frames are 63 bytes with an additive checksum and a command byte at index 5. COMPX frames are 16 bytes addressing EEPROM directly, with a `85 − sum` checksum that folds in the report ID even though it isn't in the buffer, and where nearly every stored byte is trailed by its own `85 − value` inverse.

---

## Safety

Writes go to the mouse's persistent configuration. That's the same thing ATK HUB does, but a few things are worth knowing:

- **Factory reset is your undo.** It's in Device info.
- The app never touches firmware-update or bootloader commands.
- Read paths degrade rather than throw — a sleeping mouse shows "Asleep" instead of breaking the page.

No telemetry, no network requests, no analytics. The page makes no outbound connections except loading two Google Fonts. Everything else is local.

---

## Where the protocol came from

The wire formats were recovered by reading ATK's own web configurator (`hub.atk.pro`, ATK V HUB Web) — its client-side bundle contains the command tables, EEPROM maps and unit conversions in readable form. Findings were cross-checked against prior community reverse-engineering, principally:

- [cyberphantom52/libatk-rs](https://github.com/cyberphantom52/libatk-rs)
- [666mille/MyATxMouseControl](https://github.com/666mille/MyATxMouseControl)
- [Fan4Metal/ATK_tray](https://github.com/Fan4Metal/ATK_tray)
- [ReformedDoge/0x44oge-ATK](https://github.com/ReformedDoge/0x44oge-ATK)
- [OpenMouse-Project/mouse-protocol](https://github.com/OpenMouse-Project/mouse-protocol) — whose ATK codec independently derives the same lift-off mapping

No vendor code is included in or distributed with this repository.

---

## AI use

**This project was written with AI assistance.** Specifically:

- Claude (Anthropic), driven through [Hyperagent](https://hyperagent.com), did the bulk of the work: analysing ATK's ~16 MB minified web bundle to recover both protocols, writing the application code, and drafting this documentation.
- The direction, hardware, testing and every correctness decision were the maintainer's. Several defects in the AI's first passes — a lift-off encoding taken from the wrong UI component, a sensitivity value read from a field the firmware never populates — were caught by testing against real hardware and fixed.
- Protocol constants are quoted from the vendor bundle rather than inferred, and the frame builders and DPI codecs are covered by round-trip tests, including at the range-switch boundaries.

Treat it as you would any unofficial tool: the protocol details are evidenced and tested, but this is not vendor-validated software. Bug reports welcome.

---

## Contributing

Useful things:

- **Confirm a device.** Open an issue with your model, PID and whether reads and writes behaved.
- **Report a mismatch.** If a setting reads back differently to ATK HUB, the activity log plus what HUB shows is exactly what's needed.
- **Extend the protocol doc.** Plenty of commands are mapped but unexposed — button remapping, macros, RGB, dynamic sensitivity curves, virtual centre, BHOP.

## License

[MIT](LICENSE)
