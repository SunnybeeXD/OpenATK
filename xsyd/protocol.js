(function (root) {
  "use strict";

  const FILTERS = [{ usagePage: 0xFFB0, usage: 1 }, { usagePage: 0xFF80, usage: 1 }];
  const isMatch = c => FILTERS.some(f => f.usagePage === c.usagePage && f.usage === c.usage);
  const hasCollection = d => ((d && d.collections) || []).some(isMatch);
  function pickCommand(list) {
    const found = list.filter(hasCollection);
    const out = found.find(d => d.collections.some(c => isMatch(c) && (c.outputReports || []).length));
    return out || found[0] || null;
  }

  const CAT = { Device: 1, Global: 2, Layout: 3, Perf: 4, ThreeMode: 13 };
  const RATES = { 0: "8 kHz", 1: "4 kHz", 2: "2 kHz", 3: "1 kHz", 4: "500 Hz", 5: "250 Hz", 6: "125 Hz" };
  const LAYERS = 4;
  const ROWS = 6;
  const COLS = 21;
  const CONNECTIONS = ["USB", "2.4G", "Bluetooth 1", "Bluetooth 2", "Bluetooth 3"];
  const MODES = ["Fixed point", "Rapid trigger", "Rapid trigger, interval"];
  const SIZES = { 0: [0, 0], 1: [1, 1], 2: [1.25, 1], 3: [1.5, 1], 4: [1.75, 1], 5: [2, 1], 6: [2.25, 1], 7: [2.5, 1], 8: [2.75, 1], 9: [6.25, 1], 10: [1, 2], 11: [1.5, 2], 12: [1, 1], 13: [2, 1], 14: [1.75, 1], 15: [2, 1.75] };

  class ReplyError extends Error {
    constructor(message, reply) {
      super(message);
      this.name = "ReplyError";
      this.reply = reply || null;
    }
  }

  const hex2 = n => n.toString(16).padStart(2, "0");
  const hex4 = n => "0x" + n.toString(16).toUpperCase().padStart(4, "0");
  const u16 = (r, i) => r[i] | (r[i + 1] << 8);
  const put16 = v => [v & 255, (v >> 8) & 255];

  function frame(bytes) {
    if (!Array.isArray(bytes) || bytes.length < 2 || bytes.length > 64 || bytes.some(b => !Number.isInteger(b) || b < 0 || b > 255)) throw new Error("Bad frame");
    const f = new Uint8Array(64);
    f.set(bytes);
    return f;
  }

  function int(v, min, max, name) {
    if (!Number.isInteger(v) || v < min || v > max) throw new Error(`${name} must be a whole number from ${min} to ${max}`);
    return v;
  }

  const say = (what, got, want) => new ReplyError(`${what}: device said ${got}, expected ${want}`);

  const req = {
    protocol: () => ({
      b: [1, 1], need: 6,
      parse: r => ({ main: r[2], sub: r[3], hardware: r[4], software: r[5] }),
    }),
    info: () => ({
      b: [1, 2], need: 41,
      parse: r => ({
        type: r[2], subtype: r[3],
        boardId: ((r[4] << 24) | (r[5] << 16) | (r[6] << 8) | r[7]) >>> 0,
        app: Array.from(r.slice(8, 12)).join("."),
        pcb: Array.from(r.slice(12, 16)).join("-"),
        runMode: r[16],
        serial: Array.from(r.slice(17, 29)).map(hex2).join("").toUpperCase(),
        build: new TextDecoder("utf-8").decode(Uint8Array.from(Array.from(r.slice(29, 41)).filter(x => x !== 0))),
      }),
    }),
    features: () => ({
      b: [1, 3], need: 6,
      parse: r => ({
        switches: { mechanical: !!(r[2] & 1), magnetic: !!(r[2] & 2), optical: !!(r[2] & 4), inductive: !!(r[2] & 8), magnetic3D: !!(r[2] & 16) },
        connections: { usb: !!(r[3] & 1), g24: !!(r[3] & 2), ble: !!(r[3] & 4), usb3: !!(r[3] & 8) },
        basic: { rgb: !!(r[4] & 1), knob: !!(r[4] & 2) },
        extended: { smallScreen: !!(r[5] & 1), fullScreen: !!(r[5] & 2), haptic: !!(r[5] & 4), voicePlayback: !!(r[5] & 8), voiceRecognition: !!(r[5] & 16), gamepad: !!(r[5] & 32), dotMatrix: !!(r[5] & 64) },
      }),
    }),
    rateList: () => ({
      b: [2, 5, 0], need: 4,
      parse: r => {
        const n = r[3];
        if (n > 16 || 4 + n > r.length) throw new ReplyError(`Rate list claims ${n} entries`, r);
        return Array.from(r.slice(4, 4 + n)).filter(v => v in RATES);
      },
    }),
    rateGet: () => ({
      b: [2, 5, 1], need: 4,
      parse: r => {
        if (!(r[3] in RATES)) throw new ReplyError(`Unknown report rate code ${r[3]}`, r);
        return r[3];
      },
    }),
    rateSet: v => {
      int(v, 0, 6, "Report rate");
      return {
        b: [2, 5, 2, v], need: 4, write: true,
        parse: r => {
          if (r[3] !== v) throw say("Report rate", r[3], v);
          return r[3];
        },
      };
    },
    systemGet: () => ({
      b: [2, 4, 1], need: 4,
      parse: r => {
        if (r[3] > 1) throw new ReplyError(`Unknown system code ${r[3]}`, r);
        return r[3];
      },
    }),
    systemSet: v => {
      int(v, 0, 1, "System");
      return {
        b: [2, 4, 2, v], need: 4, write: true,
        parse: r => {
          if (r[3] !== v) throw say("System", r[3], v);
          return r[3];
        },
      };
    },
    configCount: () => ({
      b: [2, 3, 0], need: 4,
      parse: r => {
        if (r[3] < 1 || r[3] > 10) throw new ReplyError(`Config count ${r[3]} is out of range`, r);
        return r[3];
      },
    }),
    configGet: () => ({ b: [2, 3, 1], need: 4, parse: r => r[3] }),
    configSet: i => {
      int(i, 0, 9, "Config slot");
      return {
        b: [2, 3, 2, i], need: 4, write: true,
        parse: r => {
          if (r[3] !== i) throw say("Config slot", r[3], i);
          return r[3];
        },
      };
    },
    configName: i => {
      int(i, 0, 9, "Config slot");
      return {
        b: [2, 3, 3, i], need: 36,
        parse: r => new TextDecoder("utf-8").decode(Uint8Array.from(Array.from(r.slice(4, 36)).filter(x => x !== 0))),
      };
    },
    configRename: (i, text) => {
      int(i, 0, 9, "Config slot");
      const bytes = Array.from(new TextEncoder().encode(String(text)));
      if (!bytes.length) throw new Error("The name cannot be empty");
      if (bytes.length > 32) throw new Error("The name is longer than 32 bytes");
      if (bytes.some(b => b < 32 || b === 127)) throw new Error("The name has control characters");
      return { b: [2, 3, 4, i, ...bytes], need: 2, write: true, parse: r => r };
    },
    rtPrecision: () => ({
      b: [2, 12, 0], need: 4,
      parse: r => (r[3] ? r[3] / 1000 : null),
    }),
    layoutStyle: row => {
      int(row, 0, ROWS - 1, "Row");
      return {
        b: [3, 5, row], need: 45,
        parse: r => Array.from({ length: COLS }, (_, a) => {
          const o = r[3 + 2 * a] | (r[4 + 2 * a] << 8);
          return { row: ((o >> 11) & 31) / 4, col: ((o >> 4) & 127) / 4, ratio: o & 15 };
        }),
      };
    },
    layoutRow: (layer, row) => {
      int(layer, 0, LAYERS - 1, "Layer");
      int(row, 0, ROWS - 1, "Row");
      return {
        b: [3, 1, layer, row], need: 4 + 2 * COLS,
        parse: r => {
          if (r[2] !== layer || r[3] !== row) throw say("Layout row", `${r[2]}/${r[3]}`, `${layer}/${row}`);
          return Array.from({ length: COLS }, (_, i) => u16(r, 4 + 2 * i));
        },
      };
    },
    defaultRow: (system, fn, row) => {
      int(system, 0, 1, "System");
      int(fn, 0, LAYERS - 1, "Layer");
      int(row, 0, ROWS - 1, "Row");
      const tag = (system << 4) | fn;
      return {
        b: [3, 6, tag, row], need: 4 + 2 * COLS,
        parse: r => {
          if (r[2] !== tag || r[3] !== row) throw say("Default row", `${r[2]}/${r[3]}`, `${tag}/${row}`);
          return Array.from({ length: COLS }, (_, i) => u16(r, 4 + 2 * i));
        },
      };
    },
    keyGet: (layer, row, col) => {
      int(layer, 0, LAYERS - 1, "Layer");
      int(row, 0, ROWS - 1, "Row");
      int(col, 0, COLS - 1, "Column");
      return {
        b: [3, 3, layer, row, col], need: 7,
        parse: r => {
          if (r[2] !== layer || r[3] !== row || r[4] !== col) throw say("Key", `${r[2]}/${r[3]}/${r[4]}`, `${layer}/${row}/${col}`);
          return u16(r, 5);
        },
      };
    },
    keySet: (layer, row, col, code) => {
      int(layer, 0, LAYERS - 1, "Layer");
      int(row, 0, ROWS - 1, "Row");
      int(col, 0, COLS - 1, "Column");
      int(code, 0, 0xFFFF, "Key code");
      return {
        b: [3, 4, layer, row, col, ...put16(code)], need: 7, write: true,
        parse: r => {
          if (r[2] !== layer || r[3] !== row || r[4] !== col) throw say("Key", `${r[2]}/${r[3]}/${r[4]}`, `${layer}/${row}/${col}`);
          if (u16(r, 5) !== code) throw say("Key code", hex4(u16(r, 5)), hex4(code));
          return code;
        },
      };
    },
    perfGet: (row, col) => {
      int(row, 0, ROWS - 1, "Row");
      int(col, 0, COLS - 1, "Column");
      return { b: [4, 1, row, col], need: 27, parse: parsePerf };
    },
    perfSet: (row, col, p) => {
      int(row, 0, ROWS - 1, "Row");
      int(col, 0, COLS - 1, "Column");
      int(p.mode, 0, 2, "Mode");
      const t = ["normalPress", "normalRelease", "rtFirstTouch", "rtPress", "rtRelease", "pressDead", "releaseDead"];
      for (const k of t) int(p[k], 0, 0xFFFF, k);
      int(p.axis, 0, 255, "axis");
      int(p.axisV2Id, 0, 0xFFFF, "axisV2Id");
      int(p.axisRangeMax, 0, 0xFFFF, "axisRangeMax");
      int(p.axisCoefficient, 0, 0xFFFF, "axisCoefficient");
      return {
        b: [4, 2, row, col, p.mode, ...t.flatMap(k => put16(p[k])), p.axis, 0, ...put16(p.axisV2Id), ...put16(p.axisRangeMax), ...put16(p.axisCoefficient)],
        need: 27, write: true,
        parse: r => {
          const got = parsePerf(r);
          for (const k of ["mode", ...t]) if (got[k] !== p[k]) throw say(`Key ${row}/${col} ${k}`, got[k], p[k]);
          return got;
        },
      };
    },
    power: () => ({
      b: [13, 1], need: 5,
      parse: r => {
        if (r[2] >= CONNECTIONS.length) throw new ReplyError(`Unknown connection mode ${r[2]}`, r);
        return { mode: r[2], charging: r[3] !== 0, battery: r[4] <= 100 ? r[4] : null };
      },
    }),
  };

  function parsePerf(r) {
    if (r[4] > 2) throw new ReplyError(`Unknown trigger mode ${r[4]}`, r);
    return {
      mode: r[4], normalPress: u16(r, 5), normalRelease: u16(r, 7), rtFirstTouch: u16(r, 9), rtPress: u16(r, 11), rtRelease: u16(r, 13),
      pressDead: u16(r, 15), releaseDead: u16(r, 17), axis: r[19], calibrate: r[20], axisV2Id: u16(r, 21), axisRangeMax: u16(r, 23), axisCoefficient: u16(r, 25),
    };
  }

  const HID = {};
  "A B C D E F G H I J K L M N O P Q R S T U V W X Y Z".split(" ").forEach((c, i) => { HID[4 + i] = c; });
  "1 2 3 4 5 6 7 8 9 0".split(" ").forEach((c, i) => { HID[30 + i] = c; });
  Object.assign(HID, { 40: "Enter", 41: "Esc", 42: "Backspace", 43: "Tab", 44: "Space", 45: "-", 46: "=", 47: "[", 48: "]", 49: "\\", 50: "Non-US #", 51: ";", 52: "'", 53: "`", 54: ",", 55: ".", 56: "/", 57: "Caps Lock" });
  for (let i = 0; i < 12; i++) HID[58 + i] = "F" + (i + 1);
  Object.assign(HID, { 70: "Print Screen", 71: "Scroll Lock", 72: "Pause", 73: "Insert", 74: "Home", 75: "Page Up", 76: "Delete", 77: "End", 78: "Page Down", 79: "Right", 80: "Left", 81: "Down", 82: "Up", 83: "Num Lock", 84: "Pad /", 85: "Pad *", 86: "Pad -", 87: "Pad +", 88: "Pad Enter" });
  for (let i = 0; i < 9; i++) HID[89 + i] = "Pad " + (i + 1);
  Object.assign(HID, { 98: "Pad 0", 99: "Pad .", 100: "Non-US \\", 101: "Menu", 102: "Power", 103: "Pad =" });
  for (let i = 0; i < 12; i++) HID[104 + i] = "F" + (13 + i);
  Object.assign(HID, { 224: "Left Ctrl", 225: "Left Shift", 226: "Left Alt", 227: "Left Win", 228: "Right Ctrl", 229: "Right Shift", 230: "Right Alt", 231: "Right Win" });

  const MEDIA = { 0x206F: "Brightness up", 0x2070: "Brightness down", 0x20B5: "Next track", 0x20B6: "Previous track", 0x20B7: "Stop", 0x20CD: "Play or pause", 0x20E2: "Mute", 0x20E9: "Volume up", 0x20EA: "Volume down", 0x2183: "Music player", 0x218A: "Mail", 0x2192: "Calculator", 0x2194: "My computer", 0x2223: "Browser" };
  const MOUSE = { 0x4000: "Mouse release", 0x4100: "Mouse left", 0x4200: "Mouse right", 0x4300: "Mouse middle", 0x4400: "Mouse forward", 0x4500: "Mouse back", 0x4600: "Mouse move left", 0x4700: "Mouse move right", 0x4800: "Mouse move up", 0x4900: "Mouse move down", 0x4A01: "Wheel forward", 0x4B01: "Wheel back" };
  const FN = { 0xF100: "Fn0", 0xF101: "Fn1", 0xF102: "Fn2", 0xF103: "Fn3" };
  const CONTROL = { 0xF200: "Factory reset", 0xF201: "Windows layout", 0xF202: "Mac layout", 0xF203: "Calibrate", 0xF205: "Config 1", 0xF206: "Config 2", 0xF207: "Config 3", 0xF208: "Config 4", 0xF209: "Lock Win key", 0xF20A: "Link", 0xF20C: "FnNum" };
  const MODS = [["Ctrl", 1], ["Shift", 2], ["Alt", 4], ["Win", 8]];

  function classify(code) {
    if (code === 0 || code === 1) return "special";
    if (code in HID) return "key";
    if (code > 0x1000 && code < 0x2000) return "combo";
    if (code in MEDIA) return "media";
    if (code in MOUSE) return "mouse";
    if (code in FN) return "fn";
    if (code >= 0xF200 && code < 0xF300) return "control";
    if (code >= 0xF300 && code < 0xF400) return "light";
    if (code >= 0xF400 && code < 0xF500) return "wireless";
    if (code >= 0xF500 && code < 0xF600) return "macro";
    return "other";
  }

  function comboParts(code) {
    const m = (code >> 8) & 15;
    return { mods: MODS.filter(x => m & x[1]).map(x => x[0]), key: code & 255 };
  }

  function makeCombo(mods, key) {
    int(key, 4, 231, "Key");
    const bits = MODS.reduce((n, x) => n | (mods.includes(x[0]) ? x[1] : 0), 0);
    if (!bits) throw new Error("Pick at least one modifier");
    return 0x1000 | (bits << 8) | key;
  }

  function describe(code) {
    switch (classify(code)) {
      case "special": return code === 0 ? "None" : "Pass-through";
      case "key": return HID[code];
      case "combo": {
        const p = comboParts(code);
        return p.mods.length && p.key in HID ? `${p.mods.join("+")}+${HID[p.key]}` : `Combo ${hex4(code)}`;
      }
      case "media": return MEDIA[code];
      case "mouse": return MOUSE[code];
      case "fn": return FN[code];
      case "control": return CONTROL[code] || `Control ${hex4(code)}`;
      case "light": return `Lighting ${hex4(code)}`;
      case "wireless": return `Wireless ${hex4(code)}`;
      case "macro": return `Macro ${code - 0xF500}`;
      default: return hex4(code);
    }
  }

  const WRITABLE = ["special", "key", "combo", "media", "mouse"];
  function canAssign(code) {
    if (!Number.isInteger(code) || code < 0 || code > 0xFFFF) return false;
    const c = classify(code);
    if (c === "combo") {
      const p = comboParts(code);
      return p.mods.length > 0 && p.key in HID;
    }
    return WRITABLE.includes(c);
  }

  const keys = {
    HID, MEDIA, MOUSE, MODS, classify, describe, comboParts, makeCombo, canAssign, hex4,
    groups: {
      Letters: Object.keys(HID).map(Number).filter(c => c >= 4 && c <= 29),
      Numbers: Object.keys(HID).map(Number).filter(c => c >= 30 && c <= 39),
      Punctuation: [40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57],
      Function: Object.keys(HID).map(Number).filter(c => (c >= 58 && c <= 69) || (c >= 104 && c <= 115)),
      Navigation: [70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 101, 102],
      Keypad: [83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 103],
      Modifiers: [224, 225, 226, 227, 228, 229, 230, 231],
      Media: Object.keys(MEDIA).map(Number),
      Mouse: Object.keys(MOUSE).map(Number),
      Other: [0, 1],
    },
  };

  class Driver {
    constructor(device, opts = {}) {
      this.dev = device;
      this.timeout = opts.timeout || 1500;
      this.onLog = opts.onLog || (() => {});
      this.writes = false;
      this.closed = false;
      this.queue = [];
      this.waiter = null;
      this.chain = Promise.resolve();
      this.sentCount = 0;
      this.onReport = e => {
        const r = new Uint8Array(e.data.buffer, e.data.byteOffset, e.data.byteLength).slice();
        this.onLog("rx", r);
        if (this.waiter) {
          const w = this.waiter;
          this.waiter = null;
          clearTimeout(w.timer);
          w.resolve(r);
        } else if (this.queue.length < 16) this.queue.push(r);
      };
    }

    async open() {
      if (!this.dev.opened) await this.dev.open();
      this.dev.addEventListener("inputreport", this.onReport);
    }

    async close() {
      this.closed = true;
      this.dev.removeEventListener("inputreport", this.onReport);
      if (this.waiter) {
        const w = this.waiter;
        this.waiter = null;
        clearTimeout(w.timer);
        w.reject(new Error("Device closed"));
      }
      if (this.dev.opened) await this.dev.close();
    }

    next() {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.waiter = null;
          reject(new Error("No reply from the keyboard"));
        }, this.timeout);
        this.waiter = { resolve, reject, timer };
      });
    }

    run(q) {
      const go = async () => {
        if (this.closed) throw new Error("Device closed");
        if (q.write && !this.writes) throw new Error("Changes are turned off");
        const f = frame(q.b);
        if (this.queue.length) {
          this.onLog("er", Uint8Array.from([]), `dropped ${this.queue.length} stale report(s)`);
          this.queue = [];
        }
        this.onLog("tx", f);
        this.sentCount++;
        const wait = this.next();
        try {
          await this.dev.sendReport(0, f);
        } catch (e) {
          if (this.waiter) {
            clearTimeout(this.waiter.timer);
            this.waiter = null;
          }
          wait.catch(() => {});
          throw e;
        }
        const r = await wait;
        if (r.length < q.need) throw new ReplyError(`Reply is ${r.length} bytes, expected at least ${q.need}`, r);
        if (r[0] !== q.b[0] || r[1] !== q.b[1]) throw new ReplyError(`Reply ${hex2(r[0])} ${hex2(r[1])} does not match request ${hex2(q.b[0])} ${hex2(q.b[1])}`, r);
        return q.parse(r);
      };
      const p = this.chain.then(go);
      this.chain = p.catch(() => {});
      return p;
    }
  }

  const demoRows = [
    [41, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 76],
    [53, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 45, 46, 42, 75],
    [43, 20, 26, 8, 21, 23, 28, 24, 12, 18, 19, 47, 48, 49, 78],
    [57, 4, 22, 7, 9, 10, 11, 13, 14, 15, 51, 52, 40, 74],
    [225, 29, 27, 6, 25, 5, 17, 16, 54, 55, 56, 229, 82, 77],
    [224, 227, 226, 44, 230, 0xF101, 228, 80, 81, 79],
  ];
  const demoRatios = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 1],
    [3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1],
    [4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 6, 1],
    [6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4, 1, 1],
    [2, 2, 2, 9, 1, 1, 1, 1, 1, 1],
  ];

  class DemoDevice {
    constructor(opts = {}) {
      this.vendorId = 0;
      this.productId = 0;
      this.productName = "Simulated XSYD keyboard";
      this.collections = [{ usagePage: 0xFFB0, usage: 1, inputReports: [{ reportId: 0 }], outputReports: [{ reportId: 0 }], featureReports: [] }];
      this.opened = false;
      this.listeners = new Set();
      this.sent = [];
      this.delay = opts.delay === undefined ? 0 : opts.delay;
      this.fault = opts.fault || null;
      this.rates = [0, 1, 3, 4, 5, 6];
      this.rate = 3;
      this.system = 0;
      this.cfg = 0;
      this.names = ["Default", "FPS", "Typing", "Game"];
      this.battery = 76;
      this.codes = [0, 1, 2, 3].map(l => demoRows.map(row => Array.from({ length: COLS }, (_, i) => (l === 0 ? row[i] || 0 : row[i] ? 1 : 0))));
      this.perf = new Map();
    }

    addEventListener(t, f) { if (t === "inputreport") this.listeners.add(f); }
    removeEventListener(t, f) { this.listeners.delete(f); }
    async open() { this.opened = true; }
    async close() { this.opened = false; }

    async sendReport(id, data) {
      if (!this.opened) throw new Error("The device is closed");
      if (id !== 0 || data.length !== 64) throw new Error("Bad report");
      const q = Uint8Array.from(data);
      this.sent.push(q);
      let r = this.respond(q);
      if (this.fault) r = this.fault(q, r);
      if (r) setTimeout(() => {
        const ev = { reportId: 0, data: new DataView(r.buffer) };
        for (const f of [...this.listeners]) f(ev);
      }, this.delay);
    }

    key(row, col) {
      const id = row * COLS + col;
      if (!this.perf.has(id)) this.perf.set(id, { mode: 0, normalPress: 1500, normalRelease: 1500, rtFirstTouch: 1200, rtPress: 300, rtRelease: 300, pressDead: 100, releaseDead: 100, axis: 2, calibrate: 0, axisV2Id: 0x0102, axisRangeMax: 3400, axisCoefficient: 1000 });
      return this.perf.get(id);
    }

    respond(q) {
      const r = new Uint8Array(64);
      r[0] = q[0];
      r[1] = q[1];
      const k = q[0] * 256 + q[1];
      if (k === 0x0101) r.set([1, 2, 3, 4], 2);
      else if (k === 0x0102) {
        r.set([1, 2, 0x1A, 0x2B, 0x3C, 0x4D, 1, 2, 3, 4, 1, 0, 0, 2, 1], 2);
        r.set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 17);
        r.set(new TextEncoder().encode("202501011200"), 29);
      } else if (k === 0x0103) r.set([2, 7, 1, 0], 2);
      else if (k === 0x0205) {
        if (q[2] === 0) { r[3] = this.rates.length; r.set(this.rates, 4); }
        else {
          if (q[2] === 2 && this.rates.includes(q[3])) this.rate = q[3];
          r[3] = this.rate;
        }
      } else if (k === 0x0204) {
        if (q[2] === 2 && q[3] < 2) this.system = q[3];
        r[3] = this.system;
      } else if (k === 0x0203) {
        if (q[2] === 0) r[3] = this.names.length;
        else if (q[2] === 1) r[3] = this.cfg;
        else if (q[2] === 2 && q[3] < this.names.length) { this.cfg = q[3]; r[3] = this.cfg; }
        else if (q[2] === 3) r.set(new TextEncoder().encode(this.names[q[3]] || ""), 4);
        else if (q[2] === 4) {
          const n = Array.from(q.slice(4)).findIndex(x => x === 0);
          this.names[q[3]] = new TextDecoder().decode(q.slice(4, n < 0 ? 64 : 4 + n)).slice(0, 32);
        }
      } else if (k === 0x020C) r[3] = 10;
      else if (k === 0x0305) {
        demoRows[q[2]].forEach((_, i) => {
          let x = 0;
          for (let j = 0; j < i; j++) x += SIZES[demoRatios[q[2]][j]][0];
          const o = ((q[2] * 4) << 11) | ((x * 4) << 4) | demoRatios[q[2]][i];
          r[3 + 2 * i] = o & 255;
          r[4 + 2 * i] = o >> 8;
        });
      } else if (k === 0x0301) {
        r[2] = q[2];
        r[3] = q[3];
        this.codes[q[2]][q[3]].forEach((c, i) => r.set(put16(c), 4 + 2 * i));
      } else if (k === 0x0306) {
        r[2] = q[2];
        r[3] = q[3];
        const l = q[2] & 15;
        demoRows[q[3]].forEach((c, i) => r.set(put16(l === 0 ? c : 1), 4 + 2 * i));
      } else if (k === 0x0303) {
        r.set([q[2], q[3], q[4]], 2);
        r.set(put16(this.codes[q[2]][q[3]][q[4]]), 5);
      } else if (k === 0x0304) {
        this.codes[q[2]][q[3]][q[4]] = u16(q, 5);
        r.set([q[2], q[3], q[4]], 2);
        r.set(q.slice(5, 7), 5);
      } else if (k === 0x0401 || k === 0x0402) {
        const p = this.key(q[2], q[3]);
        if (k === 0x0402) {
          p.mode = q[4];
          ["normalPress", "normalRelease", "rtFirstTouch", "rtPress", "rtRelease", "pressDead", "releaseDead"].forEach((n, i) => { p[n] = u16(q, 5 + 2 * i); });
          p.axis = q[19];
          p.axisV2Id = u16(q, 21);
          p.axisRangeMax = u16(q, 23);
          p.axisCoefficient = u16(q, 25);
        }
        r.set([q[2], q[3], p.mode], 2);
        [p.normalPress, p.normalRelease, p.rtFirstTouch, p.rtPress, p.rtRelease, p.pressDead, p.releaseDead].forEach((v, i) => r.set(put16(v), 5 + 2 * i));
        r[19] = p.axis;
        r[20] = p.calibrate;
        r.set([...put16(p.axisV2Id), ...put16(p.axisRangeMax), ...put16(p.axisCoefficient)], 21);
      } else if (k === 0x0D01) r.set([1, 0, this.battery], 2);
      else return null;
      return r;
    }
  }

  root.XSYD = { FILTERS, hasCollection, pickCommand, CAT, RATES, LAYERS, ROWS, COLS, CONNECTIONS, MODES, SIZES, ReplyError, frame, req, keys, Driver, DemoDevice };
})(typeof globalThis !== "undefined" ? globalThis : window);
