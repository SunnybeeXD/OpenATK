// Run with: node --test tests/sensor-mode.cjs
// Exercise the self-contained page's actual drivers without DOM or HID hardware.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../mouse/index.html'), 'utf8');
function section(start, end){
  const from = html.indexOf(start), to = html.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `Missing source section: ${start}`);
  return html.slice(from, to);
}
function load(){
  const elements = new Map();
  const $ = id => {
    if (!elements.has(id)) elements.set(id, { children: [], textContent: 'Test mouse',
      classList: { contains: () => true } });
    return elements.get(id);
  };
  const context = vm.createContext({ $, Transport: class {} });
  vm.runInContext(section('const SENSOR_MODES =', '/* Sensor rotation')
    + section('const sum =', '\n')
    + '\n' + section('const BM_CMD =', 'let drv = null;')
    + '\nlet drv = null, lastS = null, buttons = null;\n'
    + section('const pressedVal =', 'const inVals =')
    + section('function planShare(', 'let pendingShare =')
    + '\nglobalThis.api = { CompxDriver, BitmouseDriver, CX_CMD, CX_ADDR, BM_CMD, '
    + 'compxSupportsMax, snapshot, planShare, setDriver(d){ drv = d; } };', context);
  return { ...context.api, $ };
}
function compx(api, { mode = 0, cidMid = [2,49], firmware = [3,0] } = {}){
  const d = new api.CompxDriver({}, 'B'), writes = [];
  const row = [1,84,6,79,mode,(85-mode)&255];
  const view = bytes => ({ u8: i => bytes[i] });
  d.xfer = async command => {
    if (command === api.CX_CMD.GetMouseVersion && firmware) return view(firmware);
    if (command === api.CX_CMD.GetMouseCIDMID && cidMid) return view(cidMid);
    throw new Error('Unavailable in this fixture');
  };
  d.read = async address => {
    if (address === api.CX_ADDR.sensorEnable) return view(row);
    throw new Error('Unavailable in this fixture');
  };
  d.readBattery = async () => ({});
  d.readStages = async () => [];
  d.readButtons = async () => [];
  d.write = async (addr, payload) => writes.push(d.pack(api.CX_CMD.SetEEPROM,
    { addr, len: payload.length, payload }));
  return { d, writes, row };
}
const plain = value => JSON.parse(JSON.stringify(value));

test('COMPX reads 0/1/2 as Basic/Competitive/Max and preserves unknown bytes', async () => {
  const api = load();
  for (const [wire, selected] of [[0,0],[1,4],[2,5],[4,null],[5,null],[255,null]]){
    const { d, writes, row } = compx(api, { mode: wire });
    const s = await d.readState();
    assert.equal(s.sensorMode, selected);
    assert.equal(s.sensorModeRaw, wire);
    assert.deepEqual(plain(d.sensorBlock), row);
    assert.equal(writes.length, 0, 'Reading must never repair or rewrite hardware');
  }
});

test('COMPX writes vendor bytes and inverse without changing either sleep pair', async () => {
  const api = load();
  for (const [selected, wire] of [[0,0],[4,1],[5,2]]){
    const { d, writes } = compx(api);
    await d.readState();
    await d.setSensorMode(selected);
    const frame = [...writes[0]];
    assert.deepEqual(frame.slice(0,5), [7,0,0,0xb5,6]);
    assert.deepEqual(frame.slice(5,11), [1,84,6,79,wire,85-wire]);
    assert.equal((8 + frame.reduce((a,b) => a+b, 0)) & 255, 85);
  }
});

test('COMPX reads the existing sensor row when uncached; failed reads/writes do not change it', async () => {
  const api = load();
  const { d, writes, row } = compx(api);
  await d.setSensorMode(4);
  assert.deepEqual([...writes[0]].slice(5,11), [1,84,6,79,1,84]);
  const cached = plain(d.sensorBlock);
  d.write = async () => { throw new Error('Write failed'); };
  await assert.rejects(d.setSensorMode(0), /Write failed/);
  assert.deepEqual(plain(d.sensorBlock), cached);
  d.sensorBlock = null;
  d.read = async () => { throw new Error('Read failed'); };
  await assert.rejects(d.setSensorMode(4), /Read failed/);
  assert.deepEqual(row, [1,84,6,79,0,85]);
});

test('Competitive Max follows CID and firmware thresholds, including unreadable metadata', async () => {
  const api = load();
  for (const [cid, fw, expected] of [
    ['1,22',undefined,true], ['2,49','2.99',false], ['2,49','3.00',true],
    ['2,49','3.01',true], ['2,85','1.76',false], ['2,85','1.77',true],
    ['2,114','1.00',true], ['2,78','9.99',false], ['2,999','9.99',false],
    ['2,49',undefined,false], ['2,49','bad',false], [undefined,'3.00',false],
  ]) assert.equal(api.compxSupportsMax(cid, fw), expected, `${cid} / ${fw}`);
  const { d, writes } = compx(api, { firmware: [2,0x99] });
  await d.readState();
  assert.deepEqual(plain(d.sensorModes).map(m => m[0]), [0,4]);
  assert.throws(() => d.setSensorMode(5), /not available/);
  for (const bad of [1,2,3,255,'4',null,NaN])
    assert.throws(() => d.setSensorMode(bad), /Unknown/);
  assert.equal(writes.length, 0);
  d.cidMid = '1,22'; d.mouseFirmware = '3.00';
  d.xfer = async () => { throw new Error('Read failed'); };
  await d.readState();
  assert.deepEqual(plain(d.sensorModes).map(m => m[0]), [0,4], 'Do not retain another device\'s eligibility');
});

test('BITMOUSE continues writing 0/4/5 through SetSensorModel', async () => {
  const api = load(), d = new api.BitmouseDriver({}, false), frames = [];
  d.t.send = async (command, frame) => { frames.push([...frame]); return new Uint8Array(63); };
  for (const wire of [0,4,5]){
    await d.setSensorMode(wire);
    const frame = frames.at(-1);
    assert.equal(frame[5], 0x1f);
    assert.equal(frame[7], wire);
    assert.equal(frame[0], frame.slice(1).reduce((a,b) => a+b, 0) & 255);
  }
});

test('v1 shares keep semantic 0/4/5, translate across families, and skip unsupported Max', async () => {
  const api = load();
  const { d, writes } = compx(api, { mode: 1 });
  await d.readState(); api.setDriver(d);
  api.$('#segSensorMode').children = [{ dataset: { value: '4' }, getAttribute: () => 'true' }];
  assert.equal(api.snapshot().settings.sensorMode, 4);
  const share = mode => ({ app:'openatk', v:1, kind:'mouse', settings:{ sensorMode:mode } });
  const plan = api.planShare(share(4));
  assert.equal(plan.steps.length, 1);
  assert.equal(plan.steps[0].label, 'Sensor performance: Competitive');
  await plan.steps[0].run();
  assert.equal(writes.at(-1)[9], 1);
  d.mouseFirmware = '2.99';
  const max = api.planShare(share(5));
  assert.equal(max.steps.length, 0);
  assert.match(max.notes[0], /not available/);
  for (const raw of [1,2]) assert.equal(api.planShare(share(raw)).steps.length, 0);
  api.$('#segSensorMode').children = [];
  assert.equal('sensorMode' in api.snapshot().settings, false, 'Unknown modes must not be exported');
  const bm = new api.BitmouseDriver({}, false);
  let byte;
  bm.xfer = async (cmd, opts) => { byte = opts.payload[0]; };
  api.setDriver(bm);
  await api.planShare(share(4)).steps[0].run();
  assert.equal(byte, 4);
});
