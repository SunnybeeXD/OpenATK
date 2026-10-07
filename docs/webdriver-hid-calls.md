# WebDriver.exe HID surface

Source: `WebDriverSetup.exe`, an Inno Setup 6.1 installer shipping `WebDriver.exe` (32-bit MFC), `hidapi.dll`, MSVC runtimes and a `register_protocol.bat`. The bat registers a `myapp://` URL handler that launches `WebDriver.exe "%1"`.

`WebDriver.exe` runs a websocketpp server (log string: `WebSocket server started on port 9002`) and relays web page messages to HID devices through hidapi. Everything below comes from static disassembly of the import table and call sites, not from a live capture.

## hidapi imports

`hid_init`, `hid_enumerate`, `hid_open_path`, `hid_free_enumeration`, `hid_set_nonblocking`, `hid_read`, `hid_write`, `hid_send_feature_report`, `hid_get_feature_report`. It also pulls SetupAPI and BluetoothApis for device presence checks.

## Enumeration filters

| Call site | VID | PID |
|---|---|---|
| `0x4098db` | `0x1D57` | `0xFA60` |
| `0x409e0b` | `0x1D57` | `0xFA65` |
| `0x40a34b` | `0x1D57` | `0xFA65` |
| `0x410c78` | `0x1D57` | any |
| `0x4115a8` | `0x1D57` | any |
| `0x411fa5` | `0x045E` | any |

Each match is opened with `hid_open_path` (up to three interfaces per enumeration pass), set non-blocking, then polled with `hid_read` of `0x64` bytes in a worker thread. Interface selection is by path and usage, so the usage page and usage filters still need a live enumeration to confirm.

## Report shapes seen at call sites

| Call | Length | Notes |
|---|---|---|
| `hid_send_feature_report` | `0x40` | buffer starts `09 40`, sent twice with a `0x1F4` ms sleep between sends |
| `hid_write` | `0x41` | zeroed buffer, byte 1 is `0x39` in some paths, big-endian 16-bit byte sum stored at offsets `0x3E` and `0x3F` |
| `hid_write` | `0x0C` | 12-byte command frame, see below |
| `hid_read` | `0x40` | reply to a `0x0C` command, retried in a second call site |
| `hid_get_feature_report` | `0x08` to `0x83` | length is the second byte of the sub-command, one call per sub-command |
| `hid_send_feature_report` | `0x08` | buffer holds `0xA0` at offset 4 |

## 12-byte command frames

Frames are built as a little-endian dword store followed by a byte store, so the wire layout is `04 0C xx yy` then one argument byte:

| dword | bytes | argument byte | following `hid_get_feature_report` length |
|---|---|---|---|
| `0x0CA00C04` | `04 0C A0 0C` | none | `0x0A` |
| `0x0BA00C04` | `04 0C A0 0B` | none | `0x08` |
| `0x0AA00C04` | `04 0C A0 0A` | `0x80` | `0x80` |
| `0x09A00C04` | `04 0C A0 09` | `0x6F` | `0x83` |
| `0x06A00C04` | `04 0C A0 06` | none | `0x09` |
| `0x05A00C04` | `04 0C A0 05` | `0x0F` | `0x0F` |
| `0x04A00C04` | `04 0C A0 04` | `0x38` | `0x38` |
| `0x08A00C04` | `04 0C A0 08` | `0x3B` | `0x3B` |

Pattern: byte 0 `04`, byte 1 `0C` (frame length), byte 2 `A0`, byte 3 is the sub-command, byte 4 is the length to fetch back. Each write is followed by `hid_read` (`0x40`) as an ack and then `hid_get_feature_report` for the payload.

Bytes `0x38` and `0x3B` match the sizes of the two table-style payloads fetched at `0x4137da` and `0x413cfa`.

## Websocket framing into the HID layer

The handler at `0x40cf80` branches on the first byte of the incoming message (`0x80` takes the feature-report path above) and on the byte at message offset 2 (`0x09` selects the two-chunk `0x4009` push, with chunk size selected by offset-3 value `0x6F`). The remaining branches select the `0x41` writes.

## Not covered

- Meaning of each sub-command. Names need a live capture or the device web UI.
- Whether the `0x41` writes use report ID 0 or a real report ID. hidapi sends the first byte as the report ID, so the checksum offsets above are relative to that buffer.
- The `0x045E` branch, which looks like a Microsoft device probe rather than the configured device.
