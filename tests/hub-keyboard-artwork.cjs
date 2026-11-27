const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../keyboard/index.html'),'utf8');
const grab=name=>JSON.parse(new RegExp('const '+name+' = (\\{.*?\\});\\n','s').exec(html)[1]);
const SKINS=grab('SKINS');
const set=pid=>SKINS.sets[SKINS.pid[pid]];
test('no skin uses the old hashed Sea Salt file',()=>{
  for(const s of SKINS.sets)for(const x of s)assert.notEqual(x[2],'Hsea-salt-eMSIYTcZ.png');
});
test('A98 Sea Salt uses the hub 3.2.34 image and keeps its label',()=>{
  const x=set('1151').find(i=>i[2]==='Oa98/sea-salt.webp');
  assert.ok(x);
  assert.equal(x[1].toLowerCase(),'#a29cd5');
  assert.equal(x[0],'sea-salt');
});
test('the A98 keyboards keep their number of skins',()=>{
  const n={'114d':5,'114e':5,'1151':5,'1152':5,'1243':5,'1244':5};
  for(const [pid,c] of Object.entries(n))assert.equal(set(pid).length,c,pid);
});
