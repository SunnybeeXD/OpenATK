const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../keyboard/index.html'),'utf8');
const stub=new Proxy(function(){},{get:(t,k)=>k===Symbol.toPrimitive?()=>'':stub,apply:()=>stub,set:()=>true});
function load(){
  const src=html.slice(html.indexOf('const VID = 0x373B;'),html.indexOf('let kb = null;'));
  const context=vm.createContext({Uint8Array,DataView,setTimeout,clearTimeout,Promise,Math,Number,Array,Map,Set,URLSearchParams,$:()=>stub,document:stub,console,navigator:{},location:{search:''}});
  vm.runInContext(src+'\nglobalThis.api={Keyboard,GP,GP_TARGETS,GP_PRESETS,CH_GP};',context);
  return context.api;
}
const api=load();
const C=14;
function fixture({supported=true,corrupt=null}={}){
  const sent=[];
  const st={mode:2,angle:[45,45],square:[0,0],extreme:[0,0],ko:0,en:0,map:{},curves:[0,1,2,3].map(()=>[100,0,20,142,4,85,185,8,170,228,12,255])};
  const dev={oninputreport:null,
    async sendReport(id,buf){
      const b=Array.from(buf);sent.push(b);
      if(!supported)return;
      const r=b.slice();
      if(b[0]===3&&b[1]===0x96&&b[2]===0x4E){}
      else if((b[0]===2||b[0]===3)&&b[1]===0x96&&b[2]===0x4C){
        const set=b[0]===3,row=b[3],col=b[4],sub=b[5];
        if(sub===1){const k=row*C+col;if(set&&corrupt!=='map')st.map[k]=b[6];r[6]=st.map[k]??0;}
        else if(sub===2&&set)st.map={};
        else if(sub===3){[r[6],r[7],r[8],r[9],r[10],r[11],r[12],r[13],r[14]]=[st.mode,...st.angle,...st.square,...st.extreme,st.ko,st.en];}
        else if(sub===0&&set)st.mode=b[6];
        else if(sub===4&&set&&corrupt!=='angle')st.angle[row]=b[6];
        else if(sub===5&&set)st.square[row]=b[6];
        else if(sub===6&&set)st.extreme[row]=b[6];
        else if(sub===7&&set)st.ko=b[6];
        else if(sub===8&&set)st.en=b[6];
        else if(sub===9){const cv=st.curves[row];if(set&&corrupt!=='curve')for(let k=0;k<12;k++)cv[k]=b[6+k];for(let k=0;k<12;k++)r[6+k]=cv[k];}
      }
      setTimeout(()=>dev.oninputreport({data:new DataView(new Uint8Array(r).buffer)}),0);
    }};
  const kb=new api.Keyboard(dev,{m:[5,C]});
  return {kb,sent,st,dev};
}
const hex=b=>b.slice(0,12).map(v=>v.toString(16).padStart(2,'0')).join(' ');
const frame=(sent,i)=>hex(sent[i]);

test('mapping frames follow the documented bytes and read back',async()=>{
  const {kb,sent,st}=fixture();
  await kb.gpSetMap(1,2,0x61,false);
  assert.equal(frame(sent,0),'03 96 4c 01 02 01 61 00 00 00 00 00');
  assert.equal(frame(sent,1),'02 96 4c 01 02 01 00 00 00 00 00 00');
  assert.equal(st.map[1*C+2],0x61);
  assert.equal(await kb.gpGetMap(1,2),0x61);
  await kb.gpSetMap(1,2,0,false);
  assert.equal(st.map[16],0);
});
test('mapping validation rejects before anything is sent',async()=>{
  const {kb,sent}=fixture();
  await assert.rejects(kb.gpSetMap(5,0,1,false));
  await assert.rejects(kb.gpSetMap(0,14,1,false));
  await assert.rejects(kb.gpSetMap(-1,0,1,false));
  await assert.rejects(kb.gpSetMap(0,0,17,false),/bad target/);
  await assert.rejects(kb.gpSetMap(0,0,13+200,true));
  await assert.rejects(kb.gpSetMap(0,0,40,true));
  await kb.gpSetMap(0,0,17,true);
  assert.equal(sent.filter(f=>f[5]===1&&f[0]===3).length,1);
});
test('read-back mismatch is an error',async()=>{
  const {kb}=fixture({corrupt:'map'});
  await assert.rejects(kb.gpSetMap(0,0,1,false),/read-back mismatch/);
  const f2=fixture({corrupt:'angle'});
  await assert.rejects(f2.kb.gpSetAngle(0,30),/read-back mismatch/);
  const f3=fixture({corrupt:'curve'});
  await assert.rejects(f3.kb.gpSetCurve(0,[{x:1,y:1},{x:2,y:2},{x:3,y:3},{x:4,y:4}]),/read-back mismatch/);
});
test('config decode and each setter',async()=>{
  const {kb,sent}=fixture();
  let c=await kb.gpConfig();
  assert.deepEqual(JSON.parse(JSON.stringify(c)),{mode:2,angle:[45,45],square:[0,0],extreme:[0,0],keyOut:0,enabled:0});
  assert.equal(frame(sent,0),'02 96 4c 00 00 03 00 00 00 00 00 00');
  c=await kb.gpSetEnabled(true);assert.equal(c.enabled,1);
  assert.equal(frame(sent,1),'03 96 4c 00 00 08 01 00 00 00 00 00');
  c=await kb.gpSetKeyOut(2);assert.equal(c.keyOut,2);
  assert.equal(frame(sent,3),'03 96 4c 00 00 07 02 00 00 00 00 00');
  c=await kb.gpSetAngle(1,60);assert.equal(c.angle[1],60);
  assert.equal(frame(sent,5),'03 96 4c 01 00 04 3c 00 00 00 00 00');
  c=await kb.gpSetFlag(api.GP.square,1,true);assert.deepEqual(Array.from(c.square),[0,1]);
  assert.equal(frame(sent,7),'03 96 4c 01 00 05 01 00 00 00 00 00');
  c=await kb.gpSetFlag(api.GP.extreme,0,true);assert.deepEqual(Array.from(c.extreme),[1,0]);
  assert.equal(frame(sent,9),'03 96 4c 00 00 06 01 00 00 00 00 00');
});
test('setter validation',async()=>{
  const {kb,sent}=fixture();
  await assert.rejects(kb.gpSetAngle(0,91));
  await assert.rejects(kb.gpSetAngle(0,-1));
  await assert.rejects(kb.gpSetAngle(2,10));
  await assert.rejects(kb.gpSetAngle(0,10.5));
  await assert.rejects(kb.gpSetKeyOut(3));
  await assert.rejects(kb.gpSetEnabled(1));
  await assert.rejects(kb.gpSetFlag(api.GP.square,0,1));
  await assert.rejects(kb.gpSetMode(0));
  assert.equal(sent.length,0);
});
test('curve encode, decode and validation',async()=>{
  const {kb,sent,st}=fixture();
  const pts=[{x:100,y:20},{x:1166,y:85},{x:2233,y:170},{x:3300,y:255}];
  await kb.gpSetCurve(0,pts);
  assert.equal(frame(sent,0),'03 96 4c 00 00 09 64 00 14 8e 04 55');
  assert.deepEqual(JSON.parse(JSON.stringify(await kb.gpGetCurve(0))),pts);
  const p=api.GP_PRESETS.find(x=>x[0]==='Instant');
  await kb.gpSetCurve(2,p[1].map((x,k)=>({x,y:p[2][k]})));
  assert.deepEqual(st.curves[2],[100,0,20,165,0,255,8,1,255,228,12,255]);
  const bad=[
    [{x:0,y:0},{x:1,y:1},{x:2,y:2}],
    [{x:-1,y:0},{x:1,y:1},{x:2,y:2},{x:3,y:3}],
    [{x:0,y:0},{x:1,y:1},{x:2,y:2},{x:3301,y:3}],
    [{x:0,y:0},{x:1,y:256},{x:2,y:2},{x:3,y:3}],
    [{x:0,y:0},{x:500,y:1},{x:400,y:2},{x:3,y:3}],
    [{x:0.5,y:0},{x:1,y:1},{x:2,y:2},{x:3,y:3}],
  ];
  const before=sent.length;
  for(const b of bad)await assert.rejects(kb.gpSetCurve(0,b));
  await assert.rejects(kb.gpSetCurve(4,pts));
  assert.equal(sent.length,before);
  assert.equal(api.GP_PRESETS.length,7);
  for(const [,xs,ys] of api.GP_PRESETS)kb.gpCheckCurve(0,xs.map((x,k)=>({x,y:ys[k]})));
});
test('clear all verifies every position is empty',async()=>{
  const {kb,sent,st}=fixture();
  await kb.gpSetMap(0,0,1,false);await kb.gpSetMap(2,3,12,false);
  await kb.gpClearAll([[0,0],[2,3]]);
  assert.ok(sent.some(f=>f[0]===3&&f[5]===2));
  assert.deepEqual(st.map,{});
});
test('input mode: restart write first, then mode, then read-back; failure marks the device gone',async()=>{
  const {kb,sent,st}=fixture();
  await kb.gpSetMode(1);
  assert.equal(frame(sent,0),'03 96 4e 01 00 00 00 00 00 00 00 00');
  assert.equal(frame(sent,1),'03 96 4c 00 00 00 01 00 00 00 00 00');
  assert.equal(st.mode,1);
  const g=fixture({supported:false});
  g.kb.send=async()=>{throw new Error('timeout');};
  await assert.rejects(g.kb.gpSetMode(2));
  assert.equal(g.kb.gone,true);
});
test('no writes after the device is gone',async()=>{
  const {kb,sent}=fixture();
  kb.gone=true;
  await assert.rejects(kb.gpSetEnabled(true),/unavailable/);
  assert.equal(sent.length,0);
});
test('a malformed config reply is rejected',async()=>{
  const {kb,st}=fixture();
  st.angle[0]=200;
  await assert.rejects(kb.gpConfig(),/unexpected/);
  st.angle[0]=45;st.ko=7;
  await assert.rejects(kb.gpConfig(),/unexpected/);
});
test('targets: ids are unique and HID-only ids are 16..20',()=>{
  const ids=api.GP_TARGETS.map(t=>t[0]);
  assert.equal(new Set(ids).size,ids.length);
  assert.deepEqual(JSON.parse(JSON.stringify(api.GP_TARGETS.filter(t=>t[4]==='h').map(t=>t[0]))),[16,17,18,19,20]);
  assert.deepEqual(JSON.parse(JSON.stringify(api.GP_TARGETS.filter(t=>t[4]==='s').map(t=>t[0]).sort((a,b)=>a-b))),[64,65,66,67,80,81,82,83]);
  assert.ok(ids.includes(96)&&ids.includes(97));
});
test('gating: section only for registered keyboards with version >= 2',()=>{
  assert.match(html,/if \(!kb\.info \|\| !\(kb\.ver >= 2\)\) return;/);
  assert.match(html,/id="padTab" class="hidden"/);
  assert.match(html,/kb\.ver = v;/);
});
test('demo mode: reports version 2 and implements the controller channel',()=>{
  assert.match(html,/if \(ch === 0 && !set\)\{ r\[5\] = 0x02; r\[6\] = 0x15; \}/);
  assert.match(html,/else if \(ch === 0x4C\)\{/);
  assert.match(html,/gp: \{ mode: 2,/);
});
