const assert = require("node:assert/strict");
require("../wlmouse/protocol.js");
const {
  models,
  modelsForDevice,
  isCommandDevice,
  chooseCommandDevice,
  Driver,
} = global.WLM;
const model = models.find((m) => m.name === "BEAST X");
const collection = (n) => [
  {
    featureReports: [
      { reportId: 0, items: [{ reportSize: 8, reportCount: n }] },
    ],
  },
];
let frames = [];
let pending;
let polling = 1;
let profile = 1;
let dpiCount = 2, dpiActive = 1;
let dpiBytes = [1,144,1,144,3,32,3,32,4,176,4,176,6,64,6,64,7,208,7,208,9,96,9,96];
let colorBytes = [255,0,0,0,255,0,10,20,30,40,50,60,70,80,90,100,110,120];
const device = {
  vendorId: 0x36a7,
  productId: model.wired,
  opened: true,
  collections: collection(64),
  async sendFeatureReport(id, data) {
    assert.equal(id, 0);
    frames.push([...data]);
    pending = [...data];
    if (data[4] === 1 && data[5] === 0) polling = data[7];
    if (data[4] === 1 && data[5] === 1) { dpiCount=data[7]; dpiBytes=[...data.slice(8,32)]; }
    if (data[4] === 1 && data[5] === 2) dpiActive=data[7];
    if (data[4] === 2 && data[5] === 1) colorBytes=[...data.slice(7,25)];
  },
  async receiveFeatureReport() {
    const out = new Uint8Array(65);
    const r = out.subarray(1);
    r[0] = 0xa1;
    r[4] = pending[4];
    r[5] = pending[5];
    const key = `${r[4]}:${r[5]}`;
    if (pending[6] && pending[5] >= 0x80) r[6] = pending[6];
    if (key === "0:133") r[6] = profile;
    if (key === "0:129") r.set([1, 2, 3, 4], 6);
    if (key === "0:131") r.set([1, 85], 6);
    if (key === "1:129") r.set([1, dpiCount, ...dpiBytes], 6);
    if (key === "1:130") r.set([1, dpiActive], 6);
    if (key === "2:129") r.set([1, ...colorBytes], 6);
    if (key === "1:128") r.set([1, polling], 6);
    if (key === "1:136") r.set([1, 1, 0], 6);
    if (key === "0:136") r.set([1, 4], 6);
    if (key === "0:135") r.set([1, 0, 60], 6);
    return new DataView(out.buffer);
  },
};
(async () => {
  assert(isCommandDevice(device));
  assert(!isCommandDevice({ ...device, collections: collection(512) }));
  assert.equal(
    chooseCommandDevice(
      [{ ...device, collections: collection(512) }, device],
      device,
    ),
    device,
  );
  assert(modelsForDevice({ vendorId: 0x36a7, productId: 0xa863 }).length === 2);
  const otherInterface = {...device, collections: collection(512)};
  assert.throws(()=>chooseCommandDevice([device,{...device}],otherInterface),/Multiple/);
  assert.equal(chooseCommandDevice([device,{...device}],device),device);
  const d = new Driver(device, model, { delay: 0, timeout: 100 });
  await assert.rejects(d.setPolling(2), /Read device settings/);
  await d.init();
  const s = await d.readState();
  assert.deepEqual(s.dpi, {
    stages: [
      { x: 400, y: 400, color: [255, 0, 0] },
      { x: 800, y: 800, color: [0, 255, 0] },
    ],
    active: 1,
  });
  assert.equal(s.firmware, "1.2.3.4");
  assert.deepEqual(s.battery, { percent: 85, charging: true });
  await d.setPolling(2);
  const write = frames.find((f) => f[4] === 1 && f[5] === 0);
  assert.deepEqual(write.slice(0, 9), [0, 0, 2, 2, 1, 0, 1, 2, 0]);
  assert.equal(write.length, 64);
  assert.throws(() => d.setPolling(128), /Unsupported/);
  const dpiStart=frames.length;
  await d.setDPI({stages:[{x:450,y:500,color:[7,8,9]},{x:800,y:800,color:[0,255,0]}],active:2});
  const dpiWrite=frames.slice(dpiStart).find(f=>f[4]===1&&f[5]===1);
  const colorWrite=frames.slice(dpiStart).find(f=>f[4]===2&&f[5]===1);
  assert.deepEqual(dpiWrite.slice(0,16),[0,0,2,26,1,1,1,2,1,194,1,244,3,32,3,32]);
  assert.deepEqual(dpiWrite.slice(16,32),[4,176,4,176,6,64,6,64,7,208,7,208,9,96,9,96]);
  assert.deepEqual(colorWrite.slice(7,25),[7,8,9,0,255,0,10,20,30,40,50,60,70,80,90,100,110,120]);
  await assert.rejects(d.setDPI({stages:[{x:451,y:500,color:[7,8,9]}],active:1}),/step/);
  await assert.rejects(d.setDPI({stages:[{x:49,y:500,color:[7,8,9]}],active:1}),/DPI/);
  await assert.rejects(d.setDPI({stages:[{x:450,y:500,color:[7,8,256]}],active:1}),/color/);
  await assert.rejects(d.setDebounce(16), /debounce/);
  await assert.rejects(d.setSleep(61), /Sleep/);
  await assert.rejects(d.setProfile(4), /profile/);
  await assert.rejects(d.setLOD(1, 255), /LOD mode/);
  const beforeMismatch = frames.length;
  profile = 2;
  await assert.rejects(d.setDebounce(4), /profile changed/);
  assert.deepEqual(
    frames.slice(beforeMismatch).map((f) => f[5]),
    [0x85],
  );
  profile = 1;
  const bad = {
    ...device,
    async receiveFeatureReport() {
      const r = new Uint8Array(64);
      r[0] = 0xa2;
      r[4] = 0;
      r[5] = 0x85;
      return new DataView(r.buffer);
    },
  };
  await assert.rejects(
    new Driver(bad, model, { delay: 0, timeout: 50 }).init(),
    /rejected/,
  );
  const concurrent = new Driver(device, model, { delay: 0, timeout: 100 });
  await concurrent.init();
  const start = frames.length;
  await Promise.all([concurrent.getFirmware(), concurrent.getBattery()]);
  assert.deepEqual(
    frames.slice(start).map((f) => f[5]),
    [0x81, 0x83],
  );
  const stuck = {
    ...device,
    receiveFeatureReport: () => new Promise(() => {}),
  };
  const timed = new Driver(stuck, model, { delay: 0, timeout: 10 });
  await assert.rejects(timed.init(), /timed out/);
  await assert.rejects(timed.init(), /reconnect/);
  const plain = {
    ...device,
    async receiveFeatureReport() {
      const r = new Uint8Array(64);
      r[0] = 0xa1;
      r[4] = 0;
      r[5] = 0x85;
      r[6] = 2;
      return new DataView(r.buffer);
    },
  };
  assert.equal(
    await new Driver(plain, model, { delay: 0, timeout: 50 }).init(),
    2,
  );
  const prefixed64 = {
    ...device,
    async receiveFeatureReport() {
      const r = new Uint8Array(64);
      r[1] = 0xa1;
      r[5] = 0;
      r[6] = 0x85;
      r[7] = 3;
      return new DataView(r.buffer);
    },
  };
  assert.equal(
    await new Driver(prefixed64, model, { delay: 0, timeout: 50 }).init(),
    3,
  );
  let reads=0;
  const stale={...device,async receiveFeatureReport(){const r=new Uint8Array(64);r[0]=0xa1;r[4]=1;r[5]=0x80;r[6]=++reads===1?2:1;r[7]=4;return new DataView(r.buffer);}};
  const staleDriver=new Driver(stale,model,{delay:0,timeout:50}); staleDriver.profile=1;
  assert.equal(await staleDriver._run(()=>staleDriver._value(1,0x80)),4);
  assert.equal(reads,2);
  console.log("WLmouse protocol fixtures passed");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
