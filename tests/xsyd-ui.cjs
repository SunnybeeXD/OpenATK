const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
require("../xsyd/protocol.js");
require("../wlmouse/protocol.js");
const X = global.XSYD;
const R = X.req;
const hub = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const page = fs.readFileSync(path.join(__dirname, "../xsyd/index.html"), "utf8");

async function session(opts) {
  const dev = new X.DemoDevice(opts);
  const log = [];
  const drv = new X.Driver(dev, { timeout: 200, onLog: (c, b) => log.push([c, b]) });
  await drv.open();
  return { dev, drv, log };
}

test("frames are 64 bytes, zero padded, and bad input is refused", () => {
  const f = X.frame([2, 5, 2, 3]);
  assert.equal(f.length, 64);
  assert.deepEqual([...f.slice(0, 5)], [2, 5, 2, 3, 0]);
  assert.throws(() => X.frame([1]));
  assert.throws(() => X.frame([1, 256]));
  assert.throws(() => X.frame(new Array(65).fill(1)));
});

test("request builders produce the documented bytes", () => {
  assert.deepEqual(R.info().b, [1, 2]);
  assert.deepEqual(R.features().b, [1, 3]);
  assert.deepEqual(R.rateList().b, [2, 5, 0]);
  assert.deepEqual(R.rateSet(3).b, [2, 5, 2, 3]);
  assert.deepEqual(R.systemSet(1).b, [2, 4, 2, 1]);
  assert.deepEqual(R.configSet(2).b, [2, 3, 2, 2]);
  assert.deepEqual(R.configName(1).b, [2, 3, 3, 1]);
  assert.deepEqual(R.configRename(0, "ab").b, [2, 3, 4, 0, 97, 98]);
  assert.deepEqual(R.layoutStyle(2).b, [3, 5, 2]);
  assert.deepEqual(R.layoutRow(1, 2).b, [3, 1, 1, 2]);
  assert.deepEqual(R.keyGet(0, 1, 2).b, [3, 3, 0, 1, 2]);
  assert.deepEqual(R.keySet(0, 1, 2, 0x1234).b, [3, 4, 0, 1, 2, 0x34, 0x12]);
  assert.deepEqual(R.defaultRow(1, 2, 3).b, [3, 6, 0x12, 3]);
  assert.deepEqual(R.perfGet(1, 2).b, [4, 1, 1, 2]);
  const p = { mode: 1, normalPress: 1500, normalRelease: 1500, rtFirstTouch: 1000, rtPress: 300, rtRelease: 310, pressDead: 50, releaseDead: 60, axis: 2, axisV2Id: 0x0102, axisRangeMax: 3400, axisCoefficient: 7 };
  assert.deepEqual(R.perfSet(3, 4, p).b, [4, 2, 3, 4, 1, 0xDC, 5, 0xDC, 5, 0xE8, 3, 0x2C, 1, 0x36, 1, 50, 0, 60, 0, 2, 0, 2, 1, 0x48, 0x0D, 7, 0]);
  assert.deepEqual(R.power().b, [13, 1]);
});

test("builders reject out of range values", () => {
  assert.throws(() => R.rateSet(7));
  assert.throws(() => R.systemSet(2));
  assert.throws(() => R.layoutRow(4, 0));
  assert.throws(() => R.keyGet(0, 6, 0));
  assert.throws(() => R.keySet(0, 0, 0, 0x10000));
  assert.throws(() => R.configRename(0, ""));
  assert.throws(() => R.configRename(0, "x".repeat(33)));
  assert.throws(() => R.configRename(0, "a\nb"));
  assert.throws(() => R.perfSet(0, 0, { mode: 3 }));
});

test("keycodes follow the vendor driver tables", () => {
  const K = X.keys;
  assert.equal(K.describe(4), "A");
  assert.equal(K.describe(0x1329), "Ctrl+Shift+Esc");
  assert.equal(K.describe(0x1807), "Win+D");
  assert.equal(K.describe(0x20E9), "Volume up");
  assert.equal(K.describe(0x4100), "Mouse left");
  assert.equal(K.describe(0), "None");
  assert.equal(K.makeCombo(["Ctrl", "Shift"], 6), 0x1306);
  assert.throws(() => K.makeCombo([], 6));
  assert.equal(K.canAssign(4), true);
  assert.equal(K.canAssign(0x1306), true);
  assert.equal(K.canAssign(0x1006), false);
  for (const bad of [0xF200, 0xF201, 0xF203, 0xF101, 0xF300, 0xF500, 0xC800, 3, 0x10000, -1, 1.5]) assert.equal(K.canAssign(bad), false, String(bad));
});

test("reads decode against the simulated keyboard", async () => {
  const { drv } = await session();
  const info = await drv.run(R.info());
  assert.equal(info.boardId, 0x1A2B3C4D);
  assert.equal(info.app, "1.2.3.4");
  const f = await drv.run(R.features());
  assert.equal(f.switches.magnetic, true);
  assert.equal(f.connections.g24, true);
  assert.deepEqual(await drv.run(R.rateList()), [0, 1, 3, 4, 5, 6]);
  assert.equal(await drv.run(R.rateGet()), 3);
  assert.equal(await drv.run(R.configCount()), 4);
  assert.equal(await drv.run(R.configName(1)), "FPS");
  const style = await drv.run(R.layoutStyle(5));
  assert.equal(style[3].ratio, 9);
  assert.equal(style[3].col, 3.75);
  assert.equal(style[3].row, 5);
  assert.equal(style[10].ratio, 0);
  const row = await drv.run(R.layoutRow(0, 0));
  assert.equal(row[0], 41);
  assert.equal(await drv.run(R.keyGet(0, 0, 0)), 41);
  assert.deepEqual(await drv.run(R.power()), { mode: 1, charging: false, battery: 76 });
  assert.equal(await drv.run(R.rtPrecision()), 0.01);
});

test("writes are refused until they are switched on", async () => {
  const { dev, drv } = await session();
  await assert.rejects(() => drv.run(R.rateSet(4)), /turned off/);
  assert.equal(dev.sent.length, 0);
  drv.writes = true;
  assert.equal(await drv.run(R.rateSet(4)), 4);
  assert.equal(dev.rate, 4);
});

test("replies with the wrong category, command or length are rejected", async () => {
  for (const [name, fault, re] of [
    ["category", (q, r) => { r[0] = 9; return r; }, /does not match/],
    ["command", (q, r) => { r[1] = 9; return r; }, /does not match/],
    ["length", (q, r) => r.slice(0, 3), /expected at least/],
  ]) {
    const { drv } = await session({ fault });
    await assert.rejects(() => drv.run(R.info()), re, name);
  }
});

test("a silent device times out and a mismatching write is never retried", async () => {
  const silent = await session({ fault: () => null });
  await assert.rejects(() => silent.drv.run(R.info()), /No reply/);
  const bad = await session({ fault: (q, r) => { r[3] = 6; return r; } });
  bad.drv.writes = true;
  await assert.rejects(() => bad.drv.run(R.rateSet(4)), /device said 6, expected 4/);
  assert.equal(bad.dev.sent.length, 1);
  const wrongEcho = await session({ fault: (q, r) => { r[3] = 1; return r; } });
  wrongEcho.drv.writes = true;
  await assert.rejects(() => wrongEcho.drv.run(R.keySet(0, 0, 0, 5)), /Key/);
  assert.equal(wrongEcho.dev.sent.length, 1);
});

test("layout rows and key replies must echo what was asked", async () => {
  const { drv } = await session({ fault: (q, r) => { r[3] = 5; return r; } });
  await assert.rejects(() => drv.run(R.layoutRow(0, 0)), /Layout row/);
  await assert.rejects(() => drv.run(R.keyGet(0, 0, 0)), /Key/);
});

test("performance write keeps the fields it did not edit and reports differences", async () => {
  const { dev, drv } = await session();
  drv.writes = true;
  const cur = await drv.run(R.perfGet(2, 3));
  const next = { ...cur, mode: 1, rtPress: 250, rtRelease: 260, pressDead: 20 };
  const got = await drv.run(R.perfSet(2, 3, next));
  assert.equal(got.rtPress, 250);
  assert.equal(got.axisV2Id, cur.axisV2Id);
  assert.equal(got.axisRangeMax, 3400);
  assert.equal(dev.sent.at(-1)[20], 0);
  const lying = await session({ fault: (q, r) => { if (q[1] === 2) r[11] = 0; return r; } });
  lying.drv.writes = true;
  await assert.rejects(() => lying.drv.run(R.perfSet(0, 0, { ...cur, rtPress: 250 })), /rtPress/);
});

test("key writes round trip and rename reads back", async () => {
  const { dev, drv } = await session();
  drv.writes = true;
  assert.equal(await drv.run(R.keySet(0, 1, 1, 0x1306)), 0x1306);
  assert.equal(await drv.run(R.keyGet(0, 1, 1)), 0x1306);
  await drv.run(R.configRename(2, "Work"));
  assert.equal(await drv.run(R.configName(2)), "Work");
  assert.equal(dev.names[2], "Work");
  assert.equal(await drv.run(R.configSet(1)), 1);
  assert.equal(await drv.run(R.configGet()), 1);
});

test("requests are sent one at a time", async () => {
  const { dev, drv } = await session({ delay: 5 });
  const out = await Promise.all([drv.run(R.info()), drv.run(R.features()), drv.run(R.rateGet())]);
  assert.equal(out[2], 3);
  assert.deepEqual(dev.sent.map(q => q[1]), [2, 3, 5]);
});

test("collection matching picks the command interface without any vendor id", () => {
  const a = { vendorId: 1, productId: 2, collections: [{ usagePage: 1, usage: 6 }] };
  const b = { vendorId: 1, productId: 2, collections: [{ usagePage: 0xFF80, usage: 1, outputReports: [{}] }] };
  const c = { vendorId: 9, productId: 9, collections: [{ usagePage: 0xFFB0, usage: 2 }] };
  assert.equal(X.hasCollection(a), false);
  assert.equal(X.hasCollection(b), true);
  assert.equal(X.hasCollection(c), false);
  assert.equal(X.pickCommand([a, b, c]), b);
  assert.equal(X.pickCommand([a, c]), null);
  assert.deepEqual(X.FILTERS, [{ usagePage: 0xFFB0, usage: 1 }, { usagePage: 0xFF80, usage: 1 }]);
});

test("the hub claims only devices no other brand claims", () => {
  const start = hub.indexOf("const MICE");
  const end = hub.indexOf("const ALL_FILTERS");
  const code = hub.slice(start, end);
  const kindStart = hub.indexOf("const kindOf");
  const kindOf = hub.slice(kindStart, hub.indexOf("const hashFor"));
  const make = new Function("WLM", code + ";" + kindOf + ";return { BRANDS, kindOf, matches, KEYBOARDS };");
  const { BRANDS, kindOf: kind } = make(global.WLM);
  assert.deepEqual(BRANDS.map(b => b.id), ["atk", "rapoo", "rawm", "gwolves", "fm", "wlmouse", "xsyd"]);
  const dev = (vendorId, productId, usagePage, usage) => ({ vendorId, productId, collections: [{ usagePage, usage }] });
  assert.equal(kind(dev(0x373B, 1, 0xFF60, 0x61)), "keyboard");
  assert.equal(kind(dev(0x373B, 1, 0xFF05, 1)), "mouse");
  assert.equal(kind(dev(0x24AE, 1, 0xFF00, 2)), "rapoo");
  assert.equal(kind(dev(0x373E, 0x98, 1, 2)), "rawm");
  assert.equal(kind(dev(0x36a7, 0xa886, 0xFF80, 1)), "wlmouse");
  assert.equal(kind(dev(0x1234, 0x5678, 0xFFB0, 1)), "xsyd");
  assert.equal(kind(dev(0x4321, 0x8765, 0xFF80, 1)), "xsyd");
  assert.equal(BRANDS.find(b => b.id === "xsyd").test(dev(0x1234, 1, 0xFF00, 1)), false);
});

test("the page is wired for embed, demo and a strict script policy", () => {
  assert.match(page, /get\("embed"\) === "1"/);
  assert.match(page, /get\("demo"\)/);
  assert.match(page, /href="\.\.\/ui\.css"/);
  assert.match(page, /script-src 'self' 'unsafe-inline'/);
  assert.match(hub, /xsyd\/index\.html|`\$\{demo\}\/index\.html\?demo=1&embed=1`/);
  assert.match(hub, /assets\/xsyd\/keyboard\.svg/);
  for (const file of ["xsyd/index.html", "xsyd/protocol.js", "tests/xsyd-ui.cjs", "assets/xsyd/keyboard.svg"]) {
    const text = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    assert.equal(text.includes(String.fromCharCode(8212)), false, file + " has an em dash");
  }
  for (const file of ["xsyd/protocol.js"]) {
    const text = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    assert.equal(/^\s*\/\/|\/\*/m.test(text), false, file + " has a comment");
  }
  assert.equal(/FirmwareUpgrade|\[8, /.test(fs.readFileSync(path.join(__dirname, "../xsyd/protocol.js"), "utf8")), false);
});
