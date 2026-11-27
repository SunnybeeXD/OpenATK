const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../keyboard/index.html'),'utf8');
const grab=name=>JSON.parse(new RegExp('const '+name+' = (\\{.*?\\});\\n','s').exec(html)[1]);
const REGISTRY=grab('REGISTRY'),SKINS=grab('SKINS');
const labels=pid=>SKINS.sets[SKINS.pid[pid]].map(x=>x[0]);
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
test('every skin mapping points at an existing set and a registered keyboard',()=>{
  for(const [pid,i] of Object.entries(SKINS.pid)){assert.ok(Number.isInteger(i)&&SKINS.sets[i],`${pid} -> ${i}`);assert.ok(REGISTRY[pid],`${pid} has a skin but no registry entry`);}
});
test('registry entries have a name, a matrix and a layer count',()=>{
  for(const [pid,v] of Object.entries(REGISTRY)){
    assert.ok(v.n&&v.n.trim()===v.n,`${pid} name`);
    if(v.m){assert.ok(Array.isArray(v.m)&&v.m.length===2&&v.m.every(Number.isInteger)&&v.m.every(n=>n>0),`${pid} matrix`);assert.ok(Number.isInteger(v.l)&&v.l>0,`${pid} layers`);}
  }
});
test('the RS7 and ATK68 V2 Pro skins are no longer swapped',()=>{
  assert.deepEqual(labels('1044'),['Rainbow','Extreme Speed']);
  assert.deepEqual(labels('1048'),['White Blue','Black Orange','Silver Blue']);
});
test('Hex80 V2 has the Silver skin and its own name',()=>{
  for(const pid of ['12ac','12be','1334']){assert.ok(labels(pid).includes('Anode Silver'),pid);assert.equal(REGISTRY[pid].n,'Hex80 V2');}
});
test('RS7 V3 from the earlier change is still there',()=>{
  for(const pid of ['132c','132d','137a']){assert.equal(REGISTRY[pid].n,'ATK RS7 V3');assert.deepEqual(labels(pid),['Midnight Black','Silver Blade White','Silver Knight']);}
});
test('keyboards that had no artwork now have a set',()=>{
  for(const pid of ['1160','12cf','130a','1330','1318','12a0','12a1','12ca','12cb','1351','1255','119b','119c','11ff','1200','1352'])assert.ok(SKINS.pid[pid]!==undefined,pid);
  assert.deepEqual(labels('1160'),['Wolf Team Co-Branding Edition','Leviathan Co-Branded']);
  assert.ok(labels('11a8').length===7);
});
test('new keyboards come in with the hub matrix',()=>{
  assert.deepEqual(REGISTRY['12b2'],{n:'RS 63',m:[5,14],l:4,g:'RS63'});
  assert.deepEqual(REGISTRY['1362'],{n:'RS 63',m:[5,14],l:4,g:'RS63'});
  assert.deepEqual(REGISTRY['1352'],{n:'RX75 Turbo',m:[6,15],l:4,g:'RX75-Turbo'});
});
test('generic names are replaced by the hub names',()=>{
  assert.equal(REGISTRY['12ad'].n,'VELOTA NOTHING 68');
  assert.equal(REGISTRY['12fc'].n,'VELOTA HALO 68');
  assert.equal(REGISTRY['1151'].n,'ATK A98 Pro');
});
