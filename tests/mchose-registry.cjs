const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

globalThis.window = {};
vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'mchose', 'registry.js'), 'utf8'));
const R = globalThis.window.MchoseModels;
const models = R.models;
const byName = (n) => models.find((m) => m.name === n);
const asc = (a) => a.every((v, i) => i === 0 || v > a[i - 1]);

const SHARED_ALLOWED = [
  '3837:4042', '3837:1014', '3837:1018', '3837:101d',
  '3837:1020', '3837:1021', '3837:100a', '3837:100b', '3837:100c', '3837:1008',
  '5253:1020', '5253:1021', 'bda:4762', 'a8a4:2255', 'a8a5:2255'
];

test('every model has id, name, family, vid, pids and caps', () => {
  for (const m of models) {
    assert.ok(m.id && m.name && m.vid, m.name);
    assert.ok(['new', 'legacy', 'g'].includes(m.family), m.name);
    assert.ok(m.pids.length >= 1 && m.wired.length >= 1, m.name);
    assert.ok(m.caps && 'rates' in m.caps, m.name);
    assert.equal(m.image, null);
    assert.equal(m.imageKey, m.id);
    assert.match(m.id, /^[a-z0-9]+$/);
    for (const p of m.pids) assert.equal(typeof p.inferred, 'boolean');
    if (m.family !== 'g') assert.ok(Array.isArray(m.caps.rates) && m.caps.rates.length, m.name);
  }
});

test('family counts', () => {
  const c = (f) => models.filter((m) => m.family === f).length;
  assert.equal(c('new'), 23);
  assert.equal(c('legacy'), 25);
  assert.equal(c('g'), 8);
});

test('ids and names are unique, aliases never collide with names', () => {
  const ids = models.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
  const names = models.flatMap((m) => [m.name, ...m.aliases].map(R.normalizeName));
  assert.equal(new Set(names).size, names.length);
  assert.deepEqual(byName('M7').aliases, ['M7 1K']);
});

test('PIDs only collide on the documented shared (vid,pid) keys, and colliders differ by name', () => {
  const seen = new Map();
  for (const m of models) {
    for (const key of new Set(m.pids.map((p) => p.vid.toString(16) + ':' + p.pid.toString(16)))) {
      if (!seen.has(key)) seen.set(key, []);
      seen.get(key).push(m);
    }
  }
  for (const [key, list] of seen) {
    if (list.length > 1) assert.ok(SHARED_ALLOWED.includes(key), 'undocumented collision ' + key + ' ' + list.map((m) => m.name));
  }
  assert.deepEqual(seen.get('3837:4042').map((m) => m.name), ['A5 V3 Ultra', 'G3 V2 Pro']);
  assert.equal(seen.get('3837:101d').length, 3);
});

test('caps sanity: DPI min < max, rates ascending, lists consistent', () => {
  for (const m of models.filter((x) => x.family !== 'g')) {
    const c = m.caps;
    assert.ok(c.dpi.min < c.dpi.max, m.name);
    assert.ok(c.dpi.defaults.length === 6 && c.dpi.defaults.every((d) => d >= c.dpi.min && d <= c.dpi.max), m.name);
    assert.ok(asc(c.rates), m.name);
    if (c.lod) assert.ok(asc(c.lod), m.name);
    assert.ok(c.debounce.min < c.debounce.max && c.sleep.min < c.sleep.max, m.name);
    for (const p of m.pids) assert.ok(c.rates.includes(p.rateMax), m.name + ' ' + p.pid);
    if (c.wirelessMaxRate) assert.ok(c.rates.includes(c.wirelessMaxRate) && c.wirelessMaxRate < c.rates[c.rates.length - 1]);
  }
});

test('G7 Max stays protocol pending with null caps', () => {
  const c = byName('G7 Max').caps;
  assert.equal(c.rates, null);
  assert.equal(c.dpi, null);
  assert.equal(c.extra.protocolPending, true);
  assert.equal(c.extra.reason, 'write-only protocol, not supported');
});

test('G-series caps follow the gmouse sub-app', () => {
  const gs = models.filter((x) => x.family === 'g' && x.name !== 'G7 Max');
  assert.equal(gs.length, 7);
  for (const m of gs) {
    const c = m.caps;
    assert.equal(c.extra.protocolPending, undefined, m.name);
    assert.deepEqual(c.rates, [125, 250, 500, 1000]);
    assert.equal(c.profiles, 1);
    assert.equal(c.dpi.step, 50);
    assert.equal(c.dpi.maxStages, 6);
    assert.equal(c.dpi.independentXY, false);
    assert.deepEqual(c.debounce, { min: 0, max: 20, step: 1, split: false });
    assert.deepEqual(c.sleep, { min: 1, max: 100, never: true });
    assert.equal(c.glass, null);
  }
  for (const n of ['G3 V2 Pro', 'G7 Pro']) {
    const c = byName(n).caps;
    assert.equal(c.dpi.max, 26000);
    assert.deepEqual(c.lod, [1, 2]);
    assert.equal(c.modes.length, 2);
    assert.ok(c.motionSync && c.ripple && c.angleSnap && c.rotation);
    assert.equal(c.extra.rotationMinFw, '2.3.5');
  }
  const v2 = byName('G3 V2').caps;
  assert.equal(v2.dpi.max, 12000);
  assert.ok(!v2.lod && !v2.modes && !v2.motionSync && !v2.ripple && !v2.angleSnap && !v2.rotation);
  for (const n of ['G3 A', 'G7', 'A7e', 'A7e Pro']) {
    const c = byName(n).caps;
    assert.equal(c.dpi.max, 12000);
    assert.equal(c.angleSnap, true);
    assert.ok(!c.lod && !c.modes && !c.motionSync && !c.ripple && !c.rotation);
  }
});

test('new family specifics', () => {
  assert.deepEqual(byName('V7').caps.rates, [125, 500, 1000]);
  assert.deepEqual(byName('A5 V3 Pro').caps.rates, [125, 500, 1000, 2000, 4000, 8000]);
  assert.equal(byName('K5 V2').receiver.join(), '4124');
  assert.deepEqual(byName('A5 V3 Ultra').caps.lod, [0.7, 0.9, 1.2, 1.4, 1.7]);
  assert.equal(byName('V7').caps.modes.length, 2);
  assert.equal(byName('K7 V2 Pro').caps.extra.adaptivePowerMinFw, '4');
  for (const n of ['G3 V3', 'G3 S']) {
    const c = byName(n).caps;
    assert.equal(c.dpi.independentXY, false);
    assert.equal(c.lod, null);
    assert.equal(c.modes, null);
    assert.ok(!c.motionSync && !c.ripple && !c.angleSnap && !c.glass && !c.rotation);
    assert.ok(c.debounce && c.sleep && c.rates);
  }
  assert.equal(byName('G3 V3').caps.dpi.max, 12000);
  assert.equal(byName('G3 S').caps.dpi.max, 18000);
});

test('legacy rate caps follow the connected pid', () => {
  const m7 = byName('M7');
  assert.deepEqual(R.ratesFor(m7, 0x1021), [125, 500, 1000]);
  assert.equal(R.ratesFor(m7, 0x1020).at(-1), 8000);
  assert.equal(m7.caps.wirelessMaxRate, 1000);
  assert.equal(R.ratesFor(byName('M7 Pro'), 0x20).at(-1), 8000);
  assert.equal(R.ratesFor(byName('A5 V2 Ultra'), 0x1102).at(-1), 4000);
  assert.equal(byName('A5 V2 Ultra').caps.wirelessMaxRate, 4000);
});

test('inferred flags: legacy 0x5253 and G dongles are flagged, new family is not', () => {
  assert.ok(byName('M7').pids.every((p) => p.inferred));
  assert.ok(byName('L7 Pro+').pids[0].inferred === false);
  assert.ok(byName('G3 V2').pids[1].inferred && !byName('G3 V2').pids[0].inferred);
  assert.ok(byName('G7 Max').receiver.length === 2 && byName('G7 Max').pids.slice(1).every((p) => p.inferred));
  assert.ok(byName('A5 ultra').pids[0].inferred);
  assert.ok(byName('K7 Ultra').pids.find((p) => p.pid === 0x1020).inferred === false);
  assert.ok(models.filter((m) => m.family === 'new').every((m) => m.pids.every((p) => !p.inferred)));
});

const dev = (vendorId, productId, productName) => ({ vendorId, productId, productName });
const hit = (d) => { const r = R.find(d); return r && [r.model.name, r.connection]; };

test('find: new family wired, receiver and shared receiver by name', () => {
  assert.deepEqual(hit(dev(0x3837, 0x4035, 'MCHOSE A5 V3 Pro')), ['A5 V3 Pro', 'wired']);
  assert.deepEqual(hit(dev(0x3837, 0x402A, '')), ['V7', 'wired']);
  assert.deepEqual(hit(dev(0x3837, 0x1016, '')), ['V7', 'receiver']);
  assert.deepEqual(hit(dev(0x3837, 0x101C, '')), ['K5 V2', 'receiver']);
  assert.deepEqual(hit(dev(0x3837, 0x101D, 'MCHOSE G3 S')), ['G3 S', 'receiver']);
  assert.deepEqual(hit(dev(0x3837, 0x1014, 'MCHOSE A7 V3-X')), ['A7 V3-X', 'receiver']);
});

test('find: shared PID without a matching name is refused, never guessed', () => {
  assert.equal(R.find(dev(0x3837, 0x101D, '')), undefined);
  assert.equal(R.find(dev(0x3837, 0x1014, 'Something Else')), undefined);
  assert.equal(R.find(dev(0x3837, 0x4042, '')), undefined);
  assert.equal(R.find(dev(0x1234, 0x4035, '')), undefined);
  assert.equal(R.find(null), undefined);
});

test('find: 0x4042 is A5 V3 Ultra or G3 V2 Pro by product name only', () => {
  assert.deepEqual(hit(dev(0x3837, 0x4042, 'MCHOSE A5 V3 Ultra')), ['A5 V3 Ultra', 'wired']);
  assert.deepEqual(hit(dev(0x3837, 0x4042, 'MCHOSE G3 V2 Pro')), ['G3 V2 Pro', 'wired']);
});

test('find: legacy rows, aliases and prefixes', () => {
  assert.deepEqual(hit(dev(0x5253, 0x20, 'MCHOSE M7 1K')), ['M7', 'wired']);
  assert.deepEqual(hit(dev(0x5253, 0x1021, 'RealTek MCHOSE M7')), ['M7', 'receiver']);
  assert.deepEqual(hit(dev(0x3837, 0x4018, 'MCHOSE A7 V2 Pro')), ['A7 V2 Pro', 'wired']);
  assert.deepEqual(hit(dev(0x3837, 0x4150, '')), ['K7 Ultra', 'wired']);
  assert.deepEqual(hit(dev(0x41E4, 0x1102, '')), ['A5 V2 Ultra', 'receiver']);
  assert.deepEqual(hit(dev(0x0BDA, 0x4762, 'G3 Mouse 4K')), ['G3 Mouse', 'wired']);
  assert.deepEqual(hit(dev(0x0BDA, 0x4762, 'MCHOSE G3 Ultra 4K')), ['G3 Ultra 4K', 'wired']);
  assert.deepEqual(hit(dev(0x3837, 0x4010, '')), ['AX5 V2', 'wired']);
});

test('find: G series by pid, with name tiebreak for shared pids', () => {
  assert.deepEqual(hit(dev(0x3837, 0x418C, '')), ['G3 V2', 'wired']);
  assert.deepEqual(hit(dev(0x3837, 0x4012, '')), ['A7e', 'wired']);
  assert.deepEqual(hit(dev(0x3837, 0x1008, 'MCHOSE A7e Pro')), ['A7e Pro', 'receiver']);
  assert.deepEqual(hit(dev(0xA8A4, 0x2255, 'MCHOSE G7 Pro')), ['G7 Pro', 'wired']);
  assert.deepEqual(hit(dev(0xA8A4, 0x2255, 'MCHOSE G7')), ['G7', 'wired']);
  assert.deepEqual(hit(dev(0xA8A5, 0x2255, 'MCHOSE 2.4G Wireless')), ['G3 A', 'receiver']);
  assert.equal(R.find(dev(0xA8A4, 0x2255, '')), undefined);
  assert.deepEqual(hit(dev(0x41E4, 0x1204, '')), ['G7 Max', 'wired']);
});

test('find: same pid as wired and receiver on one model resolves to wired', () => {
  assert.equal(R.find(dev(0x0BDA, 0x4762, 'G3 Mouse')).connection, 'wired');
});
