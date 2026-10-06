# Finalmouse Starlight X: TMR click calibration

Read from the code of Finalmouse's web hub (the SLX Calibration page and its shared protocol chunk). Not tried on a real mouse. The page is `fm/index.html`.

Frames are the same as the rest of the SLX protocol: report 1 out, report 2 in, `[2 + n, 0x80 | cmd, n, args...]`.

## Commands

| cmd | Meaning |
| --- | --- |
| 27 | Calibration capture. Args `[channel, action, arg?]`. Channel 0 is the right click, 1 the left. Action 0 start (arg is the number of presses, the hub uses 5), 1 stop, 2 clear, 3 commit, 4 status |
| 28 | Read the stored calibration |
| 29 | Start (u16 milliseconds, repeated every 1.5 s by the hub) or stop (0) a live press stream |
| 30 | Live report: right and left position in micrometres plus valid flags |
| 53 | Actuation `[thrR u16, thrL u16, hystR u16, hystL u16]` |
| 55 | Calibration signal level `[mspR u16, mspL u16]`, 0 means uncalibrated |

Every capture command answers on cmd 27 with `[channel, action, errno]`. Errno 0 is success.

## Status reply (action 4)

`[channel, 4, errno, cycles u16, done, active, 4 buckets]`, each bucket `{count u16, value i16, min i16, max i16}` in the order released, pressed, msp, mrp.

## Flow the hub follows

1. `clear`, then `start` with 5 presses. Errno 11 means the readings were unstable, 16 that a calibration is already running, 22 that the mouse rejected the request.
2. Poll `status` every 200 ms. The cue shown to the user comes from the bucket counts: the click edges are `msp.count + mrp.count`, and a press is in progress when `msp.count > mrp.count`. A steady phase is 8 more readings in the released or pressed bucket.
3. When `done` is set, check the result. No msp or mrp readings, fewer than 8 steady released or pressed readings, or `released.value - pressed.value` under 50 is a failure (clear and retry). Under 100 is saved with a warning that the signal is weak.
4. `commit`. Errno 11 means the presses were not consistent, 22 that the readings were unusable, 34 or 61 that the click point came out of range. On any failure the hub sends `clear`.
5. Read cmd 28 and check the side's valid flag, then re-read cmd 55 and 53.

The hub calibrates the right click first and then the left, and blocks the context menu while it runs. It also posts a calibration log to Finalmouse's server, which `fm/index.html` does not do.

Cmd 28 reply: right `released i16 @0, pressed i16 @2, valid @4`, left `released @5, pressed @7, valid @9`, raw signal levels `msp R @10, mrp R @12, msp L @14, mrp L @16`.
