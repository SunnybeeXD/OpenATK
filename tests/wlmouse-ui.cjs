const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "../wlmouse/index.html"), "utf8");
const head = html.slice(html.indexOf("<script>") + 8, html.indexOf("      try {"));
const operation = html.slice(html.indexOf("      async function operation("), html.indexOf("      function options("));
const startup = html.slice(html.indexOf("      function finishStartup("), html.indexOf("      start();"));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture(query, { hid = true } = {}) {
  const classes = new Set(), grants = deferred(), connection = deferred();
  const ui = { heroHidden: false, appHidden: true, notice: "", locks: [], selected: [], demoDongle: null, reads: 0 };
  const command = { vendorId: 0x36a7, productId: 0xa886, command: true };
  const sibling = { ...command, command: false };
  const document = { documentElement: { classList: {
    add(name) { classes.add(name); }, remove(name) { classes.delete(name); },
  } } };
  const navigator = hid ? { hid: { getDevices() { ui.reads++; return grants.promise; } } } : {};
  const location = { search: query };
  new Function("document", "navigator", "location", "URLSearchParams", head)(document, navigator, location, URLSearchParams);
  const qs = new URLSearchParams(query), requestedDemo = qs.get("demo");
  const sandbox = {
    document, navigator, qs,
    demo: /^(1|dongle)$/.test(requestedDemo) ? requestedDemo : null,
    busy: false, driver: null,
    console: { error() {} }, log() {},
    lock(value) { sandbox.busy = value; ui.locks.push(value); },
    notice(text) { ui.notice = text; },
    render() {},
    WLM: {
      filters: [{ vendorId: command.vendorId, productId: command.productId }],
      models: [{ name: "BEAST MINI" }],
      isCommandDevice(device) { return device.command; },
    },
    DemoDevice: class { constructor(dongle) { ui.demoDongle = dongle; } },
    async connectDevice() { await connection.promise; ui.heroHidden = true; ui.appHidden = false; },
    async connectSelected(devices) {
      ui.selected.push(...devices);
      await connection.promise;
      ui.heroHidden = true; ui.appHidden = false;
    },
  };
  const app = new Function("sandbox", "with(sandbox){" + operation + startup + ";return {start};}")(sandbox);
  return { start: app.start, classes, grants, connection, ui, command, sibling,
    visible(name) { if(classes.has("wl-starting"))return name === "loading"; return name === "hero" ? !ui.heroHidden : name === "app" ? !ui.appHidden : false; } };
}
async function until(check) { for(let n = 0; n < 50; n++) { if(check())return; await Promise.resolve(); } throw Error("Startup did not reach expected stage"); }

test("real-device startup shows loading until the authorized command interface is ready", async () => {
  assert.ok(html.includes("html.wl-starting #hero,html.wl-starting #app{display:none!important}"));
  assert.ok(html.includes('id="startupStatus"'));
  const f = fixture("?d=36a7%3Aa886&embed=1"), done = f.start();
  assert.equal(f.visible("hero"), false); assert.equal(f.visible("app"), false); assert.equal(f.visible("loading"), true);
  f.grants.resolve([f.sibling, f.command]);
  await until(() => f.ui.selected.length === 1);
  assert.equal(f.ui.selected[0], f.command);
  assert.equal(f.visible("hero"), false); assert.equal(f.visible("loading"), true);
  f.connection.resolve(); await done;
  assert.equal(f.visible("app"), true); assert.equal(f.visible("hero"), false); assert.equal(f.visible("loading"), false);
  assert.deepEqual(f.ui.locks, [true, false]);
});

test("no authorized device reveals Connect instead of leaving a blank page", async () => {
  const f = fixture("?embed=1"), done = f.start();
  f.grants.resolve([]); await done;
  assert.equal(f.visible("hero"), true); assert.equal(f.visible("app"), false); assert.equal(f.visible("loading"), false);
  assert.equal(f.ui.selected.length, 0); assert.deepEqual(f.ui.locks, [true, false]);
});

test("device enumeration failure releases the startup gate and retains its error", async () => {
  const f = fixture(""), done = f.start();
  f.grants.reject(new Error("Device access failed")); await done;
  assert.equal(f.visible("hero"), true); assert.equal(f.visible("loading"), false);
  assert.match(f.ui.notice, /Device access failed/); assert.deepEqual(f.ui.locks, [true, false]);
});

test("connection failure does not flash Connect before the failure is known", async () => {
  const f = fixture("?d=36a7%3Aa886"), done = f.start();
  f.grants.resolve([f.command]); await until(() => f.ui.selected.length === 1);
  assert.equal(f.visible("hero"), false);
  f.connection.reject(new Error("Could not read mouse")); await done;
  assert.equal(f.visible("hero"), true); assert.equal(f.visible("app"), false); assert.equal(f.visible("loading"), false);
  assert.match(f.ui.notice, /Could not read mouse/);
});

for(const mode of ["1", "dongle"])test("demo " + mode + " skips Connect and never enumerates hardware", async () => {
  const f = fixture("?demo=" + mode, { hid: false }), done = f.start();
  assert.equal(f.visible("hero"), false); assert.equal(f.visible("loading"), true);
  assert.equal(f.ui.demoDongle, mode === "dongle");
  f.connection.resolve(); await done;
  assert.equal(f.visible("app"), true); assert.equal(f.visible("hero"), false); assert.equal(f.visible("loading"), false);
  assert.equal(f.ui.reads, 0);
});

test("unsupported browsers retain the connection guidance", async () => {
  const f = fixture("", { hid: false }); await f.start();
  assert.equal(f.visible("hero"), true); assert.equal(f.visible("loading"), false); assert.equal(f.ui.reads, 0);
});

test("unknown demo parameters fall back to ordinary startup and settle", async () => {
  const f = fixture("?demo=unknown"), done = f.start();
  f.grants.resolve([]); await done;
  assert.equal(f.visible("hero"), true); assert.equal(f.visible("loading"), false); assert.equal(f.ui.reads, 1);
});
