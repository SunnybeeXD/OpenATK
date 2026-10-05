# OpenATK

A browser-based control panel for ATK gaming mice and keyboards. Plain HTML, no install, no driver, no background service.

Set sensitivity, polling rate, lift-off distance, tracking corrections, click debounce and sleep timeout — from a tab.

> **Not affiliated with ATK.** This is an independent, unofficial tool.
> Settings written here persist in the mouse exactly as if you'd changed them in ATK HUB.

---

## Try it

Use https://sunnybee.lol/openatk, or download the repository and open [`index.html`](index.html).

The start page is the whole app. Press **Connect any ATK device** (or **+ Add device**) to pick several mice and keyboards at once. Each one gets a tab at the top, and you switch between them without leaving the page. Tabs stay loaded, so switching is instant.

| Page | What it is |
|---|---|
| [`index.html`](index.html) | The hub: device tabs and the dashboard. Hosts the two configurators below in-page |
| [`mouse/index.html`](mouse/index.html) | Mouse configurator, also usable on its own (self-contained apart from its fallback image in `assets/`) |
| [`fm/index.html`](fm/index.html) | Finalmouse Ultralight X and Starlight X configurator: DPI, polling, lift-off, motion sync, bhop scroll, indicator light, and the Starlight X analog (TMR) click settings. Read from Xpanel's public code, not yet tried on a real device. Calibration is not included |
| [`rawm/index.html`](rawm/index.html) | RAWM Leviathan V4 GT configurator (wired and 8K dongle): DPI stages with colours and X/Y, polling rate, sensor mode, LOD, motion sync, ripple control, angle snap and tune, sleep, scroll hysteresis, receiver LED, profiles, and the magnetic switch settings (actuation, rapid trigger, magnetic or optical, manual calibration). Read from the RAWM HUB v3 code, not yet tried on a real device. Remapping, macros and firmware updates are not included. Protocol notes in [`docs/rawm-protocol.md`](docs/rawm-protocol.md) |
| [`gwolves/index.html`](gwolves/index.html) | G-Wolves configurator for the `XVI=0` JM models (HTS Plus, HTS Plus Pro, Lycan, HTXU, Fenrir, HTX Mini, WARG), wired and dongle: DPI stages with colours and X/Y, polling rate up to 8K, lift off, motion sync, ripple control, angle snap, competitive mode, sleep, and the HTS Plus Pro magnetic buttons (trigger point, rapid trigger, button calibration with live depth bars). Read from the mouse.fit hub code, not yet tried on a real device. The 24 older `XVI=1` models, remapping, macros and lighting are not included. Protocol notes in [`docs/gwolves-protocol.md`](docs/gwolves-protocol.md) |
| [`keyboard/index.html`](keyboard/index.html) | Keyboard configurator, also usable on its own (untested on hardware) |

**Look and feel:** pick an accent colour (green, cyan, violet, orange or pink) with the dots in the top bar. It applies to every open device tab and is remembered. Press **Ctrl K** (Cmd K on a Mac) anywhere to jump to a device, a demo, Add device or a colour.

**Share settings:** the Device tab of each configurator can save the current settings to a file or a short share code (`OATK1.…`), and load a file or code someone sent you. **Copy share link** gives a link to the hub that carries the settings: opening it asks which of your connected devices to apply them to, then shows the preview in that device's Device tab. A preview lists exactly what will change before anything is written. Shared files are treated as untrusted: every value is range-checked, anything the connected device can't take is skipped, and a mouse can't be left without a left click. Pairing, receiver light, profile slots, firmware, key remaps and advanced keys are never included.

No device handy? Add `?demo=1` to the mouse or keyboard page (or use the *Demo* links on the start page) to try it against a simulated device. A banner says it's a demo, nothing is sent to hardware, nothing is saved, and actions that only make sense on a real device (like factory reset) say so instead of pretending to work. It works in any desktop browser, including ones without WebHID.

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

The app carries a name registry covering **265 product IDs and 221 CID/MID pairs** across both families, so most ATK and VXE mice on these two interfaces should at least connect and identify. Anything on a different vendor interface won't appear in the browser's device picker at all.

Most devices use vendor ID `0x373B`. The first-generation Dragonfly F1 (Pro, Pro Max, MOBA, F1S, Elden and JOJO editions) and first-generation VXE R1 (R1, R1 Pro, R1 Pro Max, R1SE, R1SE+) use `0x3554` and speak COMPX on the same `0xFF04` interface, so they're supported too, along with their 1K and 4K dongles.

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
| Button assignments | mouse buttons, disable, DPI, scroll, profile switch, media keys, keyboard keys and shortcuts, rapid fire, recorded macros (up to 70 steps) |
| Onboard profile | 1 – 4 |
| Receiver light | mode, colour, brightness, speed and sleep, per receiver type (receivers only) |
| Pair a mouse | 30 second pairing window (receivers only) |

The page follows changes made on the mouse itself: pressing its DPI button or switching profile updates the page, and battery refreshes every 30 seconds.

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
- **Extend the protocol doc.** Plenty of commands are mapped but unexposed — dynamic sensitivity curves and virtual centre.

## License

[MIT](LICENSE)
