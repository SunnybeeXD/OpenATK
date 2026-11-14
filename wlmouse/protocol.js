/* WLmouse 64-byte feature protocol, independently implemented from the public web hub.
 * No bootloader, firmware, or display commands are included. Hardware untested. */
(function (root) {
  "use strict";
  const models = [
    {"name":"HUAN","vendorId":13991,"wired":43108,"wireless":null,"receiver":43107,"newProtocol":true,"dpiMax":30000,"dpiStep":50,"dpiStages":6,"lod":[0.7,1.0,2.0],"pollingWired":[125,250,500,1000,2000,4000,8000],"pollingWireless":[125,250,500,1000,2000,4000,8000],"xy":true,"angleTune":true,"hyper":true,"sleep":true},
    {"name":"HUAN M","vendorId":13991,"wired":43097,"wireless":null,"receiver":43107,"newProtocol":true,"dpiMax":50000,"dpiStep":1,"dpiStages":6,"lod":[0.7,1.0,2.0],"pollingWired":[125,250,500,1000,2000,4000,8000],"pollingWireless":[125,250,500,1000,2000,4000,8000],"xy":true,"angleTune":true,"hyper":true,"sleep":true},
    {"name":"BEAST MIAO","vendorId":13991,"wired":43111,"wireless":43138,"receiver":43110,"newProtocol":true,"dpiMax":30000,"dpiStep":50,"dpiStages":6,"lod":[0.7,1.0,2.0],"pollingWired":[125,250,500,1000],"pollingWireless":[125,250,500,1000,2000,4000,8000],"xy":true,"angleTune":true,"hyper":true,"sleep":true},
    {"name":"STRIDER","vendorId":13991,"wired":43123,"wireless":43138,"receiver":43122,"newProtocol":true,"dpiMax":30000,"dpiStep":50,"dpiStages":6,"lod":[0.7,1.0,2.0],"pollingWired":[125,250,500,1000],"pollingWireless":[125,250,500,1000,2000,4000,8000],"xy":true,"angleTune":true,"hyper":true,"sleep":true},
    {"name":"YING","vendorId":13991,"wired":43125,"wireless":43138,"receiver":43124,"newProtocol":true,"dpiMax":30000,"dpiStep":50,"dpiStages":6,"lod":[0.7,1.0,2.0],"pollingWired":[125,250,500,1000],"pollingWireless":[125,250,500,1000,2000,4000,8000],"xy":true,"angleTune":true,"hyper":true,"sleep":true},
    {"name":"SWORD X","vendorId":13991,"wired":43129,"wireless":43138,"receiver":43128,"newProtocol":true,"dpiMax":30000,"dpiStep":50,"dpiStages":6,"lod":[0.7,1.0,2.0],"pollingWired":[125,250,500,1000],"pollingWireless":[125,250,500,1000,2000,4000,8000],"xy":true,"angleTune":true,"hyper":true,"sleep":true},
    {"name":"BEAST MINI","vendorId":13991,"wired":43142,"wireless":43138,"receiver":43141,"newProtocol":true,"dpiMax":26000,"dpiStep":50,"dpiStages":6,"lod":[1.0,2.0],"pollingWired":[125,250,500,1000],"pollingWireless":[125,250,500,1000,2000,4000,8000],"xy":true,"angleTune":true,"hyper":true,"sleep":true},
    {"name":"BEAST MINI PRO","vendorId":13991,"wired":43113,"wireless":43138,"receiver":43112,"newProtocol":true,"dpiMax":30000,"dpiStep":50,"dpiStages":6,"lod":[0.7,1.0,2.0],"pollingWired":[125,250,500,1000],"pollingWireless":[125,250,500,1000,2000,4000,8000],"xy":true,"angleTune":true,"hyper":true,"sleep":true},
    {"name":"BEAST MAX","vendorId":13991,"wired":43137,"wireless":43138,"receiver":43136,"newProtocol":true,"dpiMax":30000,"dpiStep":50,"dpiStages":6,"lod":[0.7,1.0,2.0],"pollingWired":[125,250,500,1000],"pollingWireless":[125,250,500,1000,2000,4000,8000],"xy":true,"angleTune":true,"hyper":true,"sleep":true},
    {"name":"BEAST X","vendorId":13991,"wired":43140,"wireless":43138,"receiver":43139,"newProtocol":true,"dpiMax":26000,"dpiStep":50,"dpiStages":6,"lod":[1.0,2.0],"pollingWired":[125,250,500,1000],"pollingWireless":[125,250,500,1000,2000,4000,8000],"xy":true,"angleTune":true,"hyper":true,"sleep":true},
    {"name":"BEAST X PRO","vendorId":13991,"wired":43121,"wireless":43138,"receiver":43120,"newProtocol":true,"dpiMax":30000,"dpiStep":50,"dpiStages":6,"lod":[0.7,1.0,2.0],"pollingWired":[125,250,500,1000],"pollingWireless":[125,250,500,1000,2000,4000,8000],"xy":true,"angleTune":true,"hyper":true,"sleep":true},
    {"name":"BEAST G","vendorId":13991,"wired":43105,"wireless":43138,"receiver":43104,"newProtocol":true,"dpiMax":30000,"dpiStep":50,"dpiStages":6,"lod":[0.7,1.0,2.0],"pollingWired":[125,250,500,1000,2000,4000,8000],"pollingWireless":[125,250,500,1000,2000,4000,8000],"xy":true,"angleTune":true,"hyper":true,"sleep":true},
    {"name":"BEAST X V2","vendorId":13991,"wired":43095,"wireless":null,"receiver":43094,"newProtocol":true,"dpiMax":50000,"dpiStep":1,"dpiStages":6,"lod":[0.7,1.0,2.0],"pollingWired":[125,250,500,1000,2000,4000,8000],"pollingWireless":[125,250,500,1000,2000,4000,8000],"xy":true,"angleTune":true,"hyper":true,"sleep":true}
  ];
  const filters = [
    ...new Set(
      models.flatMap((m) => [m.wired, m.wireless, m.receiver]).filter(Boolean),
    ),
  ].map((productId) => ({ vendorId: 0x36a7, productId }));
  function modelsForDevice(d) {
    return models.filter(
      (m) =>
        d.vendorId === m.vendorId &&
        [m.wired, m.wireless, m.receiver].includes(d.productId),
    );
  }
  function featureSizes(d) {
    const sizes = [];
    function walk(c) {
      for (const r of c.featureReports || [])
        if (r.reportId === 0)
          sizes.push(
            (r.items || []).reduce(
              (n, i) => n + (i.reportSize || 0) * (i.reportCount || 0),
              0,
            ) / 8,
          );
      for (const child of c.children || []) walk(child);
    }
    for (const c of d.collections || []) walk(c);
    return sizes;
  }
  function isCommandDevice(d) {
    const s = featureSizes(d);
    return s.includes(64) && !s.includes(512);
  }
  function chooseCommandDevice(devices, selected) {
    if (isCommandDevice(selected)) return selected;
    const candidates = devices.filter((d) =>
      d.vendorId === selected.vendorId && d.productId === selected.productId && isCommandDevice(d));
    if (candidates.length > 1) throw new Error("Multiple matching command interfaces; select the correct device");
    return candidates[0] || null;
  }
  function integer(n, min, max, name) {
    if (!Number.isInteger(n) || n < min || n > max)
      throw new RangeError(`Invalid ${name}`);
    return n;
  }
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  class Driver {
    constructor(device, model, options = {}) {
      if (!isCommandDevice(device))
        throw new Error("Select the 64-byte report 0 command interface");
      if (!modelsForDevice(device).includes(model))
        throw new Error("Select a matching WLmouse model");
      this.device = device;
      this.model = model;
      this.profile = 0;
      this.ready = false;
      this.broken = false;
      this.queue = Promise.resolve();
      this.delay = options.delay ?? 30;
      this.timeout = options.timeout ?? 1500;
    }
    _run(fn) {
      const job = this.queue.then(async () => {
        if (this.broken)
          throw new Error(
            "Device connection timed out; reconnect before continuing",
          );
        this._writeAttempted = false;
        try {
          return await fn();
        } catch (error) {
          if (this._writeAttempted) this.ready = false;
          throw error;
        }
      });
      this.queue = job.catch(() => {});
      return job;
    }
    _requireReady() {
      if (!this.ready) throw new Error("Read device settings before writing");
    }
    async _writeGuard() {
      this._requireReady();
      if ((await this._profile()) !== this.profile) {
        this.ready = false;
        throw new Error("Active profile changed; read device settings again");
      }
    }
    async _request(category, opcode, length, payload = [], deviceId = 2) {
      const out = new Uint8Array(64);
      out[2] = deviceId;
      out[3] = length;
      out[4] = category;
      out[5] = opcode;
      out.set(payload, 6);
      // Profile-scoped reads echo the profile immediately before their value.
      const profileRead = this.model.newProtocol && payload.length && (
        (category === 1 && [0x80, 0x81, 0x82, 0x84, 0x88, 0x89, 0x8a, 0x8b, 0x8d, 0x93, 0x94].includes(opcode)) ||
        (category === 2 && opcode === 0x81) ||
        (category === 0 && [0x87, 0x88, 0x8e].includes(opcode))
      );
      const deadline = Date.now() + this.timeout;
      const timed = async (p) => {
        let timer;
        try {
          return await Promise.race([
            p,
            new Promise((_, reject) => {
              timer = setTimeout(
                () => {
                  this.broken = true;
                  reject(new Error("WLmouse feature report timed out"));
                },
                Math.max(1, deadline - Date.now()),
              );
            }),
          ]);
        } finally {
          clearTimeout(timer);
        }
      };
      if (opcode < 0x80) this._writeAttempted = true;
      await timed(this.device.sendFeatureReport(0, out));
      await sleep(this.delay);
      while (Date.now() < deadline) {
        const v = await timed(this.device.receiveFeatureReport(0));
        let bytes = new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
        if (
          bytes[0] === 0 &&
          (bytes.length === 65 ||
            (bytes[1] >= 0xa1 && bytes[5] === category && bytes[6] === opcode))
        )
          bytes = bytes.subarray(1);
        if (bytes.length < 63) throw new Error("Short WLmouse feature report");
        if (bytes[0] === 0xa1 && bytes[4] === category && bytes[5] === opcode &&
            (!profileRead || bytes[6] === payload[0]))
          return bytes;
        if (bytes[4] === category && bytes[5] === opcode && bytes[0] > 0xa1)
          throw new Error(`WLmouse command rejected (status ${bytes[0]})`);
        await sleep(this.delay);
      }
      this.broken = true;
      throw new Error("WLmouse response timed out; reconnect");
    }
    async _profile() {
      const r = await this._request(0, 0x85, 1);
      return integer(r[6], 1, 3, "profile");
    }
    async _firmware() {
      const r = await this._request(0, 0x81, 16);
      return Array.from(r.slice(6, 10)).join(".");
    }
    async _battery() {
      const r = await this._request(0, 0x83, 2);
      return { percent: r[7], charging: r[6] === 1 };
    }
    async _value(category, op, length = 2, profiled = true) {
      const r = await this._request(category, op, length, [
        profiled && this.model.newProtocol ? this.profile : 0,
      ]);
      const value = r[profiled && this.model.newProtocol ? 7 : 6];
      return op === 0x80 && category === 1 && value === 16 ? 1 : value;
    }
    async _bool(category, op) {
      return integer(await this._value(category, op), 0, 1, "boolean setting") === 1;
    }
    async _dpi() {
      const d = await this._request(1, 0x81, 10, [this.profile, 6]);
      const count = integer(d[7], 1, 6, "DPI stage count");
      const active = (await this._request(1, 0x82, 2, [this.profile]))[7];
      integer(active, 1, count, "active DPI stage");
      const colors = await this._request(2, 0x81, 19, [this.profile]);
      const stages = Array.from({ length: count }, (_, i) => ({
        x: (d[8 + i * 4] << 8) | d[9 + i * 4],
        y: (d[10 + i * 4] << 8) | d[11 + i * 4],
        color: Array.from(colors.slice(7 + i * 3, 10 + i * 3)),
      }));
      return { stages, active };
    }
    async _lod() {
      const r = await this._request(1, 0x88, 3, [
        this.model.newProtocol ? this.profile : 0,
      ]);
      const i = this.model.newProtocol ? 7 : 6;
      const n = r[i];
      return {
        distance:
          n >= 128
            ? (n - 128) / 10
            : n === 1 || n === 2
              ? n
              : ((n >> 4) * 10 + (n & 15)) / 10,
        mode: r[i + 1],
      };
    }
    async _sleep() {
      const r = await this._request(0, 0x87, 3, [
        this.model.newProtocol ? this.profile : 0,
      ]);
      const i = this.model.newProtocol ? 7 : 6;
      return (r[i] << 8) | r[i + 1];
    }
    async init() {
      return this._run(async () => {
        if (!this.device.opened) await this.device.open();
        this.profile = await this._profile();
        this.ready = false;
        return this.profile;
      });
    }
    async readState() {
      return this._run(async () => {
        this.ready = false;
        this.profile = await this._profile();
        const state = {
          profile: this.profile,
          firmware: await this._firmware(),
          battery: await this._battery(),
          dpi: await this._dpi(),
          polling: await this._value(1, 0x80),
          lod: await this._lod(),
          debounce: (await this._request(0, 0x88, 2, [this.profile]))[7],
          sleep: await this._sleep(),
          xy: await this._bool(1, 0x8d),
          angleSnap: await this._bool(1, 0x84),
          motionSync: await this._bool(1, 0x89),
          ripple: await this._bool(1, 0x8a),
          tracking: await this._bool(1, 0x93),
          hyper: await this._bool(1, 0x8b),
          angleTune: ((v) => (v > 127 ? v - 256 : v))(
            await this._value(1, 0x94),
          ),
        };
        if ((await this._profile()) !== this.profile)
          throw new Error("Active profile changed while reading settings");
        this.ready = true;
        return state;
      });
    }
    getBattery() {
      return this._run(() => this._battery());
    }
    getFirmware() {
      return this._run(() => this._firmware());
    }
    getProfileName(id) {
      return this._run(async () => {
        integer(id, 1, 3, "profile");
        const r = await this._request(0, 0x8e, 58, [id]);
        const length = integer(r[7], 0, 55, "profile name length");
        return new TextDecoder("gbk")
          .decode(r.slice(8, 8 + length))
          .replace(/\0+$/, "");
      });
    }
    setProfile(id) {
      return this._run(async () => {
        await this._writeGuard();
        integer(id, 1, 3, "profile");
        await this._request(0, 5, 1, [id]);
        const actual = await this._profile();
        this.ready = false;
        if (actual !== id) throw new Error("Profile readback did not match");
        this.profile = id;
        return actual;
      });
    }
    _setValue(category, op, readOp, value) {
      return this._run(async () => {
        await this._writeGuard();
        integer(value, 0, 255, "value");
        if (
          category === 1 &&
          op === 19 &&
          value === 1 &&
          !(await this._bool(1, 0x8b))
        )
          throw new Error("Enable hyper mode before tracking mode");
        await this._request(
          category,
          op,
          2,
          this.model.newProtocol ? [this.profile, value] : [value],
        );
        const actual = await this._value(category, readOp);
        if (
          actual !== value &&
          !(readOp === 0x80 && value === 16 && actual === 1)
        ) {
          this.ready = false;
          throw new Error("Setting readback did not match");
        }
        if (category === 1 && op === 11 && value === 0) {
          await this._request(1, 19, 2, [this.profile, 0]);
          if (await this._bool(1, 0x93)) {
            this.ready = false;
            throw new Error("Tracking mode readback did not match");
          }
        }
        return actual;
      });
    }
    setPolling(v) {
      const rates = {
        8: 125,
        4: 250,
        2: 500,
        1: 1000,
        32: 2000,
        64: 4000,
        128: 8000,
      };
      const allowed =
        this.device.productId === this.model.wired
          ? this.model.pollingWired
          : this.device.productId === this.model.wireless
            ? [125, 250, 500, 1000]
            : this.model.pollingWireless;
      if (!allowed.includes(rates[v]))
        throw new RangeError("Unsupported polling rate");
      return this._setValue(1, 0, 0x80, v);
    }
    setAngleTune(v) {
      integer(v, -30, 30, "angle tune");
      return this._setValue(1, 20, 0x94, v & 255);
    }
    setXY(v) {
      if (![true, false, 0, 1].includes(v))
        throw new RangeError("Expected an on/off value");
      return this._setValue(1, 13, 0x8d, Number(v));
    }
    setAngleSnap(v) {
      if (![true, false, 0, 1].includes(v))
        throw new RangeError("Expected an on/off value");
      return this._setValue(1, 4, 0x84, Number(v));
    }
    setMotionSync(v) {
      if (![true, false, 0, 1].includes(v))
        throw new RangeError("Expected an on/off value");
      return this._setValue(1, 9, 0x89, Number(v));
    }
    setRipple(v) {
      if (![true, false, 0, 1].includes(v))
        throw new RangeError("Expected an on/off value");
      return this._setValue(1, 10, 0x8a, Number(v));
    }
    setTracking(v) {
      if (![true, false, 0, 1].includes(v))
        throw new RangeError("Expected an on/off value");
      return this._setValue(1, 19, 0x93, Number(v));
    }
    setHyper(v) {
      if (![true, false, 0, 1].includes(v))
        throw new RangeError("Expected an on/off value");
      return this._setValue(1, 11, 0x8b, Number(v));
    }
    setDebounce(v) {
      return this._run(async () => {
        await this._writeGuard();
        integer(v, 0, 15, "debounce");
        await this._request(0, 8, 2, [this.profile, v]);
        const actual = (await this._request(0, 0x88, 2, [this.profile]))[7];
        if (actual !== v) throw new Error("Debounce readback did not match");
        return actual;
      });
    }
    setSleep(v) {
      return this._run(async () => {
        await this._writeGuard();
        if (
          v !== 65535 &&
          (!Number.isInteger(v) || v < 60 || v > 1800 || v % 60)
        )
          throw new RangeError("Sleep must be 1–30 minutes or disabled");
        await this._request(
          0,
          7,
          3,
          this.model.newProtocol
            ? [this.profile, v >> 8, v & 255]
            : [v >> 8, v & 255],
        );
        const actual = await this._sleep();
        if (actual !== v) throw new Error("Sleep readback did not match");
        return actual;
      });
    }
    setLOD(distance, mode) {
      return this._run(async () => {
        await this._writeGuard();
        if (!this.model.lod.includes(distance))
          throw new RangeError("Unsupported lift-off distance");
        if (![3, 11].includes(mode)) throw new RangeError("Invalid LOD mode");
        const n =
          distance < 1
            ? 128 + Math.round(distance * 10)
            : distance > 1 && distance < 2
              ? (Math.floor(distance) << 4) | Math.round((distance % 1) * 10)
              : distance;
        await this._request(
          1,
          8,
          3,
          this.model.newProtocol ? [this.profile, n, mode] : [n, mode],
        );
        const actual = await this._lod();
        if (actual.distance !== distance || actual.mode !== mode)
          throw new Error("LOD readback did not match");
        return actual;
      });
    }
    setDPI(dpi) {
      return this._run(async () => {
        await this._writeGuard();
        if (!dpi || !Array.isArray(dpi.stages))
          throw new Error("Invalid DPI stages");
        const count = integer(dpi.stages.length, 1, 6, "DPI count");
        integer(dpi.active, 1, count, "active DPI stage");
        const values = [];
        const colors = [];
        for (const s of dpi.stages) {
          for (const v of [s.x, s.y]) {
            integer(v, 50, this.model.dpiMax, "DPI");
            if (v % this.model.dpiStep)
              throw new RangeError("DPI does not match model step");
            values.push(v >> 8, v & 255);
          }
          if (!Array.isArray(s.color) || s.color.length !== 3)
            throw new Error("Invalid DPI color");
          colors.push(...s.color.map((v) => integer(v, 0, 255, "color")));
        }
        const oldDpi = await this._request(1, 0x81, 10, [this.profile, 6]);
        const oldColors = await this._request(2, 0x81, 19, [this.profile]);
        while (values.length < 24) values.push(oldDpi[8 + values.length]);
        while (colors.length < 18) colors.push(oldColors[7 + colors.length]);
        try {
          await this._request(1, 2, 2, [this.profile, dpi.active]);
          await this._request(1, 1, 26, [this.profile, count, ...values]);
          await this._request(2, 1, 19, [this.profile, ...colors]);
        } catch (error) {
          this.ready = false;
          throw error;
        }
        const actual = await this._dpi();
        if (
          actual.active !== dpi.active ||
          actual.stages.length !== count ||
          actual.stages.some(
            (s, i) =>
              s.x !== dpi.stages[i].x ||
              s.y !== dpi.stages[i].y ||
              s.color.some((c, j) => c !== dpi.stages[i].color[j]),
          )
        ) {
          this.ready = false;
          throw new Error("DPI readback did not match");
        }
        return actual;
      });
    }
  }
  root.WLM = {
    models,
    filters,
    modelsForDevice,
    isCommandDevice,
    has64ByteFeature: isCommandDevice,
    chooseCommandDevice,
    Driver,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
