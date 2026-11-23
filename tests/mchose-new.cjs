const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../mchose/driver-new.js'),'utf8');
function load(){
  const context=vm.createContext({Uint8Array,TextDecoder,TextEncoder,setTimeout,clearTimeout,Promise,window:{}});
  vm.runInContext(source,context);
  return context.window.MchoseDrivers.new;
}
const D=load();
const deq=(a,b)=>assert.equal(JSON.stringify(a),JSON.stringify(b));

const FULL={id:'v7pro',name:'V7 Pro',family:'new',vid:0x3837,wired:[0x403E],receiver:[0x101D],
  caps:{dpi:{min:200,max:42000,step:50,maxStages:6,independentXY:true},rates:[125,500,1000],wirelessMaxRate:null,lod:[0.7,1,2],
    debounce:{min:1,max:20,step:1,split:true},sleep:{min:1,max:100,never:true},modes:[{id:0,name:'Performance'},{id:1,name:'Gaming'}],
    motionSync:true,ripple:true,angleSnap:true,glass:true,rotation:true,profiles:3}};
const LIMITED={id:'g3v3',name:'G3 V3',family:'new',vid:0x3837,wired:[0x4029],receiver:[0x101D],
  caps:{dpi:{min:200,max:12000,step:50,maxStages:6,independentXY:false},rates:[125,500,1000],wirelessMaxRate:null,lod:null,
    debounce:{min:1,max:20,step:1,split:true},sleep:{min:1,max:100,never:true},modes:null,
    motionSync:false,ripple:false,angleSnap:false,glass:false,rotation:false,profiles:3}};
const BIG={id:'a7u',name:'A7 V3 Ultra',family:'new',vid:0x3837,wired:[0x403D],receiver:[0x1014],
  caps:{dpi:{min:200,max:50000,step:50,maxStages:6,independentXY:true},rates:[125,500,1000,2000,4000,8000],wirelessMaxRate:null,lod:[0.7,0.9,1.2,1.4,1.7],
    debounce:{min:1,max:20,step:1,split:true},sleep:{min:1,max:100,never:true},modes:[{id:0},{id:1},{id:2}],
    motionSync:true,ripple:true,angleSnap:true,glass:true,rotation:true,profiles:3}};

const xor=(a)=>a.reduce((x,b)=>x^b,0);
function reply(cmd,payload,{badChecksum=false}={}){
  const d=new Uint8Array(63);d[0]=1;d[1]=1;d[2]=payload.length;d[3]=cmd&255;d[4]=cmd>>8;d.set(payload,7);
  d[7+payload.length]=xor(d.slice(1,7+payload.length))^(badChecksum?0x55:0);
  return d;
}

function fixture(model,{wired=true,busy=0,silent=false,ignoreWrites=false,badChecksum=false,replyId=0x4E,infoVid=0x3837,collections}={}){
  const mem={active:0,names:['Default','Work','Game'],battery:77,charge:0,
    profiles:[0,1,2].map(i=>({
      perf:{rateUsb:3,rateG:3,stage:2,sleep:3,sleepMode:0,sensor:model.caps.lod&&model.caps.lod.length===3?1<<5:model.caps.lod&&model.caps.lod.length===2?2<<5:0,rotate:0,left:4+i,right:5+i},
      lod:1,hasY:0,sum:6,x:[400,800,1600,3200,6400,model.caps.dpi.max],y:[400,800,1600,3200,6400,model.caps.dpi.max]}))};
  const sent=[],listeners=new Set(),logs=[],notes=[];
  const emit=(bytes,id=replyId)=>setTimeout(()=>{for(const f of [...listeners])f({reportId:id,data:new DataView(bytes.buffer)});},0);
  let busyLeft=busy;
  const P=()=>mem.profiles[mem.active];
  const dev={vendorId:0x3837,productId:wired?model.wired[0]:model.receiver[0],productName:'MCHOSE '+model.name,opened:false,
    collections:collections||[{usagePage:0xFF01,usage:1,outputReports:[{reportId:0x4D}]}],
    async open(){this.opened=true;},async close(){this.opened=false;},
    addEventListener(t,f){assert.equal(t,'inputreport');listeners.add(f);},removeEventListener(t,f){listeners.delete(f);},
    async sendReport(id,data){
      assert.equal(id,0x4D);assert.equal(data.length,63);
      const cmd=data[3]|data[4]<<8,n=data[2],pl=Array.from(data.slice(7,7+n));
      assert.equal(data[7+n],xor(data.slice(1,7+n)),'request checksum');
      sent.push({cmd,payload:pl});
      if(silent)return;
      const out=(p)=>emit(reply(cmd,p,{badChecksum}));
      const p=P().perf;
      switch(cmd){
        case 0x0900:{const b=[0x37,0x38,0,0,3,0,0,0,0,0,1,mem.charge,mem.battery,0];b[0]=infoVid&255;b[1]=infoVid>>8;b[2]=0x3E;b[3]=0x40;return out(b);}
        case 0x0002:
          if(busyLeft>0){busyLeft--;return out([0xFF,0xFF]);}
          return out([mem.active,p.rateUsb<<4|p.stage,p.rateG<<4|p.stage,p.sleep,p.sleepMode,p.sensor,p.rotate,p.left,p.right,0,0,0]);
        case 0x0102:
          if(!ignoreWrites){const q=mem.profiles[pl[0]].perf;Object.assign(q,{rateUsb:pl[1]>>4,stage:pl[1]&15,rateG:pl[2]>>4,sleep:pl[3],sleepMode:pl[4],sensor:pl[5],rotate:pl[6],left:pl[7],right:pl[8]});}
          return out([0]);
        case 0x0003:{const q=mem.profiles[pl[0]],t=pl[1]?q.y:q.x,b=[pl[0],pl[1],q.sum,p.stage,q.hasY];for(const v of t)b.push(v&255,v>>8);return out(b);}
        case 0x0103:{
          const q=mem.profiles[pl[0]];
          if(!ignoreWrites){q.hasY=pl[2];q.sum=pl[3];const t=pl[1]?q.y:q.x;for(let i=0;i<6;i++)t[i]=pl[5+2*i]|pl[6+2*i]<<8;}
          return out([0]);}
        case 0x0009:return out([mem.profiles[pl[0]].lod]);
        case 0x0109:if(!ignoreWrites)mem.profiles[pl[0]].lod=pl[1];return out([0]);
        case 0x0906:if(!ignoreWrites)mem.active=pl[0];return out([0]);
        case 0x0905:{const nb=Array.from(Buffer.from(mem.names[pl[0]]));while(nb.length<60)nb.push(0);return out(nb.slice(pl[1],pl[1]+pl[2]));}
        default:return;
      }
    }};
  const opts={delay:0,timeout:60,log:(l,b)=>logs.push([l,b]),};
  return {dev,mem,sent,logs,opts,push:(bytes,id)=>emit(bytes,id),listeners};
}
async function connect(model,o){const f=fixture(model,o);f.inst=await D.open(f.dev,model,f.opts);return f;}
const tick=()=>new Promise(r=>setTimeout(r,5));
const noteText=f=>f.logs.filter(l=>l[0]==='NOTE').map(l=>Buffer.from(l[1]).toString());
const WRITE_CMDS=new Set([0x0102,0x0103,0x0109,0x0906]);

test('frame encode, decode and xor checksum follow the 0x4D layout',()=>{
  const f=D.encodeFrame(0x0102,[0x0a,0x0b]);
  assert.equal(f.length,63);
  deq([...f.slice(0,10)],[1,1,2,0x02,0x01,0,0,0x0a,0x0b,1^2^0x02^0x01^0x0a^0x0b]);
  const r=D.decodeFrame(f);
  assert.equal(r.cmd,0x0102);assert.equal(r.seq,0);assert.equal(r.checksum,true);deq([...r.payload.slice(0,2)],[0x0a,0x0b]);
  const bad=Uint8Array.from(f);bad[9]^=1;assert.equal(D.decodeFrame(bad).checksum,false);
  assert.equal(D.decodeFrame([1,1]),null);
  assert.throws(()=>D.encodeFrame(0x10000));
  assert.throws(()=>D.encodeFrame(2,new Array(56).fill(0)));
  assert.equal(D.encodeFrame(2,new Array(55).fill(1)).length,63);
});

test('matches picks models by id and name and refuses boot-mode and foreign devices',()=>{
  const models=[FULL,LIMITED,{...LIMITED,id:'x',name:'G3 S',wired:[0x4041]},{...BIG,family:'legacy',wired:[0x1]}];
  const dev=(pid,name,vid=0x3837)=>({vendorId:vid,productId:pid,productName:name,collections:[{usagePage:0xFF0B}]});
  assert.equal(D.matches(dev(0x403E,'MCHOSE V7 Pro'),models),FULL);
  assert.equal(D.matches(dev(0x4029,''),models),LIMITED);
  assert.equal(D.matches(dev(0x101D,'MCHOSE G3 V3'),models),LIMITED);
  assert.equal(D.matches(dev(0x101D,'MCHOSE V7 Pro'),models),FULL);
  assert.equal(D.matches(dev(0x101D,'2.4G Receiver'),models),undefined);
  assert.equal(D.matches(dev(0x403E,'V7 Pro Upgrade'),models),undefined);
  assert.equal(D.matches(dev(0x403E,'MCHOSE V7 Pro',0x1234),models),undefined);
  assert.equal(D.matches(dev(0x1,'x'),models),undefined);
  assert.equal(D.isConfigInterface(dev(1,'a')),true);
  assert.equal(D.isConfigInterface({collections:[{usagePage:0xFF01}]}),true);
  assert.equal(D.isConfigInterface({collections:[{usagePage:0xFF00}]}),false);
  assert.equal(D.isConfigInterface({collections:[]}),false);
  assert.equal(D.isConfigInterface({productName:'V7 Upgrade',collections:[{usagePage:0xFF01}]}),false);
});

test('collection choice prefers the one with output 0x4D and falls back to the first match',async()=>{
  const two=[{usagePage:0xFF01,usage:1,outputReports:[{reportId:2}]},{usagePage:0xFF0B,usage:1,outputReports:[{reportId:0x4D}]}];
  assert.equal(D.pickCollection({collections:two}).usagePage,0xFF0B);
  const f=await connect(FULL,{collections:two});
  assert.ok(noteText(f).some(t=>t.includes('0xFF0B')&&t.includes('declares')));
  const g=await connect(FULL,{collections:[{usagePage:0xFF01},{usagePage:0xFF0B}]});
  assert.ok(noteText(g).some(t=>t.includes('0xFF01')&&t.includes('first match')));
  await assert.rejects(D.open({...g.dev,collections:[]},FULL,g.opts),/configuration interface/);
  await assert.rejects(D.open(g.dev,{...FULL,family:'legacy'},g.opts),/supported/);
});

test('connect is read only and readState decodes a full featured model',async()=>{
  const f=await connect(FULL);
  assert.ok(f.sent.length>0);
  assert.ok(f.sent.every(s=>!WRITE_CMDS.has(s.cmd)),'no writes on connect');
  assert.ok(f.logs.some(l=>l[0]==='TX')&&f.logs.some(l=>l[0].startsWith('RX')));
  const s=f.inst.state;
  assert.equal(f.inst.ready,true);assert.equal(f.inst.wired,true);
  assert.equal(s.profile,0);deq(s.profiles.map(p=>p.name),['Default','Work','Game']);
  assert.equal(s.stages.length,6);deq(s.stages[2],{x:1600,y:1600});assert.equal(s.stages[5].x,42000);
  assert.equal(s.active,2);assert.equal(s.rate,1000);assert.equal(s.lod,1);deq(s.debounce,{left:4,right:5});
  assert.equal(s.sleep,3);assert.equal(s.motionSync,false);assert.equal(s.glass,false);assert.equal(s.angle,0);assert.equal(s.mode,0);
  deq(s.battery,{percent:77,charging:false});
  const r=await connect(FULL,{wired:false});assert.equal(r.inst.wired,false);assert.equal(r.inst.state.rate,1000);
});

test('limited model (G3 V3) exposes only rate, debounce, sleep and DPI and refuses the rest',async()=>{
  const f=await connect(LIMITED);const s=f.inst.state;
  assert.equal(s.lod,null);assert.equal(s.motionSync,null);assert.equal(s.ripple,null);assert.equal(s.angleSnap,null);assert.equal(s.glass,null);
  assert.equal(s.angle,null);assert.equal(s.mode,null);assert.equal(s.rate,1000);
  for(const [fn,args] of [['setLod',[1]],['setAngle',[5]],['setMode',[0]],['setFlag',['ripple',true]],['setFlag',['glass',true]]])
    await assert.rejects(f.inst[fn](...args),/not supported by this model/);
  await assert.rejects(f.inst.setDpi(0,800,1000),/not supported by this model/);
  await f.inst.setRate(500);assert.equal(f.inst.state.rate,500);
  await assert.rejects(f.inst.setRate(2000),/not available/);
  await f.inst.setDpi(1,1200);deq(f.mem.profiles[0].x[1],1200);assert.equal(f.mem.profiles[0].hasY,0);
  assert.ok(!f.sent.some(s=>s.cmd===0x0109));
});

test('setters write the right bytes and verify by reading back',async()=>{
  const f=await connect(FULL);const i=f.inst,m=()=>f.mem.profiles[0].perf;
  await i.setRate(500);assert.equal(m().rateUsb,2);assert.equal(m().rateG,2);assert.equal(i.state.rate,500);
  await i.setRate(125);assert.equal(m().rateUsb,0);
  await i.setRate(1000);assert.equal(m().rateUsb,3);
  await i.setStage(4);assert.equal(m().stage,4);assert.equal(i.state.active,4);
  await i.setSleep(10);assert.equal(m().sleep,10);assert.equal(m().sleepMode,0);assert.equal(i.state.sleep,10);
  await i.setSleep(0);assert.equal(m().sleepMode,1);assert.equal(i.state.sleep,0);
  await i.setDebounce(8);deq([m().left,m().right],[8,8]);
  await i.setDebounce({left:2,right:12});deq(i.state.debounce,{left:2,right:12});
  await i.setFlag('ripple',true);await i.setFlag('motionSync',true);await i.setFlag('angleSnap',true);await i.setFlag('glass',true);
  assert.equal(m().sensor&0x9C,0x9C);assert.equal(i.state.glass,true);assert.equal(i.state.ripple,true);
  await i.setFlag('glass',false);assert.equal(m().sensor&0x80,0);
  await i.setAngle(-12);assert.equal(m().rotate,244);assert.equal(i.state.angle,-12);
  await i.setAngle(30);assert.equal(i.state.angle,30);
  await i.setMode(1);assert.equal(m().sensor&3,1);assert.equal(i.state.mode,1);
  await i.setLod(2);assert.equal(m().sensor>>5&3,2);assert.equal(i.state.lod,2);
  await i.setLod(0.7);assert.equal(m().sensor>>5&3,0);assert.equal(i.state.lod,0.7);
  assert.equal(m().sensor&0x1C,0x0C|0x10&0x10|4&4,'flags survive later writes');
  await i.setDpi(0,500,500);deq(i.state.stages[0],{x:500,y:500});
  await i.setDpi(1,1000,2000);assert.equal(f.mem.profiles[0].hasY,1);deq(i.state.stages[1],{x:1000,y:2000});
  await i.setStageCount(3);assert.equal(i.state.stages.length,3);assert.equal(f.mem.profiles[0].sum,3);
  await i.setStage(2);await i.setStageCount(2);assert.equal(i.state.active,1);assert.equal(m().stage,1);
  await i.setStageCount(5);assert.equal(i.state.stages.length,5);
  assert.ok(f.sent.every(s=>D.CMD&&[0x0002,0x0003,0x0009,0x0900,0x0905,0x0906,0x0102,0x0103,0x0109].includes(s.cmd)));
  assert.ok(f.sent.every(s=>s.cmd!==0x09F0&&s.cmd!==0x09F5&&s.cmd!==0x0105&&s.payload[0]!==0xAA));
});

test('5 level lift-off models use the separate 0x0009/0x0109 command and 8K rates',async()=>{
  const f=await connect(BIG);const i=f.inst;
  assert.equal(i.state.lod,0.9);
  await i.setLod(1.7);assert.equal(f.mem.profiles[0].lod,4);assert.equal(i.state.lod,1.7);
  assert.equal(f.mem.profiles[0].perf.sensor,0,'sensor byte untouched');
  await assert.rejects(i.setLod(2),/not available/);
  await i.setRate(8000);assert.equal(f.mem.profiles[0].perf.rateUsb,6);
  await i.setMode(2);assert.equal(f.mem.profiles[0].perf.sensor&3,2);
  const r=await connect({...BIG,caps:{...BIG.caps,wirelessMaxRate:4000}},{wired:false});
  await assert.rejects(r.inst.setRate(8000),/wirelessly/);await r.inst.setRate(4000);
});

test('every setter rejects out of range or invalid values before sending anything',async()=>{
  const f=await connect(FULL);const i=f.inst;const before=f.sent.length;
  const bad=[['setRate',[250]],['setRate',[2000]],['setRate',['1000']],['setStage',[6]],['setStage',[-1]],['setStage',[1.5]],
    ['setStageCount',[0]],['setStageCount',[7]],['setStageCount',['3']],['setDpi',[0,199,400]],['setDpi',[0,42050,42050]],['setDpi',[0,425,425]],['setDpi',[9,400,400]],['setDpi',[0,400.5,400]],
    ['setSleep',[-1]],['setSleep',[101]],['setSleep',[2.5]],['setDebounce',[0]],['setDebounce',[21]],['setDebounce',[{left:1,right:99}]],['setDebounce',[null]],
    ['setFlag',['bogus',true]],['setFlag',['ripple',1]],['setAngle',[31]],['setAngle',[-31]],['setAngle',[1.5]],['setMode',[2]],['setMode',['0']],
    ['setLod',[5]],['setProfile',[3]],['setProfile',[-1]]];
  for(const [fn,args] of bad)await assert.rejects(i[fn](...args),(e)=>typeof e.message==="string",fn+JSON.stringify(args));
  assert.equal(f.sent.length,before,'nothing was sent');
  const noNever=await connect({...FULL,caps:{...FULL.caps,sleep:{min:1,max:100,never:false}}});
  await assert.rejects(noNever.inst.setSleep(0),/Never sleep/);
  const one=await connect({...FULL,caps:{...FULL.caps,debounce:{min:1,max:20,step:1,split:false}}});
  await assert.rejects(one.inst.setDebounce({left:3,right:4}),/one debounce/);
  await one.inst.setDebounce(3);
});

test('profile switching selects, verifies and reloads the per profile state',async()=>{
  const f=await connect(FULL);const i=f.inst;let seen=null;i.onProfile=p=>{seen=p;};
  f.mem.profiles[1].perf.rateUsb=2;f.mem.profiles[1].perf.rateG=2;f.mem.profiles[1].x[0]=900;
  const s=await i.setProfile(1);
  assert.equal(seen,1);assert.equal(f.mem.active,1);assert.equal(s.profile,1);assert.equal(s.rate,500);assert.equal(s.stages[0].x,900);
  await i.setDpi(1,1250);assert.equal(f.mem.profiles[1].x[1],1250);assert.equal(f.mem.profiles[0].x[1],800);
  await i.setProfile(0);assert.equal(i.state.rate,1000);
  const n=f.sent.length;await i.setProfile(0);assert.equal(f.sent.length,n,'selecting the active profile sends nothing');
  const g=await connect(FULL,{ignoreWrites:true});
  await assert.rejects(g.inst.setProfile(2),/Read-back mismatch/);
});

test('busy replies are retried, then reported',async()=>{
  const f=await connect(FULL,{busy:3});assert.equal(f.inst.state.rate,1000);
  await assert.rejects(connect(FULL,{busy:9}),/busy/);
});

test('a timeout faults the connection and refuses everything until reconnect',async()=>{
  const f=await connect(FULL);
  f.dev.sendReport=async()=>{};
  await assert.rejects(f.inst.setRate(500),/timed out/);
  assert.equal(f.inst.faulted,true);assert.equal(f.inst.ready,false);
  const n=f.sent.length;
  await assert.rejects(f.inst.setRate(125),/Reconnect/);await assert.rejects(f.inst.readState(),/Reconnect/);
  assert.equal(f.sent.length,n);
  await assert.rejects(connect(FULL,{silent:true}),/timed out/);
});

test('a write the mouse does not keep is reported and the state shows the real value',async()=>{
  const f=await connect(FULL,{ignoreWrites:true});
  await assert.rejects(f.inst.setRate(500),/Read-back mismatch/);assert.equal(f.inst.state.rate,1000);assert.equal(f.inst.faulted,false);
  await assert.rejects(f.inst.setDpi(0,600),/Read-back mismatch/);
  await assert.rejects(connect(BIG,{ignoreWrites:true}).then(x=>x.inst.setLod(1.7)),/Read-back mismatch/);
});

test('replies match on command and sequence regardless of input report id, bad checksums only warn',async()=>{
  for(const id of [0,0x4D,0x01,0x77]){const f=await connect(FULL,{replyId:id});assert.equal(f.inst.state.rate,1000);assert.ok([...f.inst.replyReportIds].every(x=>x===id));}
  const f=await connect(FULL,{badChecksum:true});
  assert.equal(f.inst.ready,true);assert.ok(noteText(f).some(t=>t.includes('Checksum mismatch')));
  await f.inst.setRate(500);
  const n=f.logs.length;
  f.push(reply(0x0777,[1,2,3]),0x55);f.push(Uint8Array.of(9,9,9),0x55);await tick();
  assert.ok(f.logs.length>n&&f.logs.slice(n).every(l=>/unknown|unmatched/.test(l[0])));
  assert.equal(f.inst.faulted,false);
});

test('async 0x0600 reports update dpi stage, battery, charging and profile',async()=>{
  const f=await connect(FULL);const i=f.inst;let changes=0,prof=null;i.onChange=()=>{changes++;};i.onProfile=p=>{prof=p;};
  const p=new Array(13).fill(0);
  p[0]=1|2;p[2]=4;p[3]=55;f.push(reply(0x0600,p));await tick();
  assert.equal(i.state.active,4);assert.equal(i.state.battery.percent,55);assert.equal(changes,1);
  const q=new Array(13).fill(0);q[1]=2;q[12]=1;f.push(reply(0x0600,q));await tick();
  assert.equal(i.state.battery.charging,true);
  const r=new Array(13).fill(0);r[0]=8;r[6]=2;f.push(reply(0x0600,r));await tick();
  assert.equal(prof,2);assert.equal(i.state.profile,2);assert.equal(i.stale,true);
  const z=new Array(13).fill(0);z[0]=2;z[3]=0;f.push(reply(0x0600,z));await tick();
  assert.equal(i.state.battery,null);
  const o=new Array(13).fill(0);o[0]=1;o[2]=9;f.push(reply(0x0600,o));await tick();
  assert.equal(i.state.active,4,'out of range stage ignored');
  const g=new Array(13).fill(0);g[0]=4;g[2]=1;f.push(reply(0x0600,g));await tick();
  assert.equal(i.state.active,4,'unrelated bits ignored');
  await i.setProfile(2);assert.equal(i.stale,false);
});

test('async reports do not disturb an exchange in flight and the device identity gate disables writes',async()=>{
  const f=await connect(FULL);
  const pending=f.inst.setRate(500);
  const p=new Array(13).fill(0);p[0]=2;p[3]=40;f.push(reply(0x0600,p));
  await pending;assert.equal(f.inst.state.battery.percent,40);assert.equal(f.inst.state.rate,500);
  const w=await connect(FULL,{infoVid:0x1234});
  assert.equal(w.inst.readOnly,true);await assert.rejects(w.inst.setRate(500),/writes are disabled/);
  assert.ok(w.sent.every(s=>!WRITE_CMDS.has(s.cmd)));
});

test('close detaches the listener and refuses further use',async()=>{
  const f=await connect(FULL);f.inst.close();
  assert.equal(f.listeners.size,0);assert.equal(f.inst.closed,true);
  await assert.rejects(f.inst.setRate(500),/disconnected/);
});
