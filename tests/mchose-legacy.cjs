const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'../mchose/driver-legacy.js'),'utf8');
const context=vm.createContext({Uint8Array,DataView,TextDecoder,TextEncoder,setTimeout,clearTimeout,Promise,Error});
context.window=context;
vm.runInContext(src,context);
const driver=context.MchoseDrivers.legacy;
const RATES=[125,500,1000,2000,4000,8000];
const full={family:'legacy',id:'a7ultra',name:'A7 Ultra',vid:0x3837,wired:[0x11],receiver:[0x1021,0x1020],
  caps:{dpi:{min:200,max:42000,step:50,maxStages:6,defaults:[400,800,1600,3200,6400,42000],independentXY:true},rates:RATES,wirelessMaxRate:8000,
    lod:[0.7,1,2],debounce:{min:0,max:20,step:1,split:false},sleep:{min:1,max:100,never:true},
    modes:[{id:0,name:'a'},{id:1,name:'b'},{id:2,name:'c'}],motionSync:true,ripple:true,angleSnap:true,glass:false,rotation:true,profiles:3,remap:false}};
full.pids=[{pid:0x11,vid:0x3837,role:'wired',rateMax:8000},{pid:0x1021,vid:0x3837,role:'receiver',rateMax:1000},{pid:0x1020,vid:0x3837,role:'receiver',rateMax:8000}];
const limited={family:'legacy',id:'g3',name:'G3 Mouse',vid:0x3837,wired:[0x4762],receiver:[0x1020],
  caps:{dpi:{min:200,max:26000,step:50,maxStages:6,defaults:[],independentXY:false},rates:[125,500,1000],wirelessMaxRate:null,lod:[1,2],
    debounce:{min:0,max:20,step:1},sleep:{min:1,max:100,never:true},modes:null,motionSync:true,ripple:false,angleSnap:true,glass:false,rotation:false,profiles:1}};
const slot=(n)=>({rateU:2,dpiU:n,rateG:1,dpiG:n,x:[400,800,1600,3200,6400,12800],y:[400,800,1600,3200,6400,12800],count:4,sensor:0b00010100,debounce:4,sleep:10,angle:-5});
function fixture({model=full,pid=0x11,shape='id',echo=true,staleReads=0,ignoreWrites=false,hang=false,invalidState=0,names=['Work','Game','']}={}){
  const profiles=[slot(0),slot(1),slot(2)];profiles[1].x[0]=500;profiles[1].y[0]=500;
  const dev={vendorId:0x3837,productId:pid,productName:'MCHOSE',opened:true,sent:[],listeners:new Set(),current:0,battery:80,charge:0,profiles,names,stale:staleReads,
    collections:[{usagePage:0xff01,usage:1,featureReports:[{reportId:0x11},{reportId:0x12}]}],
    addEventListener(t,f){this.listeners.add(f);},removeEventListener(t,f){this.listeners.delete(f);},
    emit(bytes,reportId=0){const data=new DataView(Uint8Array.from(bytes.map(v=>v^255)).buffer);for(const f of this.listeners)f({data,reportId});},
    async sendFeatureReport(id,data){
      if(hang)return new Promise(()=>{});
      if(invalidState>0){invalidState--;const e=new Error('busy');e.name='InvalidStateError';throw e;}
      const len=id===0x11?20:64;assert.equal(data.length,len);
      const b=Array.from(data,v=>v^255);this.sent.push([id,...b]);const cmd=b[0],p=profiles[this.current];
      let payload=null;
      if(id===0x12&&cmd===0x67){
        payload=new Array(63).fill(0);payload[0]=this.current;
        payload[1]=p.rateU<<4|p.dpiU;payload[2]=p.rateG<<4|p.dpiG;
        p.x.forEach((v,i)=>{payload[4+2*i]=v&255;payload[5+2*i]=v>>8;});
        payload[16]=p.count;payload[17]=p.sensor;payload[18]=p.debounce;payload[19]=p.sleep;payload[49]=p.angle&255;
        p.y.forEach((v,i)=>{payload[51+2*i]=v&255;payload[52+2*i]=v>>8;});
      }else if(id===0x11&&cmd===0x06){payload=[0,0,0,0,0,0,0,0,pid===0x11?0:1,this.battery,this.charge];}
      else if(id===0x12&&cmd===0x68){payload=[0,...Buffer.from(this.names[b[1]]||'')];}
      else if(!ignoreWrites){
        if(cmd===0x58)this.current=b[1];
        else if(cmd===0x40){p.dpiU=b[1];p.dpiG=b[2];for(let i=0;i<6;i++){p.x[i]=b[4+2*i]|b[5+2*i]<<8;p.y[i]=b[18+2*i]|b[19+2*i]<<8;}p.count=b[16];this.diff=b[17];}
        else if(cmd===0x41){if(b[1]||!b[2]&&pid===0x11)p.rateU=b[1];if(b[2]||pid!==0x11)p.rateG=b[2];}
        else if(cmd===0x43)p.debounce=b[1];
        else if(cmd===0x0a)p.sleep=b[2];
        else if(cmd===0x42){
          p.sensor=p.sensor&~3|b[1];this.lodSeen=b[1];
          for(const [field,bit] of [[2,2],[3,3],[4,4]])if(b[field])p.sensor=b[field]===1?p.sensor|1<<bit:p.sensor&~(1<<bit);
          if(b[7])p.sensor=p.sensor&0x3f|(b[7]>1?0x80:0)|(b[7]>2?0x40:0);
          if(b[8])p.angle=b[9]>127?b[9]-256:b[9];
        }
      }
      if(echo)this.emit([0xe5,cmd]);
      if(payload){
        const body=[...payload.map(v=>v^255)];
        const reply=[0xff^cmd,...body];
        this.reply=shape==='id'?[id,...[0xff^cmd,...body]].slice(0,len+1):reply.slice(0,len);
        while(this.reply.length<(shape==='id'?len+1:len))this.reply.push(0);
        if(shape==='id')this.reply=[id,0xff^cmd,...body,...new Array(len).fill(0)].slice(0,len+1);
        else this.reply=[0xff^cmd,...body,...new Array(len).fill(0)].slice(0,len);
        if(this.stale>0&&this.prev){this.stale--;this.queued=this.reply;this.reply=this.prev;}
        this.prev=this.reply;
      }
    },
    async receiveFeatureReport(id){const r=this.reply;return new DataView(Uint8Array.from(r).buffer);},
  };
  return dev;
}
const opts=extra=>({sleep:async()=>{},watchdogMs:20,timeout:300,...extra});
async function connect(o={},model=o.model||full){const dev=fixture(o);const m=await driver.open(dev,model,opts(o.opts));return {dev,m};}
const writes=dev=>dev.sent.filter(f=>![0x67,0x06,0x68].includes(f[1]));

test('encode and decode invert every byte and pad with 0xFF',()=>{
  assert.deepEqual([...driver.encodeRequest(0x11,[0x04])],[0xfb,...new Array(19).fill(0xff)]);
  assert.equal(driver.encodeRequest(0x12,[0x67]).length,64);
  assert.throws(()=>driver.encodeRequest(0x13,[1]));assert.throws(()=>driver.encodeRequest(0x11,[256]));
  const withId=Uint8Array.from([0x12,0x98,...new Array(63).fill(0xfe)]);
  assert.equal(driver.decodeReply(withId,0x12,0x67).length,63);assert.equal(driver.decodeReply(withId,0x12,0x67)[0],1);
  const noId=Uint8Array.from([0x98,...new Array(63).fill(0xfe)]);assert.equal(driver.decodeReply(noId,0x12,0x67).length,63);
  assert.equal(driver.decodeReply(withId,0x12,0x68),null);
});
test('model matching and interface choice',()=>{
  const models=[full,limited];
  assert.equal(driver.matches({vendorId:0x3837,productId:0x11},models),full);
  assert.equal(driver.matches({vendorId:0x3837,productId:0x1021},models),full);
  assert.equal(driver.matches({vendorId:0x3838,productId:0x11},models),undefined);
  const twin={...full,id:'x',name:'Other',wired:[0x99]};
  assert.equal(driver.matches({vendorId:0x3837,productId:0x1021,productName:'MCHOSE'},[full,{...twin,receiver:[0x1021]}]),undefined);
  assert.equal(driver.matches({vendorId:0x3837,productId:0x1021,productName:'RealTek MCHOSE Other'},[full,{...twin,receiver:[0x1021]}]).id,'x');
  assert.ok(driver.isConfigInterface({collections:[{usagePage:0xff0b}]}));
  assert.ok(!driver.isConfigInterface({collections:[{usagePage:0xff00}]}));
  assert.ok(!driver.isConfigInterface({collections:[{usagePage:0xff01,featureReports:[{reportId:5}]}]}));
  const a={collections:[{usagePage:0xff01}]},b={collections:[{usagePage:0xff0b,featureReports:[{reportId:0x11},{reportId:0x12}]}]};
  const logs=[];assert.equal(driver.chooseInterface([a,b],(l,m)=>logs.push(m)),b);assert.ok(logs[0].includes('0xff0b'));
});
test('connect is read only and parses a full model for both reply shapes',async()=>{
  for(const shape of ['id','noid']){
    const {dev,m}=await connect({shape});
    assert.deepEqual(dev.sent.map(f=>f[1]),[0x67,0x06,0x68,0x68,0x68]);
    const s=m.state;assert.equal(s.profile,0);assert.equal(s.stages.length,4);assert.equal(s.stages[3].x,3200);
    assert.equal(s.rate,1000);assert.equal(s.active,0);assert.equal(s.lod,0.7);assert.equal(s.ripple,true);assert.equal(s.angleSnap,false);assert.equal(s.motionSync,true);
    assert.equal(s.mode,0);assert.equal(s.debounce,4);assert.equal(s.sleep,10);assert.equal(s.angle,-5);assert.equal(s.battery.percent,80);
    assert.deepEqual([...s.profiles.map(p=>p.name)],['Work','Game','Profile 3']);assert.equal(m.ready,true);assert.equal(s.glass,null);
  }
});
test('limited model parses with same X and Y and two entry lift-off',async()=>{
  const {m,dev}=await connect({model:limited,pid:0x4762});
  assert.equal(m.state.profiles.length,1);assert.equal(dev.sent.filter(f=>f[1]===0x68).length,0);
  assert.equal(m.state.stages[0].y,m.state.stages[0].x);assert.equal(m.state.mode,null);assert.equal(m.state.lod,null);
});
test('the nibble layout is high nibble rate and low nibble stage per side',async()=>{
  const {m}=await connect();const s=m.parsed;
  assert.equal(s.usbRate,2);assert.equal(s.gRate,1);assert.equal(s.usbDpi,0);
});
test('DPI writes validate, send the XY frame and verify by re-reading',async()=>{
  const {dev,m}=await connect();dev.sent.length=0;
  await m.setDpi(1,1700,1900);
  const w=writes(dev);assert.equal(w.length,1);assert.equal(w[0][0],0x12);assert.equal(w[0][1],0x40);assert.equal(w[0][17],4);assert.equal(w[0][18],255);
  assert.equal(dev.profiles[0].x[1],1700);assert.equal(dev.profiles[0].y[1],1900);assert.equal(m.state.stages[1].y,1900);
  for(const bad of [[1,199,800],[1,42050,800],[1,1710,800],[1,800,1.5],[4,800,800],[-1,800,800]])await assert.rejects(m.setDpi(...bad));
  await m.setStage(2);assert.equal(dev.profiles[0].dpiU,2);assert.equal(dev.profiles[0].dpiG,2);assert.equal(m.state.active,2);
  await assert.rejects(m.setStage(4));
  await m.setStageCount(2);assert.equal(dev.profiles[0].count,2);assert.equal(dev.profiles[0].dpiU,1);assert.equal(m.state.stages.length,2);
  await m.setStageCount(6);assert.equal(m.state.stages.length,6);assert.equal(m.state.stages[5].x,12800);
  await assert.rejects(m.setStageCount(7));await assert.rejects(m.setStageCount(0));
  const {m:l}=await connect({model:limited,pid:0x4762});
  await assert.rejects(l.setDpi(0,800,1600),/not supported/);await l.setDpi(0,800);
});
test('polling list depends on connection and receiver, and wired and wireless fill different bytes',async()=>{
  const wired=await connect();assert.deepEqual([...wired.m.rateList()],RATES);
  assert.equal(wired.m.wired,true);
  wired.dev.sent.length=0;await wired.m.setRate(8000);
  let w=writes(wired.dev)[0];assert.deepEqual([w[1],w[2],w[3]],[0x41,5,0]);assert.equal(wired.m.state.rate,8000);
  const slow=await connect({pid:0x1021});assert.equal(slow.m.wired,false);assert.deepEqual([...slow.m.rateList()],[125,500,1000]);
  await assert.rejects(slow.m.setRate(2000),/not available/);
  const fast=await connect({pid:0x1020});assert.deepEqual([...fast.m.rateList()],RATES);
  fast.dev.sent.length=0;await fast.m.setRate(4000);w=writes(fast.dev)[0];assert.deepEqual([w[1],w[2],w[3]],[0x41,0,4]);assert.equal(fast.m.state.rate,4000);
  const g3=await connect({model:limited,pid:0x4762});await assert.rejects(g3.m.setRate(2000));await assert.rejects(g3.m.setRate(250));
  await assert.rejects(driver.open(fixture({pid:0x77}),full,opts()),/does not belong/);
});
test('lift-off, flags, mode, angle, debounce and sleep write and verify',async()=>{
  const {dev,m}=await connect();
  await m.setLod(2);assert.equal(m.state.lod,2);await m.setLod(0.7);
  await assert.rejects(m.setLod(3));
  await m.setFlag('ripple',false);assert.equal(m.state.ripple,false);assert.equal(dev.profiles[0].sensor&4,0);
  await m.setFlag('angleSnap',true);assert.equal(m.state.angleSnap,true);
  await m.setFlag('motionSync',false);assert.equal(m.state.motionSync,false);
  await assert.rejects(m.setFlag('glass',true),/not supported by this model/);await assert.rejects(m.setFlag('ripple','yes'));
  await m.setMode(2);assert.equal(m.state.mode,2);await m.setMode(1);assert.equal(m.state.mode,1);await assert.rejects(m.setMode(3));
  await m.setAngle(-30);assert.equal(m.state.angle,-30);await m.setAngle(30);assert.equal(m.state.angle,30);
  await assert.rejects(m.setAngle(31));await assert.rejects(m.setAngle(1.5));
  await m.setDebounce(8);assert.equal(m.state.debounce,8);await m.setDebounce({press:3,release:3});assert.equal(m.state.debounce,3);
  await assert.rejects(m.setDebounce(21));await assert.rejects(m.setDebounce({press:3,release:4}));
  await m.setSleep(30);assert.equal(m.state.sleep,30);await m.setSleep(0);assert.equal(m.state.sleep,0);
  await assert.rejects(m.setSleep(101));await assert.rejects(m.setSleep(-1));
  const l=await connect({model:limited,pid:0x4762});
  await assert.rejects(l.m.setMode(0),/not supported/);await assert.rejects(l.m.setAngle(1),/not supported/);await assert.rejects(l.m.setFlag('ripple',true),/not supported/);
  await l.m.setLod(2);assert.equal(l.m.state.lod,2);await assert.rejects(l.m.setProfile(0),/not supported/);
});
test('profile switching waits before re-reading and writes target the new slot',async()=>{
  const sleeps=[];const {dev,m}=await connect({opts:{sleep:async ms=>{sleeps.push(ms);}}});
  let profileEvents=0;m.onProfile=()=>profileEvents++;
  sleeps.length=0;dev.sent.length=0;await m.setProfile(1);
  assert.deepEqual(sleeps.slice(0,1),[100]);assert.deepEqual(dev.sent.slice(0,2).map(f=>f[1]),[0x58,0x67]);
  assert.equal(m.state.profile,1);assert.equal(m.state.stages[0].x,500);assert.equal(profileEvents,1);
  await m.setDebounce(2);assert.equal(dev.profiles[1].debounce,2);assert.equal(dev.profiles[0].debounce,4);
  await assert.rejects(m.setProfile(3));
});
test('E2 status updates battery and dpi stage, and a profile bit forces a refresh',async()=>{
  const {dev,m}=await connect();let changes=0;m.onChange=()=>changes++;let prof=0;m.onProfile=()=>prof++;
  dev.emit([0xe2,0,1,1,55,2,0,0,0]);
  assert.deepEqual({...m.state.battery},{percent:55,charging:true});assert.equal(m.state.active,2);assert.ok(changes>0);
  dev.emit([0xe2,1,1,0,40,3,0,0,0]);assert.equal(m.state.battery.percent,55);assert.equal(m.state.active,2);
  dev.emit([0xe2,0,1,0,54,1,0,0,0x80]);assert.equal(prof,1);assert.equal(m.ready,false);
  await assert.rejects(m.setRate(500),/Read the mouse settings/);await m.readState();assert.equal(m.ready,true);
  dev.emit([0x2c,0,0],0x2c);
});
test('a profile changed on the mouse blocks stale writes',async()=>{
  const {dev,m}=await connect();dev.current=2;dev.sent.length=0;
  await assert.rejects(m.setRate(500),/profile changed/);assert.equal(writes(dev).length,0);
});
test('a stale reply is retried and a missing completion report is tolerated',async()=>{
  const {m}=await connect({staleReads:1});assert.equal(m.state.profile,0);
  const quiet=await connect({echo:false});await quiet.m.setDebounce(5);assert.equal(quiet.m.state.debounce,5);
});
test('send retries InvalidStateError up to five times',async()=>{
  const ok=await connect({invalidState:4});assert.equal(ok.m.ready,true);
  await assert.rejects(driver.open(fixture({invalidState:5}),full,opts()),/busy/);
});
test('a mismatching read-back is an error and exposes the true state',async()=>{
  const {m}=await connect({ignoreWrites:true});
  await assert.rejects(m.setRate(500),/Read-back did not match/);assert.equal(m.ready,false);assert.equal(m.faulted,false);assert.equal(m.state.rate,1000);
});
test('a timeout puts the driver into the faulted state and refuses further work',async()=>{
  const dev=fixture({hang:true});
  await assert.rejects(driver.open(dev,full,opts({timeout:30})),/timed out/);
  const {m}=await connect({opts:{timeout:50}});
  m.device.sendFeatureReport=()=>new Promise(()=>{});
  await assert.rejects(m.setRate(500),/timed out/);assert.equal(m.faulted,true);assert.equal(m.ready,false);
  await assert.rejects(m.setRate(500),/Reconnect/);await assert.rejects(m.readState(),/Reconnect/);
});
test('close detaches and refuses further work',async()=>{
  const {dev,m}=await connect();m.close();assert.equal(dev.listeners.size,0);await assert.rejects(m.readState(),/disconnected/);
});
