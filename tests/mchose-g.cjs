const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(__dirname,'../mchose');
const context=vm.createContext({Uint8Array,TextDecoder,TextEncoder,setTimeout,clearTimeout,Promise,window:{}});
vm.runInContext(fs.readFileSync(path.join(root,'registry.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(path.join(root,'driver-g.js'),'utf8'),context);
const D=context.window.MchoseDrivers.g;
const models=context.window.MchoseModels.models;
const byName=n=>models.find(m=>m.name===n);
const PRO=byName('G7 Pro'),V2PRO=byName('G3 V2 Pro'),V2=byName('G3 V2'),SIMPLE=byName('G7'),MAX=byName('G7 Max');
const R={name:'RangeError'},E=/./;
const deq=(a,b)=>assert.equal(JSON.stringify(a),JSON.stringify(b));

const HDR_READ=[0xA5,0x0B,0x30,1,1,1];
const HDR_WRITE=[0xAE,0x0A,0x30,1,1,1];
const HDR_BAT=[0xA5,0x0B,0x2E,1,1,1];
const DPI_LIST=[400,800,1600,3200,6400,26000];

function makeBlock(over={}){
  const b=new Uint8Array(64);
  b[0]=0xAA;b[1]=0x0E;b.set([0xA5,0x0B,0x30,1,1,1,0,0],2);
  b[10]=4;b[11]=6;b[12]=3;
  (over.dpi||DPI_LIST).forEach((v,i)=>{b[13+2*i]=v&255;b[14+2*i]=v>>8;});
  for(let i=26;i<=47;i++)b[i]=0x11+i;
  b[48]=0;b[49]=1;b[50]=0;b[51]=8;b[52]=3;b[53]=0;b[54]=0x7E;b[55]=0;
  for(let i=56;i<64;i++)b[i]=0x90+i;
  for(const [k,v] of Object.entries(over.set||{}))b[k]=v;
  return b;
}

function fixture(model,{wired=true,vid,pid,name,fw='2.3.6',battery=64,charge=0,silent=new Set(),ignoreWrites=false,noAck=false,block,offline=false,collections,stale=false,flipOnWrite}={}){
  const mem=block||makeBlock();
  const sent=[],listeners=new Set(),logs=[];
  const emit=(bytes,delay=0)=>setTimeout(()=>{for(const f of [...listeners])f({reportId:0,data:new DataView(bytes.buffer)});},delay);
  const reply=(cmd,fill)=>{const r=new Uint8Array(64);r[0]=0xAA;r[1]=cmd;fill(r);return r;};
  const isG=model.pids[0].vid===0xA8A4;
  const wVid=vid!==undefined?vid:isG?(wired?0xA8A4:0xA8A5):0x3837;
  const wPid=pid!==undefined?pid:isG?0x2255:(wired?model.wired[0]:model.receiver[0]||model.wired[0]);
  const dev={vendorId:wVid,productId:wPid,productName:name||'MCHOSE '+model.name,opened:false,
    collections:collections||[{usagePage:0xFF01,usage:0x10},{usagePage:0xFF00,usage:1}],
    async open(){this.opened=true;},async close(){this.opened=false;},
    addEventListener(t,f){assert.equal(t,'inputreport');listeners.add(f);},removeEventListener(t,f){listeners.delete(f);},
    async sendReport(id,data){
      assert.equal(id,0);assert.equal(data.length,64);assert.equal(data[0],0x55);
      const cmd=data[1];
      sent.push({cmd,data:Uint8Array.from(data)});
      if(silent.has(cmd))return;
      switch(cmd){
        case 0x03:
          if(stale)emit(reply(0x0E,()=>{}));
          return emit(reply(0x03,r=>{for(let i=0;i<3;i++)r[23+i]=fw.split('.')[i].charCodeAt(0);}));
        case 0x30:
          assert.deepEqual([...data.slice(2,8)],HDR_BAT);
          return emit(reply(0x30,r=>{r[8]=battery;r[9]=charge;}));
        case 0xED:return emit(reply(0xED,r=>{r[8]=offline?1:0;}));
        case 0x0E:
          assert.deepEqual([...data.slice(2,8)],HDR_READ);
          if(stale)emit(reply(0x03,()=>{}));
          return emit(Uint8Array.from(mem));
        case 0x0F:
          assert.deepEqual([...data.slice(2,8)],HDR_WRITE);
          assert.equal(data[8],0);assert.equal(data[9],0);
          if(!ignoreWrites)mem.set(data.slice(10),10);
          if(flipOnWrite!==undefined)mem[flipOnWrite]^=1;
          if(noAck)return;
          return emit(reply(0x0F,()=>{}));
        default:throw new Error('unexpected command '+cmd);
      }
    }};
  const opts={timeout:60,log:(l,b)=>logs.push([l,b])};
  return {dev,mem,sent,logs,opts,push:bytes=>emit(bytes),listeners};
}
async function connect(model,o){const f=fixture(model,o);f.inst=await D.open(f.dev,model,f.opts);return f;}
const writes=f=>f.sent.filter(s=>s.cmd===0x0F);
const noteText=f=>f.logs.filter(l=>l[0]==='NOTE').map(l=>Buffer.from(l[1]).toString());
const tick=()=>new Promise(r=>setTimeout(r,10));
function changedOffsets(a,b){const o=[];for(let i=10;i<64;i++)if(a[i]!==b[i])o.push(i);return o;}

test('matches picks gmouse models by identity and name, refuses G7 Max and foreign devices',()=>{
  const dev=(vid,pid,name)=>({vendorId:vid,productId:pid,productName:name});
  assert.equal(D.matches(dev(0xA8A4,0x2255,'MCHOSE G7 Pro'),models),PRO);
  assert.equal(D.matches(dev(0xA8A4,0x2255,'MCHOSE G7'),models),SIMPLE);
  assert.equal(D.matches(dev(0xA8A5,0x2255,'MCHOSE G3 A'),models),byName('G3 A'));
  assert.equal(D.matches(dev(0xA8A5,0x2255,'2.4G Wireless'),models),byName('G3 A'));
  assert.equal(D.matches(dev(0xA8A5,0x2255,'Something'),models),undefined);
  assert.equal(D.matches(dev(0x3837,0x4042,'MCHOSE G3 V2 Pro'),models),V2PRO);
  assert.equal(D.matches(dev(0x3837,0x418C,''),models),V2);
  assert.equal(D.matches(dev(0x3837,0x4013,'MCHOSE A7e Pro'),models),byName('A7e Pro'));
  assert.equal(D.matches(dev(0x41E4,0x1204,'MCHOSE G7 Max'),models),undefined);
  assert.equal(D.matches(dev(0x1234,0x2255,'MCHOSE G7'),models),undefined);
  assert.equal(D.matches(null,models),undefined);
});

test('isConfigInterface needs usage page 0xFF01 and usage 0x10',()=>{
  assert.equal(D.isConfigInterface({collections:[{usagePage:0xFF01,usage:0x10}]}),true);
  assert.equal(D.isConfigInterface({collections:[{usagePage:0xFF01,usage:0x01}]}),false);
  assert.equal(D.isConfigInterface({collections:[{usagePage:0xFF00,usage:0x10}]}),false);
  assert.equal(D.isConfigInterface({collections:[]}),false);
  assert.equal(D.isConfigInterface({}),false);
  assert.equal(D.isConfigInterface(null),false);
});

test('frames use the 0x55 request layout, exact constants and a whitelist',()=>{
  deq([...D.encodeFrame(0x0E).slice(0,10)],[0x55,0x0E,...HDR_READ,0,0]);
  deq([...D.HEADER_READ_CONFIG],HDR_READ);deq([...D.HEADER_WRITE_CONFIG],HDR_WRITE);deq([...D.HEADER_BATTERY],HDR_BAT);
  deq([...D.encodeFrame(0x30).slice(0,10)],[0x55,0x30,...HDR_BAT,0,0]);
  deq([...D.encodeFrame(0x03).slice(0,10)],[0x55,0x03,0,0,0,0,0,0,0,0]);
  const w=D.encodeFrame(0x0F,makeBlock());
  assert.equal(w.length,64);deq([...w.slice(0,10)],[0x55,0x0F,...HDR_WRITE,0,0]);
  assert.equal(w[54],0x7E);
  for(const bad of [0x08,0x09,0x0D,0x10,0x06,0x01,0xFF])assert.throws(()=>D.encodeFrame(bad),/not allowed/);
  assert.throws(()=>D.encodeFrame(0x0F),/full 64 byte block/);
  assert.throws(()=>D.encodeFrame(0x0F,new Uint8Array(10)),/full 64 byte block/);
});

test('connect is read only and decodes the config block of a full featured wired model',async()=>{
  const f=await connect(PRO,{block:makeBlock({set:{48:1,49:2,50:1|16|32,51:12,52:0,53:1,55:0xFC}})});
  assert.deepEqual([...new Set(f.sent.map(s=>s.cmd))].sort((a,b)=>a-b),[0x03,0x0E,0x30]);
  assert.equal(writes(f).length,0);
  assert.ok(f.logs.some(l=>l[0]==='TX')&&f.logs.some(l=>l[0]==='RX'));
  const s=f.inst.state;
  assert.equal(f.inst.ready,true);assert.equal(f.inst.wired,true);assert.equal(f.inst.readOnly,false);
  assert.equal(s.profile,0);deq(s.profiles,[{slot:0,name:'Onboard'}]);
  assert.equal(s.stages.length,6);deq(s.stages[2],{x:1600,y:1600});assert.equal(s.stages[5].x,26000);
  assert.equal(s.active,2);assert.equal(s.rate,1000);assert.equal(s.lod,2);assert.equal(s.debounce,12);assert.equal(s.sleep,0);
  assert.equal(s.motionSync,true);assert.equal(s.ripple,true);assert.equal(s.angleSnap,true);assert.equal(s.glass,null);
  assert.equal(s.angle,-4);assert.equal(s.mode,1);assert.equal(s.scrollReverse,true);
  assert.equal(s.firmware,'2.3.6');deq(s.battery,{percent:64,charging:false});assert.equal(s.online,true);
});

test('wired is decided by VID for the A8A4 family and by pid for 0x3837 models, receiver asks online status',async()=>{
  const r=await connect(PRO,{wired:false});
  assert.equal(r.inst.wired,false);assert.ok(r.sent.some(s=>s.cmd===0xED));assert.equal(writes(r).length,0);
  const w=await connect(PRO);assert.ok(!w.sent.some(s=>s.cmd===0xED));
  const a=await connect(V2PRO);assert.equal(a.inst.wired,true);
  const b=await connect(V2PRO,{pid:0x4245});assert.equal(b.inst.wired,false);
  await assert.rejects(connect(PRO,{wired:false,offline:true}),/not connected to the receiver/);
});

test('open refuses G7 Max, wrong families and wrong interfaces',async()=>{
  const f=fixture(PRO);
  await assert.rejects(D.open(f.dev,MAX,f.opts),/write-only protocol/);
  await assert.rejects(D.open(f.dev,{...PRO,family:'new'},f.opts),/supported/);
  await assert.rejects(D.open({...f.dev,collections:[{usagePage:0xFF01,usage:1}]},PRO,f.opts),/configuration interface/);
  assert.equal(f.sent.length,0);
});

test('every setter patches only its own offsets and preserves every other byte',async()=>{
  const f=await connect(PRO,{wired:false});
  const before=Uint8Array.from(f.mem);
  const steps=[
    ['stage',()=>f.inst.setStage(4),[12],b=>assert.equal(b[12],5)],
    ['dpi',()=>f.inst.setDpi(1,1250),[15,16],b=>assert.equal(b[15]|b[16]<<8,1250)],
    ['rate',()=>f.inst.setRate(500),[10],b=>assert.equal(b[10],3)],
    ['lod',()=>f.inst.setLod(2),[49],b=>assert.equal(b[49],2)],
    ['debounce',()=>f.inst.setDebounce(0),[51],b=>assert.equal(b[51],0)],
    ['sleep',()=>f.inst.setSleep(30),[52],b=>assert.equal(b[52],30)],
    ['never sleep',()=>f.inst.setSleep(0),[52],b=>assert.equal(b[52],0)],
    ['ripple',()=>f.inst.setFlag('ripple',true),[50],b=>assert.equal(b[50],16)],
    ['motionSync',()=>f.inst.setFlag('motionSync',true),[50],b=>assert.equal(b[50],48)],
    ['angleSnap',()=>f.inst.setFlag('angleSnap',true),[50],b=>assert.equal(b[50],49)],
    ['ripple off',()=>f.inst.setFlag('ripple',false),[50],b=>assert.equal(b[50],33)],
    ['angle',()=>f.inst.setAngle(-30),[55],b=>assert.equal(b[55],226)],
    ['mode',()=>f.inst.setMode(1),[53],b=>assert.equal(b[53],1)],
    ['scroll',()=>f.inst.setScrollReverse(true),[48],b=>assert.equal(b[48],1)]
  ];
  let prev=Uint8Array.from(f.mem);
  for(const [label,run,offsets,check] of steps){
    const n=writes(f).length;
    await run();
    assert.equal(writes(f).length,n+1,label);
    const frame=writes(f).at(-1).data;
    deq(changedOffsets(prev,frame),offsets);
    deq(changedOffsets(prev,f.mem),offsets);
    check(f.mem);
    prev=Uint8Array.from(f.mem);
  }
  for(const o of [...Array(22).keys()].map(i=>i+26).concat([54,56,57,58,59,60,61,62,63]))assert.equal(f.mem[o],before[o],'byte '+o);
  const s=f.inst.state;
  assert.equal(s.active,4);deq(s.stages[1],{x:1250,y:1250});assert.equal(s.rate,500);assert.equal(s.lod,2);assert.equal(s.debounce,0);
  assert.equal(s.sleep,0);assert.equal(s.motionSync,true);assert.equal(s.ripple,false);assert.equal(s.angleSnap,true);
  assert.equal(s.angle,-30);assert.equal(s.mode,1);assert.equal(s.scrollReverse,true);
});

test('flag and mode writes keep the other bits of their byte',async()=>{
  const f=await connect(PRO,{block:makeBlock({set:{50:0x48,53:0x80}})});
  await f.inst.setFlag('motionSync',true);assert.equal(f.mem[50],0x68);
  await f.inst.setFlag('angleSnap',true);assert.equal(f.mem[50],0x69);
  await f.inst.setFlag('motionSync',false);assert.equal(f.mem[50],0x49);
  await f.inst.setMode(1);assert.equal(f.mem[53],0x81);
  await f.inst.setMode(0);assert.equal(f.mem[53],0x80);
});

test('stage count: growing fills only invalid new stages with defaults, shrinking clamps the active stage',async()=>{
  const f=await connect(PRO,{block:makeBlock({dpi:[400,800,1600,3200,6400,26000],set:{11:3,12:3,19:0,20:0,21:0x11,22:0x11}})});
  assert.equal(f.inst.state.stages.length,3);
  await f.inst.setStageCount(5);
  assert.equal(f.mem[11],5);
  assert.equal(f.mem[19]|f.mem[20]<<8,3200);
  assert.equal(f.mem[21]|f.mem[22]<<8,6400);
  assert.equal(f.inst.state.stages.length,5);
  await f.inst.setStage(4);
  await f.inst.setStageCount(2);
  assert.equal(f.mem[11],2);assert.equal(f.mem[12],2);assert.equal(f.inst.state.active,1);
  for(const o of [26,40,47,54,63])assert.equal(f.mem[o],makeBlock()[o]);
});

test('setting an unchanged value sends no write',async()=>{
  const f=await connect(PRO);
  await f.inst.setRate(1000);await f.inst.setLod(1);await f.inst.setDpi(0,400);
  assert.equal(writes(f).length,0);
});

test('validation rejects everything out of range or unsupported before sending anything',async()=>{
  const f=await connect(PRO);
  const n=f.sent.length;
  const bad=[
    [()=>f.inst.setStage(6),R],[()=>f.inst.setStage(-1),R],[()=>f.inst.setStage(1.5),R],
    [()=>f.inst.setStageCount(0),R],[()=>f.inst.setStageCount(7),R],[()=>f.inst.setStageCount('3'),R],
    [()=>f.inst.setDpi(0,199),R],[()=>f.inst.setDpi(0,26050),R],[()=>f.inst.setDpi(0,1001),R],
    [()=>f.inst.setDpi(9,800),R],[()=>f.inst.setDpi(0,800,1600),E],[()=>f.inst.setDpi(0,NaN),R],
    [()=>f.inst.setRate(2000),R],[()=>f.inst.setRate(333),R],
    [()=>f.inst.setLod(0.7),R],[()=>f.inst.setLod(3),R],
    [()=>f.inst.setDebounce(21),R],[()=>f.inst.setDebounce(-1),R],[()=>f.inst.setDebounce(1.5),R],[()=>f.inst.setDebounce({a:1,b:2}),R],
    [()=>f.inst.setSleep(101),R],[()=>f.inst.setSleep(-1),R],[()=>f.inst.setSleep(2.5),R],
    [()=>f.inst.setFlag('bogus',true),R],[()=>f.inst.setFlag('glass',true),E],[()=>f.inst.setFlag('ripple','yes'),R],
    [()=>f.inst.setAngle(31),R],[()=>f.inst.setAngle(-31),R],[()=>f.inst.setAngle(1.5),R],
    [()=>f.inst.setMode(2),R],[()=>f.inst.setScrollReverse(1),R],[()=>f.inst.setProfile(0),E]
  ];
  for(const [run,type] of bad)await assert.rejects(run,type);
  await assert.rejects(()=>f.inst.setProfile(0),/not supported by this model/);
  assert.equal(f.sent.length,n);
});

test('wired polling rate is fixed at 1000 Hz and wireless accepts all four rates',async()=>{
  const w=await connect(PRO);const n=w.sent.length;
  await assert.rejects(()=>w.inst.setRate(250),/fixed at 1000/);
  assert.equal(w.sent.length,n);
  const r=await connect(PRO,{wired:false});
  for(const [hz,code] of [[125,1],[250,2],[500,3],[1000,4]]){await r.inst.setRate(hz);assert.equal(r.mem[10],code);assert.equal(r.inst.state.rate,hz);}
});

test('per model gating: reduced and simple models reject features they lack',async()=>{
  const v=await connect(V2);
  const n=v.sent.length;
  for(const run of [()=>v.inst.setLod(1),()=>v.inst.setFlag('angleSnap',true),()=>v.inst.setFlag('ripple',true),()=>v.inst.setFlag('motionSync',true),()=>v.inst.setAngle(3),()=>v.inst.setMode(1)])
    await assert.rejects(run,/not supported by this model/);
  await assert.rejects(()=>v.inst.setDpi(0,12050),R);
  assert.equal(v.sent.length,n);
  assert.equal(v.inst.state.lod,null);assert.equal(v.inst.state.angleSnap,null);assert.equal(v.inst.state.mode,null);assert.equal(v.inst.state.angle,null);
  await v.inst.setSleep(10);await v.inst.setDebounce(5);
  const s=await connect(SIMPLE);
  await s.inst.setFlag('angleSnap',true);assert.equal(s.mem[50],1);
  await assert.rejects(()=>s.inst.setFlag('ripple',true),/not supported/);
  await assert.rejects(()=>s.inst.setLod(1),/not supported/);
  assert.equal(s.inst.state.ripple,null);assert.equal(s.inst.state.motionSync,null);
});

test('sensor angle is gated by firmware 2.3.5 and hides itself on older firmware',async()=>{
  const old=await connect(V2PRO,{fw:'2.3.4'});
  assert.equal(old.inst.state.angle,null);assert.ok(!old.inst.model.caps.rotation);assert.ok(V2PRO.caps.rotation);
  const n=old.sent.length;
  await assert.rejects(()=>old.inst.setAngle(5),/not supported by this model/);
  assert.equal(old.sent.length,n);
  for(const fw of ['2.3.5','2.4.0','3.0.0']){const f=await connect(V2PRO,{fw});assert.ok(f.inst.model.caps.rotation,fw);await f.inst.setAngle(7);assert.equal(f.inst.state.angle,7);}
  const silent=await connect(V2PRO,{silent:new Set([0x03])});
  assert.equal(silent.inst.state.angle,null);assert.equal(silent.inst.state.firmware,null);assert.equal(silent.inst.faulted,false);
});

test('read-back mismatch refreshes state and throws, every other byte is still compared',async()=>{
  const f=await connect(PRO,{ignoreWrites:true,wired:false});
  await assert.rejects(()=>f.inst.setRate(500),/Read-back mismatch/);
  await assert.rejects(()=>f.inst.setSleep(9),/Read-back mismatch/);
  assert.equal(f.inst.state.rate,1000);assert.equal(f.inst.faulted,false);
  assert.ok(noteText(f).some(t=>t.includes('Read-back mismatch')));
  const g=await connect(PRO,{flipOnWrite:57});
  await assert.rejects(()=>g.inst.setLod(2),/Read-back mismatch.*57/);
  assert.equal(g.inst.state.lod,2);
});

test('a missing write acknowledgement is tolerated because the read-back decides',async()=>{
  const f=await connect(PRO,{noAck:true});
  await f.inst.setRate(250).catch(()=>{});
  await f.inst.setSleep(7);
  assert.equal(f.mem[52],7);assert.equal(f.inst.faulted,false);
});

test('a timeout faults the driver and later calls refuse until reconnect',async()=>{
  const f=await connect(PRO);
  f.dev.sendReport=async d=>{f.sent.push({cmd:d[1],data:Uint8Array.from(d)});};
  await assert.rejects(()=>f.inst.readState(),/timed out/);
  assert.equal(f.inst.faulted,true);assert.equal(f.inst.ready,false);
  const n=f.sent.length;
  await assert.rejects(()=>f.inst.setSleep(9),/Reconnect/);
  await assert.rejects(()=>f.inst.readState(),/Reconnect/);
  assert.equal(f.sent.length,n);
  const g=fixture(PRO,{silent:new Set([0x0E])});
  await assert.rejects(D.open(g.dev,PRO,g.opts),/timed out/);
});

test('send failures fault the driver',async()=>{
  const f=await connect(PRO);
  f.dev.sendReport=async()=>{throw new Error('NetworkError');};
  await assert.rejects(()=>f.inst.readState(),/NetworkError/);
  assert.equal(f.inst.faulted,true);
});

test('stale and mismatched replies are ignored while waiting for the right command',async()=>{
  const f=await connect(PRO,{stale:true});
  assert.equal(f.inst.ready,true);
  assert.equal(f.inst.state.rate,1000);assert.equal(f.inst.state.firmware,'2.3.6');
  assert.ok(f.logs.some(l=>l[0]==='RX'));
  f.push(Uint8Array.from([0x13,0xE2,...new Array(62).fill(0)]));
  f.push(Uint8Array.from([0xAA,0x55,...new Array(62).fill(0)]));
  f.push(Uint8Array.from([0xAA]));
  await tick();
  assert.equal(f.inst.state.rate,1000);assert.equal(f.inst.ready,true);
});

test('concurrent calls are serialized, one command in flight',async()=>{
  const f=await connect(PRO);
  const start=f.sent.length;
  await Promise.all([f.inst.setSleep(4),f.inst.setStage(0),f.inst.readState()]);
  assert.equal(f.mem[52],4);assert.equal(f.mem[12],1);
  deq(f.sent.slice(start).map(s=>s.cmd),[0x0E,0x0F,0x0E,0x0E,0x0F,0x0E,0x03,0x30,0x0E]);
});

test('async reports update state: status push, battery and online status',async()=>{
  const f=await connect(PRO,{wired:false});
  const seen=[];f.inst.onChange=s=>seen.push(JSON.stringify([s.active,s.rate,s.battery,s.online]));
  const frame=(cmd,set)=>{const r=new Uint8Array(64);r[0]=0xAA;r[1]=cmd;for(const [k,v] of Object.entries(set))r[k]=v;return r;};
  f.push(frame(0xFA,{8:0,9:2,10:2}));await tick();
  assert.equal(f.inst.state.active,1);assert.equal(f.inst.state.rate,250);
  f.push(frame(0xFA,{8:0xD0,9:5,10:4}));await tick();
  assert.equal(f.inst.state.active,1);
  f.push(frame(0xFA,{8:0,9:9,10:9}));await tick();
  assert.equal(f.inst.state.active,1);assert.equal(f.inst.state.rate,250);
  f.push(frame(0x30,{8:41,9:1}));await tick();
  deq(f.inst.state.battery,{percent:41,charging:true});
  f.push(frame(0x30,{8:200,9:0}));await tick();
  assert.equal(f.inst.state.battery,null);
  f.push(frame(0xED,{8:1}));await tick();
  assert.equal(f.inst.state.online,false);
  f.push(frame(0xED,{8:0}));await tick();
  assert.equal(f.inst.state.online,true);
  assert.ok(seen.length>=6);
  const w=await connect(PRO);w.push(frame(0xED,{8:1}));await tick();assert.equal(w.inst.state.online,true);
});

test('battery and online replies are soft, and a missing battery reply does not fault',async()=>{
  const f=await connect(PRO,{silent:new Set([0x30])});
  assert.equal(f.inst.state.battery,null);assert.equal(f.inst.faulted,false);assert.equal(f.inst.ready,true);
  await f.inst.setSleep(5);
  const g=await connect(PRO,{charge:1,battery:100});
  deq(g.inst.state.battery,{percent:100,charging:true});
});

test('a blank configuration block opens read only and refuses writes',async()=>{
  for(const fill of [0,255]){
    const b=makeBlock();for(const o of [13,14,15])b[o]=fill;
    const f=await connect(PRO,{block:b});
    assert.equal(f.inst.readOnly,true);assert.equal(f.inst.ready,true);
    assert.equal(f.inst.state.stages.length,6);assert.equal(f.inst.state.rate,1000);
    assert.equal(f.inst.state.debounce,8);assert.equal(f.inst.state.sleep,3);
    assert.ok(noteText(f).some(t=>t.includes('blank')));
    await assert.rejects(()=>f.inst.setSleep(9),/blank/);
    assert.equal(writes(f).length,0);
  }
});

test('implausible configuration blocks are refused at connect',async()=>{
  for(const set of [{10:0},{10:5},{11:0},{11:7},{12:9}]){
    const f=fixture(PRO,{block:makeBlock({set})});
    await assert.rejects(D.open(f.dev,PRO,f.opts),/Unexpected/);
    assert.equal(writes(f).length,0);
  }
});

test('block that turns implausible between read and write is not written',async()=>{
  const f=await connect(PRO);
  f.mem[11]=0;
  await assert.rejects(()=>f.inst.setSleep(9),/Unexpected DPI stage count/);
  assert.equal(writes(f).length,0);
});

test('only whitelisted commands are ever sent and none are button, macro or firmware commands',async()=>{
  const f=await connect(PRO,{wired:false});
  await f.inst.setRate(500);await f.inst.setDpi(2,2000);await f.inst.setSleep(9);await f.inst.setFlag('ripple',true);
  for(const s of f.sent)assert.ok([0x03,0x30,0xED,0x0E,0x0F].includes(s.cmd),String(s.cmd));
  for(const s of f.sent)assert.equal(s.data.length,64);
});

test('close stops listening and rejects later calls',async()=>{
  const f=await connect(PRO);
  f.inst.close();
  assert.equal(f.inst.closed,true);assert.equal(f.listeners.size,0);assert.equal(f.dev.opened,false);
  await assert.rejects(()=>f.inst.readState(),/disconnected/);
});
