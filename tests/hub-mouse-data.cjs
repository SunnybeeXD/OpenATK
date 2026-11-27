const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../mouse/index.html'),'utf8');
const grab=name=>JSON.parse(new RegExp('const '+name+' = (\\{.*?\\});\\n','s').exec(html)[1]);
const REGISTRY=grab('REGISTRY'),SKINS=grab('SKINS');
const labels=key=>{const i=key.startsWith('cx:')||key.startsWith('bm:')?SKINS.cid[key]:SKINS.pid[key];return SKINS.sets[i].map(x=>x[0]);};
const colors=key=>{const i=key.startsWith('cx:')||key.startsWith('bm:')?SKINS.cid[key]:SKINS.pid[key];return SKINS.sets[i].map(x=>x[1].toLowerCase());};
test('every skin set is non-empty and every item has a label, a hex color and an O or H image',()=>{
  SKINS.sets.forEach((set,i)=>{
    assert.ok(set.length>0,`set ${i} is empty`);
    for(const [label,color,url] of set){
      assert.ok(label&&label.trim(),`set ${i} has an empty label`);
      assert.match(color,/^#[0-9a-fA-F]{6,8}$/,`set ${i} color ${color}`);
      assert.match(url,/^[OH][A-Za-z0-9_./-]+\.(webp|png)$/,`set ${i} url ${url}`);
    }
  });
});
test('every skin mapping points at an existing set',()=>{
  for(const table of [SKINS.pid,SKINS.cid])for(const [key,i] of Object.entries(table))assert.ok(Number.isInteger(i)&&SKINS.sets[i],`${key} -> ${i}`);
});
test('registry entries are a name and a code',()=>{
  for(const table of [REGISTRY.pids,REGISTRY.cid])for(const [key,v] of Object.entries(table)){
    assert.ok(Array.isArray(v)&&v.length===2&&typeof v[0]==='string'&&v[0].trim()&&typeof v[1]==='string'&&v[1],`${key} ${JSON.stringify(v)}`);
  }
});
test('translucent and normal F1 V3 Ultimate+ keep the hub assignment',()=>{
  for(const k of ['1304','12a8','12a9','cx:1,63','cx:1,64','bm:1,17'])assert.deepEqual(labels(k),['White Translucent','Red Translucent','Green Translucent'],k);
  for(const k of ['1308','cx:1,62','bm:1,18'])assert.equal(labels(k)[0],'Black',k);
});
test('colors the hub lists for supported mice are present',()=>{
  assert.ok(colors('cx:2,133').includes('#ffff00'),'MAD R+ Yellow');
  assert.ok(colors('cx:2,128').includes('#000000'),'U2 Pro Max black');
  assert.ok(colors('cx:1,6').includes('#a4a4a4'),'A9 Ultra Max 2.0 grey');
  assert.ok(colors('cx:1,31').includes('#9be167'),'A9 Mini+ green');
  for(const k of ['cx:2,130','cx:2,136','cx:2,137'])assert.ok(colors(k).includes('#b1a8cf')&&colors(k).includes('#d1bfb4'),'VXE R1SE+ '+k);
});
test('mice that had no artwork now have a set',()=>{
  for(const k of ['cx:2,134','cx:2,135','cx:1,91','bm:2,38','bm:2,39','bm:2,40','bm:2,41','bm:1,26','bm:1,27','bm:2,43','bm:2,44'])assert.ok(SKINS.cid[k]!==undefined,k);
});
test('names the hub gives more precisely than a generic label are used',()=>{
  assert.equal(REGISTRY.cid['cx:2,133'][0],'MAD R+');
  assert.equal(REGISTRY.cid['cx:2,134'][0],'ATK A9 MAG');
  assert.equal(REGISTRY.cid['cx:2,135'][0],'ATK X1 MAG');
  assert.equal(REGISTRY.cid['cx:1,91'][0],'ATK A9 Mini SPRIGATITO Edition');
  assert.equal(REGISTRY.pids['1266'][0],'ATK PHANTOM EXTREME');
});
