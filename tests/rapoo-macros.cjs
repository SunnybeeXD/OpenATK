// node --test tests/rapoo-macros.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(process.env.RAPOO_MACRO_HTML||path.join(__dirname,'../rapoo/index.html'),'utf8');
const from=html.indexOf('// Protocol start.'),to=html.indexOf('// Protocol end.');
assert.ok(from>=0&&to>from,'Missing Rapoo protocol section');
const context=vm.createContext({Uint8Array,DataView,TextEncoder,TextDecoder,setTimeout,clearTimeout});
vm.runInContext(html.slice(from,to)+'\nglobalThis.api={Rapoo,RAPOO_MACROS,macroPayloadAddress,macroNameAddress,macroNameBytes,macroDecodeName,macroNormalize,encodeRapooMacro,decodeRapooMacro,parseRapooMacroFile};',context);
const api=context.api,plain=value=>JSON.parse(JSON.stringify(value));
const draft=(extra={})=>({name:'Example',loop:1,ignoreDelay:false,package:[{type:1,key:4,time:80},{type:0,key:4,time:0}],...extra});
function fixture(){
  const memory=new Uint8Array(0x20000),writes=[],activations=[];
  const device={vendorId:0x24ae,productId:0x4b07,opened:true,collections:[{usagePage:0xff00,usage:2}],addEventListener(){},removeEventListener(){}};
  const driver=new api.Rapoo(device,{delay:0});driver.ready=true;driver.s={profile:0,macros:null};
  driver.read=async(address,length)=>memory.slice(address,address+length);
  driver.writeVerified=async(address,bytes)=>{writes.push({address,bytes:[...bytes]});memory.set(bytes,address);};
  driver.exchange=async frame=>{assert.equal(frame[1],0xa5);assert.equal(frame[2],0);activations.push(frame[3]|frame[4]<<8|frame[5]<<16|frame[6]<<24);return new Uint8Array();};
  return{driver,memory,writes,activations};
}
test('macro framing matches vendor length/loop headers and action delay bit fields',()=>{
  const bytes=api.encodeRapooMacro(draft());assert.deepEqual([...bytes],[10,0,1,0,161,0,4,0,0,4]);
  const result=api.decodeRapooMacro(bytes,'Example');assert.equal(result.supported,true);assert.deepEqual(plain(result.package),draft().package);
});
test('extended movement and mouse-state events round-trip signed limits',()=>{
  const macro=draft({package:[{type:0,key:247,time:32767,x:-2048,y:2047},{type:0,key:248,time:1,mouseKey:[0,0,0,0,0],x:32767,y:-32768,vWheel:-128,hWheel:127}]});
  const encoded=api.encodeRapooMacro(macro),decoded=api.decodeRapooMacro(encoded,macro.name);
  assert.equal(decoded.supported,true);assert.deepEqual(plain(decoded.package),macro.package);assert.equal(encoded.length,20);
});
test('ignore delays and toggle mode match vendor conversions without mutating the draft',()=>{
  const source=draft({loop:65534});const before=JSON.stringify(source),encoded=api.encodeRapooMacro(source);
  assert.equal(encoded[7]>>>1,20);assert.equal(JSON.stringify(source),before);
  const ignored=api.decodeRapooMacro(api.encodeRapooMacro(draft({ignoreDelay:true})),'Example');assert.equal(ignored.ignoreDelay,true);assert.ok(ignored.package.every(event=>event.time===2));
});
test('macro names enforce 16 UTF-8 bytes without splitting characters',()=>{
  assert.equal(api.macroNameBytes('é'.repeat(8)).length,16);assert.throws(()=>api.macroNameBytes('é'.repeat(9)),/16 UTF-8/);
  for(const name of ['', ' bad','bad ', 'bad\nname'])assert.throws(()=>api.macroNameBytes(name));
  assert.equal(api.macroDecodeName(new Uint8Array(16)),'');assert.equal(api.macroDecodeName(new Uint8Array(16).fill(255)),'');
});
test('the maximum 4096-byte payload fits exactly and excess is rejected rather than truncated',()=>{
  const events=Array.from({length:682},()=>[{type:1,key:4,time:1},{type:0,key:4,time:1}]).flat();
  assert.equal(api.encodeRapooMacro(draft({package:events})).length,4096);
  assert.throws(()=>api.encodeRapooMacro(draft({package:[...events,{type:1,key:4,time:1},{type:0,key:4,time:1}]})));
});
test('imports reject invalid actions, stuck keys, unknown codes and oversize JSON',()=>{
  for(const macro of [draft({loop:0}),draft({package:[{type:1,key:4,time:0}]}),draft({package:[{type:0,key:4,time:0}]}),draft({package:[{type:3,key:4,time:0}]}),draft({package:[{type:1,key:250,time:0}]}),draft({package:[]})])assert.throws(()=>api.macroNormalize(macro));
  const text=JSON.stringify({app:'openatk',kind:'rapoo-macro',v:1,macro:draft()});assert.deepEqual(plain(api.parseRapooMacroFile(text)),draft());
  assert.throws(()=>api.parseRapooMacroFile(' '.repeat(262145)));assert.throws(()=>api.parseRapooMacroFile('{'));
  const ahub={Platform:'AHub',Macro:{Name:'AHUB',CycleNumber:2,PlayType:1,IgnoreDelay:false,InfoList:[{Type:0,Action:1,KeyCode:4},{Type:2,Delay:80},{Type:0,Action:0,KeyCode:4}]}};
  const decoded=api.parseRapooMacroFile(JSON.stringify(ahub));assert.equal(decoded.loop,2);assert.equal(decoded.package[0].time,80);
});
test('unknown stored events are read-only and retain their original bytes',()=>{
  const bytes=Uint8Array.of(7,0,1,0,1,0,250),decoded=api.decodeRapooMacro(bytes,'Unknown');
  assert.equal(decoded.supported,false);assert.deepEqual(Array.from(decoded.rawPayload),[...bytes]);
  assert.throws(()=>api.decodeRapooMacro(Uint8Array.of(7,0,1,0,0,0),'Bad'),/length/);
  assert.throws(()=>api.decodeRapooMacro(Uint8Array.of(7,0,1,0,0,0,247),'Bad'),/Truncated/);
  const flags=Uint8Array.of(14,0,1,0,0,0,248,224,0,0,0,0,0,0);assert.equal(api.decodeRapooMacro(flags,'Flags').supported,false);
});
test('metadata is lazy and reads only twelve 16-byte names',async()=>{
  const {driver,memory}=fixture(),reads=[];memory.set(api.macroNameBytes('Saved'),api.macroNameAddress(3));
  const read=driver.read;driver.read=async(a,n)=>{reads.push([a,n]);return read(a,n);};const list=await driver.loadMacros();
  assert.equal(list.length,12);assert.equal(list[3].name,'Saved');assert.equal(driver.s.macros,list);assert.ok(reads.every(([a,n])=>a>=0xfd00&&a<0xfdc0&&n===16));
});
test('save writes bounded packets, activates payload and name, and reads them back',async()=>{
  const {driver,memory,writes,activations}=fixture();const saved=await driver.saveMacro(11,draft());
  assert.equal(saved.name,'Example');assert.equal(saved.supported,true);assert.deepEqual(activations,[0x1b001,0xfdb1]);
  assert.ok(writes.every(write=>write.bytes.length<=24));assert.deepEqual([...memory.slice(0x1b000,0x1b00a)],[10,0,1,0,161,0,4,0,0,4]);
  assert.equal(driver.s.macros[11].name,'Example');
});
test('a macro bound in any profile cannot be overwritten or deleted',async()=>{
  const {driver,memory,writes}=fixture();memory.set([5,0,4,0],0x600+7*0x400+14*4);
  await assert.rejects(driver.saveMacro(4,draft()),/Unassign/);await assert.rejects(driver.deleteMacro(4),/Unassign/);assert.equal(writes.length,0);
});
test('explicit deletion clears payload and name only after checking bindings',async()=>{
  const {driver,memory}=fixture();memory.set(api.macroNameBytes('Old'),api.macroNameAddress(0));await driver.deleteMacro(0);
  assert.deepEqual([...memory.slice(0x10000,0x10004)],[4,0,1,0]);assert.ok(memory.slice(0xfd00,0xfd10).every(value=>value===0));assert.equal(driver.s.macros[0].name,'');
});
test('unsupported existing formats and activation mismatches never silently succeed',async()=>{
  const {driver,memory,writes}=fixture();memory.set(api.macroNameBytes('Unknown'),0xfd00);memory.set([7,0,1,0,1,0,250],0x10000);
  await assert.rejects(driver.saveMacro(0,draft()),/unsupported format/);assert.equal(writes.length,0);
  const other=fixture();other.driver.exchange=async()=>{other.memory[0x10000]=0;return new Uint8Array();};await assert.rejects(other.driver.saveMacro(0,draft()),/did not match/);
});
