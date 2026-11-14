const assert = require('node:assert/strict');
const {test} = require('node:test');
global.WLM = {Driver: class {}};
require('../wlmouse/buttons.js');
function fake(initial = {1:[1,1],2:[1,2],3:[1,3],4:[1,4],5:[1,5]}) {
  const d = new WLM.Driver(); d.profile = 1; d.ready = true; d.values = structuredClone(initial); d.calls = [];
  d._run = async fn => fn(); d._requireReady = () => {if (!d.ready) throw Error('not ready');}; d._profile = async () => 1;
  d._request = async (group, op, length, p) => {
    d.calls.push([group,op,length,p]);
    const id=p[1];
    if(op===0) d.values[id]=[p[3],...p.slice(5)];
    const [type,...data]=d.values[id]; const response=new Uint8Array(64);
    response[6]=d.profile; response[7]=id; response[9]=type; response[10]=data.length; response.set(data,11); return response;
  };
  return d;
}
test('reads unknown assignments without altering them', async () => {
  const d=fake(); d.values[2]=[77,4,5,6]; const result=await d.getButtons();
  assert.deepEqual(result[1],{id:2,type:77,data:[4,5,6]});
  assert.deepEqual(d.calls[0],[3,128,15,[1,1,0,255,10]]);
});
test('blocks removing last left click after fresh reads', async () => {
  const d=fake(); await assert.rejects(d.setButton(1,0,[]),/left click/);
  assert.equal(d.calls.filter(c=>c[1]===0).length,0);
});
test('allows remapping after adding another left click and verifies write', async () => {
  const d=fake(); await d.setButton(2,1,[1]); await d.setButton(1,4,[2,4]);
  assert.deepEqual(d.values[1],[4,2,4]);
  assert.deepEqual(d.calls.find(c=>c[1]===0),[3,0,6,[1,2,0,1,1,1]]);
});
test('rejects invalid mappings and detects profile change', async () => {
  const d=fake(); assert.throws(()=>d.setButton(1,1,[255]),/Unsupported/);
  d._profile=async()=>2; await assert.rejects(d.setButton(2,0,[]),/profile changed/); assert.equal(d.ready,false);
});
test('reports a write that does not persist', async () => {
  const d=fake(); const request=d._request;
  d._request=async (...args) => args[1]===0 ? new Uint8Array(64) : request(...args);
  await assert.rejects(d.setButton(2,1,[1]),/readback did not match/);
});
test('parses button replies through the real feature-report transport', async () => {
  const vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
  const context={Uint8Array, Promise, Date, setTimeout, clearTimeout, TextDecoder};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../wlmouse/protocol.js'),'utf8'),context);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../wlmouse/buttons.js'),'utf8'),context);
  const model=context.WLM.models[0]; let request;
  const device={vendorId:model.vendorId,productId:model.wired,opened:true,
    collections:[{featureReports:[{reportId:0,items:[{reportSize:8,reportCount:64}]}]}],
    async sendFeatureReport(id,data){ assert.equal(id,0); request=Uint8Array.from(data); },
    async receiveFeatureReport(){ const reply=new Uint8Array(64); reply[0]=0xa1; reply[4]=request[4]; reply[5]=request[5]; reply[6]=request[6]; reply[7]=request[7]; reply[8]=0; reply[9]=1; reply[10]=1; reply[11]=request[7]; if(request[4]===0 && request[5]===133) reply[6]=1; return new DataView(reply.buffer); }
  };
  const d=new context.WLM.Driver(device,model,{delay:0,timeout:100}); d.profile=1;
  const buttons=await d.getButtons();
  assert.equal(buttons.length,5); assert.equal(buttons[0].type,1); assert.equal(buttons[0].data[0],1); assert.equal(buttons[4].data[0],5);
});

test('rejects a profile switch during button reads before writing', async () => {
  const d=fake(); let calls=0; d._profile=async()=>++calls===1?1:2;
  await assert.rejects(d.setButton(2,0,[]),/profile changed/);
  assert.equal(d.calls.filter(c=>c[1]===0).length,0); assert.equal(d.ready,false);
});
test('rejects a profile switch during getButtons', async () => {
  const d=fake(); let calls=0; d._profile=async()=>++calls===1?1:2;
  await assert.rejects(d.getButtons(),/profile changed/); assert.equal(d.ready,false);
});

test('refuses to write when a button response has stale identity', async () => {
  const d=fake(); const request=d._request;
  d._request=async (...args) => { const r=await request(...args); if(args[1]===128 && args[3][1]===2) r[7]=1; return r; };
  await assert.rejects(d.setButton(2,0,[]),/identity could not be verified/);
  assert.equal(d.calls.filter(c=>c[1]===0).length,0);
});
test('refuses to write when a button response has another profile', async () => {
  const d=fake(); const request=d._request;
  d._request=async (...args) => { const r=await request(...args); if(args[1]===128) r[6]=2; return r; };
  await assert.rejects(d.setButton(2,0,[]),/identity could not be verified/);
  assert.equal(d.calls.filter(c=>c[1]===0).length,0);
});
