// node --test tests/rapoo.cjs
// Runs the page's actual driver against a WebHID fixture. No USB hardware needed.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../rapoo/index.html'),'utf8');
function load(){
  const context=vm.createContext({Uint8Array,DataView,TextDecoder,TextEncoder,setTimeout,clearTimeout});
  vm.runInContext(html.slice(html.indexOf('// Protocol start.'),html.indexOf('// Protocol end.'))+
    '\nglobalThis.api={Rapoo,MODELS,FILTERS,modelFor,isCommandDevice,chooseCommandDevice,describeDevice,validDpi,readFrame,writeFrame,profileAddress};',context);
  return context.api;
}
const api=load();
function fixture({wireless=false,options={}}={}){
  const memory=new Uint8Array(0x3000),sent=[],listeners=new Set();
  memory[0x10c]=memory[0x10d]=0;
  for(let p=0;p<8;p++){
    const base=0x600+p*0x400;
    if(p<2)memory.set(Buffer.from(`Profile ${p+1}`),base+1004);
    memory[base+640]=1;memory[base+641]=4;memory[base+644]=4;memory[base+645]=1;
    memory[base+662]=3;memory[base+664]=1;
    memory.set([2,8,10,0xab,251,0],base+704);
    memory.set([1,1,2,4,4,4,4],base+732);
    for(let i=0;i<7;i++)for(const offset of [648,712]){
      const dpi=[400,800,1600,3200,6400,12800,25600][i];memory[base+offset+2*i]=dpi&255;memory[base+offset+2*i+1]=dpi>>>8;
    }
  }
  let reply=Uint8Array.of(1,0,0,0);
  const dev={vendorId:0x24ae,productId:wireless?0x1b07:0x4b07,opened:true,
    collections:[{usagePage:0xff00,usage:2,outputReports:[{reportId:6}],featureReports:[{reportId:8}]}],
    addEventListener(t,f){listeners.add(f);},removeEventListener(t,f){listeners.delete(f);},
    async sendReport(id,frame){assert.equal(id,6);sent.push([...frame]);const address=(frame[3]|frame[4]<<8|frame[5]<<16|frame[6]<<24)>>>0;
      if(frame[1]===0xa5)memory.set(frame.slice(7,7+frame[2]),address);
      reply=Uint8Array.from([1,0,0,0,...(frame[1]===0xa4?memory.slice(address,address+frame[2]):[])]);
    },async receiveFeatureReport(id){assert.equal(id,8);return new DataView(reply.buffer,reply.byteOffset,reply.byteLength);},
  };
  const driver=new api.Rapoo(dev,{delay:0,...options});
  return {memory,sent,dev,driver,listeners};
}
test('only the 69 evidenced VT nrf54L models and their configuration interfaces are accepted',()=>{
  assert.equal(api.MODELS.length,69);assert.equal(api.FILTERS.length,138);
  const pids=new Set();for(const f of api.FILTERS){assert.equal(f.vendorId,0x24ae);assert.equal(f.usagePage,0xff00);assert.equal(f.usage,2);assert.ok(!pids.has(f.productId));pids.add(f.productId);}
  const {dev}=fixture();assert.ok(api.isCommandDevice(dev));
  assert.equal(api.modelFor({...dev,productId:0x4b20}),undefined,'VT2 RT uses another driver');
  assert.equal(api.modelFor({...dev,productId:0x4a00}),undefined,'VT7 SE uses CH584');
  assert.equal(api.modelFor({...dev,vendorId:0x373e}),undefined);
  assert.equal(api.isCommandDevice({...dev,collections:[{usagePage:0xff00,usage:14}]}),false,'Never open the update interface');
  assert.equal(api.isCommandDevice({...dev,collections:[]}),false);
});
test('vendor framing uses output 6, command A4/A5, little-endian four-byte addresses',()=>{
  assert.deepEqual([...api.readFrame(0xff,0x10c,1)],[255,164,1,12,1,0,0]);
  assert.deepEqual([...api.writeFrame(0xa5,0x888,[0x20,0x03])],[165,165,2,136,8,0,0,32,3]);
  assert.equal(api.profileAddress(2,648),0x1088);
  assert.throws(()=>api.profileAddress(8,648));
});
test('configuration usage accepts sibling/child report collections and missing report metadata',async()=>{
  for(const layout of [
    [{usagePage:0xff00,usage:2},{usagePage:0xff00,usage:3,outputReports:[{reportId:6}]},{usagePage:0xff00,usage:4,featureReports:[{reportId:8}]}],
    [{usagePage:0xff00,usage:2,children:[{usagePage:0xff00,usage:3,outputReports:[{reportId:6}]},{usagePage:0xff00,usage:4,featureReports:[{reportId:8}]}]}],
    [{usagePage:0xff00,usage:2}],
  ]){
    const {dev,sent}=fixture();dev.collections=layout;
    assert.ok(api.isCommandDevice(dev));const d=new api.Rapoo(dev,{delay:0});await d.readState();assert.equal(d.ready,true);assert.ok(sent.every(f=>f[1]===0xa4));d.close();
  }
  const {dev}=fixture();assert.equal(api.isCommandDevice({...dev,collections:[{usagePage:0xff00,usage:14,outputReports:[{reportId:6}],featureReports:[{reportId:8}]}]}),false);
});
test('picker can resolve only a unique authorized sibling of a selected USB identity',()=>{
  const {dev}=fixture(),sibling={...dev,collections:[{usagePage:0xff00,usage:14}]};
  const unrelated={...dev,productId:0x4610};
  assert.equal(api.chooseCommandDevice([dev],[unrelated]),dev,'Prefer the directly selected configuration interface');
  assert.equal(api.chooseCommandDevice([sibling],[unrelated,dev]),dev);
  assert.equal(api.chooseCommandDevice([sibling],[unrelated]),undefined,'Do not connect an unrelated mouse');
  assert.throws(()=>api.chooseCommandDevice([sibling],[dev,{...dev}]),/More than one/);
});
test('connection diagnostics retain device identity and reports without requiring report metadata',()=>{
  const {dev}=fixture();const details=api.describeDevice({...dev,productName:'Rapoo receiver'});
  assert.equal(details.vendorId,'0x24ae');assert.equal(details.productId,'0x4b07');assert.equal(details.model,'VT3S MAX V2');
  assert.deepEqual(Array.from(details.collections[0].output),[6]);
  assert.equal(api.describeDevice({...dev,collections:[{usagePage:0xff00,usage:2}]}).collections[0].feature.length,0);
});
test('reading configuration never writes, preserves raw fields, and decodes little-endian DPI',async()=>{
  const {driver,sent}=fixture();const s=await driver.readState();
  assert.equal(s.active,1);assert.equal(s.count,4);assert.equal(s.stages[1].x,800);assert.equal(s.stages[6].y,25600);
  assert.equal(s.angle,-5);assert.equal(s.correction,0xab);assert.equal(s.profiles.length,2);assert.equal(driver.ready,true);
  assert.ok(sent.every(frame=>frame[1]===0xa4));
});
test('wired and receiver requests use distinct targets',async()=>{
  for(const wireless of [false,true]){const {driver,sent}=fixture({wireless});await driver.readState();assert.ok(sent.every(frame=>frame[0]===(wireless?0xa5:0xff)));}
});
test('DPI writes touch only the selected X/Y slots with read-back verification',async()=>{
  const {driver,sent,memory}=fixture();await driver.readState();sent.length=0;
  await driver.setDpi(1,1701,1902);
  assert.deepEqual(sent.filter(f=>f[1]===0xa5),[[255,165,2,138,8,0,0,165,6],[255,165,2,202,8,0,0,110,7]]);
  assert.equal(memory[0x600+662],3);assert.equal(memory[0x600+664],1);
  assert.equal(driver.s.stages[1].x,1701);
  assert.equal(sent.filter(f=>f[1]===0xa4).length,3,'One profile guard and two verification reads');
  await assert.rejects(driver.setDpi(1,NaN,800));await assert.rejects(driver.setDpi(1,60001,800));
});
test('per-model DPI boundaries and step sizes match the manifests',()=>{
  const ultra=api.MODELS.find(m=>m.name==='VT3S MAX'),standard=api.MODELS.find(m=>m.name==='VT9'),v2=api.MODELS.find(m=>m.name==='VT3S MAX V2');
  for(const v of [10,10040,10050,10100,45000])assert.ok(api.validDpi(ultra,v));
  for(const v of [0,1,10051,10060,45050])assert.ok(!api.validDpi(ultra,v));
  assert.ok(api.validDpi(standard,50));assert.ok(api.validDpi(standard,26000));assert.ok(!api.validDpi(standard,26050));
  assert.ok(api.validDpi(v2,1));assert.ok(api.validDpi(v2,60000));assert.ok(!api.validDpi(v2,60001));
  assert.equal(standard.lod[0],1);assert.equal(ultra.lod[0],0.7);
});
test('correction bits are active-low and reserved bits survive changes',async()=>{
  const {driver,memory}=fixture();await driver.readState();
  await driver.setCorrection(0,true);assert.equal(memory[0x600+707],0xaa);
  await driver.setCorrection(1,true);assert.equal(memory[0x600+707],0xa8);
  await driver.setCorrection(0,false);assert.equal(memory[0x600+707],0xa9);
});
test('rate keys, per-rate mode address, one-based LOD and minutes use Rapoo encodings',async()=>{
  const {driver,memory}=fixture();await driver.readState();
  await driver.setRate(129);await driver.setMode(5);assert.equal(memory[0x600+640],129);assert.equal(memory[0x600+738],5);
  await assert.rejects(driver.setMode(0));await assert.rejects(driver.setRate(128));
  await driver.setByte('lod',1);assert.equal(memory[0x600+644],1);
  await driver.setByte('sleep',120);assert.equal(memory[0x600+706],120);
  await driver.setByte('sleep',255);assert.equal(memory[0x600+706],255);
  await driver.setByte('angle',-30);assert.equal(memory[0x600+708],226);
  await assert.rejects(driver.setByte('sleep',1));await assert.rejects(driver.setByte('press',17));await assert.rejects(driver.setByte('angle',31));
});
test('reducing stage count moves the active stage before disabling it',async()=>{
  const {driver,sent,memory}=fixture();await driver.readState();sent.length=0;await driver.setCount(1);
  assert.deepEqual(sent.filter(f=>f[1]===0xa5).map(f=>[f[3]|f[4]<<8,f[7]]),[[0x898,0],[0x896,0]]);
  assert.equal(memory[0x898],0);assert.equal(driver.s.count,1);await assert.rejects(driver.setStage(1));
});
test('profile writes use both selector bytes and only allow existing slots',async()=>{
  const {driver,sent}=fixture();await driver.readState();sent.length=0;
  await assert.rejects(driver.setProfile(7));await driver.setProfile(1);
  assert.deepEqual(sent.filter(f=>f[1]===0xa5),[[255,165,2,12,1,0,0,1,1]]);assert.equal(driver.ready,false);
  await driver.readState();assert.equal(driver.s.profile,1);
});
test('a changed hardware profile prevents writes to the stale profile',async()=>{
  const {driver,sent,memory}=fixture();await driver.readState();sent.length=0;memory[0x10c]=1;
  await assert.rejects(driver.setRate(129),/profile changed/);assert.ok(sent.every(f=>f[1]!==0xa5));assert.equal(driver.ready,false);
});
test('busy replies are reread without resending a write, and DataView offsets are respected',async()=>{
  const {driver,dev,sent}=fixture();await driver.readState();sent.length=0;const get=dev.receiveFeatureReport.bind(dev);let busy=1;
  dev.receiveFeatureReport=async id=>{if(busy-- > 0)return new DataView(Uint8Array.of(2,0,0,0).buffer);const v=await get(id),bytes=new Uint8Array(v.byteLength+6);bytes.set(new Uint8Array(v.buffer,v.byteOffset,v.byteLength),3);return new DataView(bytes.buffer,3,v.byteLength);};
  await driver.setRate(132);assert.equal(sent.filter(f=>f[1]===0xa5).length,1);assert.equal(driver.s.rate,132);
});
test('read-back mismatch leaves the displayed setting unchanged',async()=>{
  const {driver,dev}=fixture();await driver.readState();const send=dev.sendReport.bind(dev);
  dev.sendReport=async(id,f)=>{if(f[1]===0xa5){const fake=Uint8Array.from(f);fake[7]=8;return send(id,fake);}return send(id,f);};
  await assert.rejects(driver.setRate(129),/Read-back/);assert.equal(driver.s.rate,1);
});
test('failed ACK and truncated read are surfaced without writes during connect',async()=>{
  for(const bytes of [[0,0,0,0],[1,0]]){const {driver,dev,sent}=fixture();dev.receiveFeatureReport=async()=>new DataView(Uint8Array.from(bytes).buffer);await assert.rejects(driver.readState());assert.equal(driver.ready,false);assert.ok(sent.every(f=>f[1]===0xa4));}
});
test('a hung USB request locks the transport until reconnect',async()=>{
  const {driver,dev,sent}=fixture({options:{timeout:20}});dev.receiveFeatureReport=()=>new Promise(()=>{});
  await assert.rejects(driver.readState(),/timed out/);const length=sent.length;await assert.rejects(driver.readState(),/Reconnect/);assert.equal(sent.length,length);assert.equal(driver.faulted,true);
});
test('requests are serialized and closing cancels queued operations and listeners',async()=>{
  const {driver,listeners}=fixture();await driver.readState();await Promise.all([driver.setByte('press',4),driver.setByte('release',12)]);
  assert.equal(driver.s.press,4);assert.equal(driver.s.release,12);driver.close();assert.equal(listeners.size,0);await assert.rejects(driver.setRate(129),/disconnected/);
});
test('input report 7 updates DPI/battery and invalidates a changed profile',async()=>{
  const {driver}=fixture();await driver.readState();let refreshes=0;driver.onProfile=()=>refreshes++;
  const report=Uint8Array.from([0,2,64,6,64,6,0,73,0,4,129,0]);
  driver.onInput({reportId:7,data:new DataView(report.buffer)});assert.equal(driver.battery.percent,73);assert.equal(driver.s.active,2);assert.equal(driver.s.stages[2].x,1600);
  report[11]=1;driver.onInput({reportId:7,data:new DataView(report.buffer)});assert.equal(refreshes,1);assert.equal(driver.ready,false);
});
test('DPI stage selects capture the chosen value before the busy-state render resets the control',()=>{
  const elements=new Map(),calls=[];
  const $=id=>{if(!elements.has(id))elements.set(id,{});return elements.get(id);};
  const driver={setStage:v=>calls.push(['stage',v]),setCount:v=>calls.push(['count',v]),setRate:v=>calls.push(['rate',v]),setMode:v=>calls.push(['mode',v])};
  const context=vm.createContext({$,driver,action:fn=>{for(const el of elements.values())el.value='1';fn(driver);}});
  const start=html.indexOf("$('#stage').onchange="),end=html.indexOf("for(const key of ['press'",start);
  assert.ok(start>0&&end>start);vm.runInContext(html.slice(start,end),context);
  for(const [id,value] of [['stage',3],['count',7]]){const target=$('#'+id);target.value=String(value);target.onchange({target});}
  assert.deepEqual(calls,[['stage',3],['count',7]]);
});
test('an uninitialised stage count is clamped instead of failing the connection',async()=>{
  const {driver,memory}=fixture();memory[0x600+662]=0xff;memory[0x600+664]=0xff;
  const s=await driver.readState();assert.equal(s.count,7);assert.equal(s.active,6);
});
test('status reports update the sensor mode for the current polling rate',async()=>{
  const {driver,listeners}=fixture();await driver.readState();
  const report=new Uint8Array(17);report[7]=50;report[10]=1;report[16]=3;
  for(const f of listeners)f({reportId:7,data:new DataView(report.buffer)});
  assert.equal(driver.s.modes[3],3);
});
test('RF strategy is per profile and communication protocol is one global byte',async()=>{
  const {driver,memory}=fixture();await driver.readState();
  assert.equal(driver.s.rfBoost,0);assert.equal(driver.s.rfPacket,memory[0x60]);
  await driver.setByte('rfBoost',1);assert.equal(memory[0x600+728],1);
  await driver.setRfPacket(2);assert.equal(memory[0x60],2);
  await driver.setRfPacket(0);assert.equal(memory[0x60],0);
  await assert.rejects(driver.setRfPacket(1));await assert.rejects(driver.setByte('rfBoost',2));
});
test('communication protocol is unavailable on models that do not expose it',async()=>{
  const {driver}=fixture();const wirelessOnly=api.MODELS.find(m=>m.name==='VT2');assert.equal(wirelessOnly.rfProtocol,0);
  assert.equal(api.MODELS.find(m=>m.name==='VT3S MAX V2').rfProtocol,1);
  driver.model=wirelessOnly;await assert.rejects(driver.setRfPacket(0),/not supported/);
});
