const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../mouse/index.html'),'utf8');
const grab=name=>JSON.parse(new RegExp('const '+name+' = (\\{.*?\\});\\n','s').exec(html)[1]);
const REGISTRY=grab('REGISTRY'),SKINS=grab('SKINS');
const setOf=key=>{const i=key.startsWith('cx:')||key.startsWith('bm:')?SKINS.cid[key]:SKINS.pid[key];return SKINS.sets[i].map(x=>x[0]);};
test('0x1345 F1 V3 Ultimate+ is a bitmouse 3955 Master with the translucent set',()=>{
  assert.deepEqual(REGISTRY.pids['1345'],['ATK F1 V3 ULTIMATE+','bmuM']);
  assert.deepEqual(REGISTRY.cid['bm:1,28'],['ATK F1 V3 ULTIMATE+','uM']);
  for(const k of ['1345','bm:1,28'])assert.deepEqual(setOf(k),['White Translucent','Red Translucent','Green Translucent'],k);
});
test('0x1372 keeps the generic name and has no skins',()=>{
  assert.deepEqual(REGISTRY.pids['1372'],['ATK Mouse','bmuM']);
  assert.deepEqual(REGISTRY.cid['bm:1,35'],['ATK Mouse','uM']);
  assert.equal(SKINS.pid['1372'],undefined);
  assert.equal(SKINS.cid['bm:1,35'],undefined);
});
test('0x1376 X1 V3 SE NK is a bitmouse CORE26K (group X) with black and white',()=>{
  assert.deepEqual(REGISTRY.pids['1376'],['ATK X1 V3 SE NK','bmX']);
  assert.deepEqual(REGISTRY.cid['bm:2,50'],['ATK X1 V3 SE NK','X']);
  for(const k of ['1376','bm:2,50']){
    const labels=setOf(k);
    assert.ok(labels.length>0&&labels.every(l=>l.startsWith('Black')||l.startsWith('White')),k+' '+labels.join('|'));
  }
});
test('devices on other hub protocols (usagePage 65296 / 65440) were not added',()=>{
  for(const p of ['1147','10d8','10ec','112d'])assert.equal(REGISTRY.pids[p],undefined,p);
});
