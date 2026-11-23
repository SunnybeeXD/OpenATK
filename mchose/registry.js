(function () {
  var V = 0x3837, RT = 0x5253, E4 = 0x41E4, BD = 0x0BDA;
  var R1 = [125, 500, 1000];
  var R4 = R1.concat([2000, 4000]);
  var R8 = R4.concat([8000]);
  var RATE_LISTS = { 1000: R1, 4000: R4, 8000: R8 };
  var MODES = [
    { id: 0, name: 'Performance Mode' },
    { id: 1, name: 'Gaming Mode' },
    { id: 2, name: 'Extreme Mode' }
  ];
  var FILTERS_STD = [{ usagePage: 0xFF01 }, { usagePage: 0xFF0B }];
  var FILTERS_G = [{ usagePage: 0xFF01, usage: 0x10 }];
  var FILTERS_G7MAX = [{ usagePage: 0xFF00 }];
  var L2 = [1, 2], L3 = [0.7, 1, 2], L5 = [0.7, 0.9, 1.2, 1.4, 1.7];

  function slug(name) {
    return name.toLowerCase().replace(/\+/g, 'plus').replace(/[^a-z0-9]/g, '');
  }

  function pe(pid, vid, role, rateMax, inferred) {
    return { pid: pid, vid: vid, role: role, rateMax: rateMax, inferred: !!inferred };
  }

  function build(o) {
    var pids = o.pids;
    var wired = [], receiver = [];
    pids.forEach(function (p) {
      var list = p.role === 'wired' ? wired : receiver;
      if (list.indexOf(p.pid) < 0) list.push(p.pid);
    });
    var rates = pids.map(function (p) { return p.rateMax; }).filter(function (r) { return r; });
    var caps = o.caps;
    if (rates.length) {
      var top = Math.max.apply(null, rates);
      var rec = pids.filter(function (p) { return p.role === 'receiver' && p.rateMax; })
        .map(function (p) { return p.rateMax; });
      caps.rates = RATE_LISTS[top].slice();
      caps.wirelessMaxRate = rec.length && Math.min.apply(null, rec) < top ? Math.min.apply(null, rec) : null;
    } else {
      caps.rates = null;
      caps.wirelessMaxRate = null;
    }
    var id = slug(o.name);
    return {
      id: id, name: o.name, aliases: o.aliases || [], family: o.family,
      vid: pids[0].vid, wired: wired, receiver: receiver, pids: pids,
      filters: o.filters, caps: caps, image: null, imageKey: id
    };
  }

  function dpiCaps(max, independentXY) {
    return {
      min: 200, max: max, step: 1, maxStages: 6,
      defaults: [400, 800, 1600, 3200, 6400, max], independentXY: independentXY
    };
  }

  function newModel(name, wiredPid, recPids, o) {
    var wch = o.chip === 'wch';
    var mini = o.mini;
    var rate = wch ? 1000 : 8000;
    var pids = [pe(wiredPid, V, 'wired', rate)];
    recPids.forEach(function (p) { pids.push(pe(p, V, 'receiver', rate)); });
    return build({
      name: name, family: 'new', pids: pids, filters: FILTERS_STD,
      caps: {
        dpi: dpiCaps(o.dpi, !mini),
        lod: mini ? null : o.lod,
        debounce: { min: 1, max: 20, step: 1, split: true },
        sleep: { min: 1, max: 100, never: true },
        modes: mini ? null : (wch ? MODES.slice(0, 2) : MODES.slice()),
        motionSync: !mini, ripple: !mini, angleSnap: !mini,
        glass: !mini && !!o.glass, rotation: !mini,
        profiles: 3, remap: true,
        extra: {
          chip: wch ? 'wch' : 'nordic',
          sensorClass: o.sensor || null,
          lodCommand: o.lod === L5 ? 'lodIndex' : (mini ? null : 'sensorBits'),
          dpiKey: !!o.dpiKey,
          adaptivePowerMinFw: o.adaptive || null,
          magDock: !!o.mag,
          rotationRange: mini ? null : 30,
          debounceSides: 'leftRight',
          inferred: ['chip', 'sensorClass', 'dpiStep', 'sleepRange', 'rotationUnit']
        }
      }
    });
  }

  var RECV_8K = [0x1014, 0x1018];
  var N = function (name, w, rec, o) { return newModel(name, w, rec || RECV_8K, o); };

  var models = [
    N('A5 V3 Pro', 0x4035, 0, { dpi: 26000, lod: L2, sensor: '3395', dpiKey: 1 }),
    N('A5 V3 Ultra', 0x4042, 0, { dpi: 50000, lod: L5, glass: 1, sensor: '3955', dpiKey: 1 }),
    N('A5 V3 Ultra+', 0x4026, 0, { dpi: 42000, lod: L3, glass: 1, dpiKey: 1, mag: 1 }),
    N('A5 V3 Ultra+(3955)', 0x4034, 0, { dpi: 50000, lod: L5, glass: 1, sensor: '3955', dpiKey: 1, mag: 1 }),
    N('K7 V2 Pro', 0x403B, 0, { dpi: 26000, lod: L2, sensor: '3395', dpiKey: 1, adaptive: '4' }),
    N('K7 V2 Pro+', 0x4027, 0, { dpi: 42000, lod: L3, glass: 1, dpiKey: 1, mag: 1 }),
    N('K7 V2 Ultra', 0x403C, 0, { dpi: 50000, lod: L5, glass: 1, sensor: '3955', dpiKey: 1 }),
    N('K7 V2 Ultra+', 0x4028, 0, { dpi: 50000, lod: L5, glass: 1, sensor: '3955', dpiKey: 1, mag: 1 }),
    N('A7 V3', 0x4030, 0, { dpi: 26000, lod: L2, sensor: '3395', dpiKey: 1 }),
    N('A7 V3 Pro', 0x4031, 0, { dpi: 42000, lod: L3, glass: 1, dpiKey: 1 }),
    N('A7 V3 Pro+', 0x4032, 0, { dpi: 42000, lod: L3, glass: 1, dpiKey: 1, mag: 1 }),
    N('A7 V3 Ultra', 0x403D, 0, { dpi: 50000, lod: L5, glass: 1, sensor: '3955', dpiKey: 1 }),
    N('A7 V3 Ultra+', 0x4033, 0, { dpi: 50000, lod: L5, glass: 1, sensor: '3955', dpiKey: 1, mag: 1 }),
    N('A7 V3-X', 0x403A, 0, { dpi: 50000, lod: L5, glass: 1, sensor: '3955', dpiKey: 1, mag: 1 }),
    N('A7 Magnetic', 0x403F, 0, { dpi: 50000, lod: L5, glass: 1, sensor: '3955' }),
    N('K5 V2', 0x4040, [0x101C], { dpi: 42000, lod: L3, sensor: '3395' }),
    N('K5 Pro', 0x4037, 0, { dpi: 26000, lod: L2, sensor: '3395', dpiKey: 1, adaptive: '13' }),
    N('K5 Ultra', 0x4038, 0, { dpi: 50000, lod: L5, glass: 1, sensor: '3955', dpiKey: 1, adaptive: '12' }),
    N('R7 Ultra', 0x4036, 0, { dpi: 50000, lod: L5, glass: 1, sensor: '3955' }),
    N('V7', 0x402A, [0x1016], { chip: 'wch', dpi: 26000, lod: L2, sensor: '3395' }),
    N('V7 Pro', 0x403E, [0x101D], { chip: 'wch', dpi: 42000, lod: L3, glass: 1 }),
    N('G3 V3', 0x4029, [0x101D], { chip: 'wch', dpi: 12000, mini: 1, sensor: '3395' }),
    N('G3 S', 0x4041, [0x101D], { chip: 'wch', dpi: 18000, mini: 1, sensor: '3395' })
  ];

  function legacyModel(name, o) {
    var pids = [pe(o.w[0], o.w[1], 'wired', o.w[2], o.w[3])];
    o.r.forEach(function (r) { pids.push(pe(r[0], r[1], 'receiver', r[2], r[3])); });
    var mode = o.mode || 'esports';
    return build({
      name: name, aliases: o.aliases, family: 'legacy', pids: pids, filters: FILTERS_STD,
      caps: {
        dpi: dpiCaps(o.dpi, null),
        lod: o.dpi === 42000 ? L3 : L2,
        debounce: { min: 1, max: 20, step: 1, split: false },
        sleep: { min: 1, max: 100, never: true },
        modes: mode === 'esports' ? null : MODES.slice(),
        motionSync: true, ripple: true, angleSnap: true, glass: false, rotation: true,
        profiles: 3, remap: true,
        extra: {
          esports: mode !== 'always',
          modesMinFw: mode === 'always' || mode === 'esports' ? null : mode,
          switchProfileMinFw: o.sw || null,
          magDock: !!o.mag,
          rotationRange: 30,
          independentXYFromFirmware: true,
          inferred: ['sleepRange', 'debounceMin', 'dpiStep', 'rotationUnit']
        }
      }
    });
  }

  var K1 = 1000, K4 = 4000, K8 = 8000;
  var R_STD = function (a, b) { return [[0x1021, RT, a, 1], [0x1020, RT, b, 1]]; };
  var R_V2 = [[0x100A, V, K1], [0x100B, V, K8], [0x1020, RT, K8, 1]];

  var legacy = [
    ['M7', { aliases: ['M7 1K'], w: [0x20, RT, K1, 1], r: R_STD(K1, K8), dpi: 26000, mode: '5.10.6.4' }],
    ['M7 Pro', { w: [0x30, RT, K8, 1], r: R_STD(K1, K8), dpi: 26000, mode: '5.8.6.4' }],
    ['M7 Ultra', { w: [0x31, RT, K8, 1], r: R_STD(K1, K8), dpi: 42000, mode: 'always' }],
    ['L7', { w: [0xC0, RT, K1, 1], r: R_STD(K1, K8), dpi: 26000, mode: '5.16.4.4' }],
    ['L7 Pro', { w: [0xB0, RT, K8, 1], r: R_STD(K1, K8), dpi: 26000, mode: '5.12.4.4' }],
    ['L7 Pro+', { w: [0x4015, V, K8], r: R_STD(K1, K8), dpi: 26000, mode: '5.32.4.4' }],
    ['L7 Ultra', { w: [0xB1, RT, K8, 1], r: R_STD(K1, K8), dpi: 42000, mode: 'always' }],
    ['L7 Ultra+', { w: [0x4016, V, K8], r: R_STD(K1, K8), dpi: 42000, mode: 'always' }],
    ['A7', { w: [0x70, RT, K1, 1], r: R_STD(K1, K8), dpi: 26000, mode: '5.6.6.4', sw: '5.6.7.4' }],
    ['A7 Pro', { w: [0x10, RT, K8, 1], r: R_STD(K1, K8), dpi: 26000, mode: '5.4.6.4', sw: '5.4.7.4' }],
    ['A7 Ultra', { w: [0x11, RT, K8, 1], r: R_STD(K1, K8), dpi: 42000, mode: 'always', sw: '5.0.7.4' }],
    ['A7 V2 Pro', { w: [0x4018, V, K8], r: R_V2, dpi: 26000, mode: '5.42.1.4', sw: '5.42.2.4' }],
    ['A7 V2 Pro+', { w: [0x4023, V, K8], r: [[0x100A, V, K1], [0x100B, V, K8], [0x1020, RT, K8]], dpi: 26000, mode: '5.48.1.4', sw: '5.48.2.4', mag: 1 }],
    ['A7 V2 Ultra', { w: [0x4019, V, K8], r: R_V2, dpi: 42000, mode: 'always', sw: '5.44.2.4' }],
    ['A7 V2 Ultra+', { w: [0x4021, V, K8], r: [[0x100A, V, K1], [0x100B, V, K8], [0x1020, RT, K8]], dpi: 42000, mode: 'always', sw: '5.46.2.4', mag: 1 }],
    ['A7X Ultra', { w: [0x4011, V, K8], r: [[0x100A, V, K1], [0x1009, V, K8]], dpi: 42000, mode: 'always' }],
    ['A7 Ultra(RE)', { w: [0x4110, V, K8], r: R_STD(K1, K8), dpi: 42000, mode: 'always', sw: '5.26.5.0' }],
    ['K7 Ultra', { w: [0x4150, V, K8], r: [[0x1001, V, K8], [0x1021, RT, K1], [0x1020, RT, K8]], dpi: 42000, mode: 'always', mag: 1 }],
    ['A5 V3', { w: [0x4022, V, K8], r: [[0x100A, V, K1], [0x100B, V, K8]], dpi: 26000, mode: '2.8.1.4' }],
    ['A5 V2 Ultra', { w: [0x1101, E4, K8], r: [[0x1102, E4, K4], [0x100C, V, K4]], dpi: 26000 }],
    ['A5 ultra', { w: [0x2B67, BD, K8, 1], r: [[0x4762, BD, K4], [0x100C, V, K4, 1]], dpi: 26000 }],
    ['G3 Ultra 8K', { w: [0x4762, BD, K8], r: [[0x4762, BD, K8], [0x1020, RT, K8, 1]], dpi: 26000 }],
    ['G3 Ultra 4K', { w: [0x4762, BD, K8], r: [[0x4762, BD, K8], [0x1020, RT, K8, 1], [0x100C, V, K4, 1]], dpi: 26000 }],
    ['G3 Mouse', { aliases: ['G3 Mouse 8K', 'G3 Mouse 4K'], w: [0x4762, BD, K8], r: [[0x4762, BD, K8], [0x1020, RT, K8, 1]], dpi: 26000 }],
    ['AX5 V2', { w: [0x4010, V, K8], r: [[0x00A1, RT, K8, 1], [0x1021, RT, K1, 1], [0x1020, RT, K8, 1]], dpi: 42000, mode: 'always' }]
  ];
  legacy.forEach(function (row) { models.push(legacyModel(row[0], row[1])); });

  var G_RATES = [125, 250, 500, 1000];
  var G_MODES = [{ id: 0, name: 'Standard' }, { id: 1, name: 'eSports mode' }];

  function gModel(name, pids, o) {
    o = o || {};
    var m = build({
      name: name, aliases: o.aliases, family: 'g', pids: pids,
      filters: o.filters || FILTERS_G,
      caps: {
        dpi: null, lod: null, debounce: null, sleep: null, modes: null,
        motionSync: null, ripple: null, angleSnap: null, glass: null, rotation: null,
        profiles: null, remap: null,
        extra: { protocolPending: true, reason: 'write-only protocol, not supported' }
      }
    });
    if (o.tier) {
      var pro = o.tier === 'pro', base = o.tier === 'simple';
      var max = pro ? 26000 : 12000;
      m.caps = {
        dpi: { min: 200, max: max, step: 50, maxStages: 6, defaults: [400, 800, 1600, 3200, 6400, max], independentXY: false },
        rates: G_RATES.slice(), wirelessMaxRate: null,
        lod: pro ? [1, 2] : null,
        debounce: { min: 0, max: 20, step: 1, split: false },
        sleep: { min: 1, max: 100, never: true },
        modes: pro ? G_MODES.slice() : null,
        motionSync: pro ? true : null, ripple: pro ? true : null,
        angleSnap: pro || base ? true : null,
        glass: null, rotation: pro ? true : null,
        profiles: 1, remap: null,
        extra: {
          scrollDirection: true,
          rotationRange: pro ? 30 : null,
          rotationMinFw: pro ? '2.3.5' : null,
          wiredRateFixed: 1000,
          inferred: ['dpiStep', 'sleepUnit', 'rotationUnit', 'rateCodes125to1000']
        }
      };
    }
    return m;
  }

  var GA = 0xA8A4, GB = 0xA8A5;
  [
    gModel('G3 V2 Pro', [pe(0x4042, V, 'wired')], { tier: 'pro' }),
    gModel('G3 V2', [pe(0x418C, V, 'wired'), pe(0x4245, V, 'receiver', null, 1)], { tier: 'reduced' }),
    gModel('A7e Pro', [pe(0x4013, V, 'wired'), pe(0x1008, V, 'receiver', null, 1)], { tier: 'simple' }),
    gModel('A7e', [pe(0x4012, V, 'wired'), pe(0x1008, V, 'receiver', null, 1)], { tier: 'simple' }),
    gModel('G3 A', [pe(0x2255, GA, 'wired'), pe(0x2255, GB, 'receiver')], { aliases: ['2.4G Wireless'], tier: 'simple' }),
    gModel('G7', [pe(0x2255, GA, 'wired'), pe(0x2255, GB, 'receiver')], { tier: 'simple' }),
    gModel('G7 Pro', [pe(0x2255, GA, 'wired'), pe(0x2255, GB, 'receiver')], { tier: 'pro' }),
    gModel('G7 Max', [pe(0x1204, E4, 'wired'), pe(0x1001, E4, 'receiver', null, 1), pe(0x1003, E4, 'receiver', null, 1)],
      { filters: FILTERS_G7MAX })
  ].forEach(function (m) { models.push(m); });

  function norm(s) {
    return String(s || '').toLowerCase().replace(/^((mchose|realtek|yjx-chip)\s+)+/, '').replace(/\s+/g, ' ').trim();
  }

  function find(device) {
    if (!device) return undefined;
    var hits = [];
    models.forEach(function (m) {
      for (var i = 0; i < m.pids.length; i++) {
        var p = m.pids[i];
        if (p.vid === device.vendorId && p.pid === device.productId) {
          hits.push({ model: m, connection: p.role });
          return;
        }
      }
    });
    if (hits.length > 1) {
      var n = norm(device.productName);
      hits = hits.filter(function (h) {
        return [h.model.name].concat(h.model.aliases).some(function (a) { return norm(a) === n; });
      });
    }
    return hits.length === 1 ? hits[0] : undefined;
  }

  function ratesFor(model, pid) {
    var caps = model.caps;
    if (!caps.rates) return null;
    var p = model.pids.filter(function (e) { return e.pid === pid; })[0];
    return RATE_LISTS[p && p.rateMax ? p.rateMax : caps.rates[caps.rates.length - 1]].slice();
  }

  var root = typeof window !== 'undefined' ? window : globalThis;
  root.MchoseModels = { models: models, find: find, ratesFor: ratesFor, normalizeName: norm };
})();
