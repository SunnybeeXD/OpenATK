// node --test tests/rapoo-buttons.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function load(){
  const html=fs.readFileSync(path.join(__dirname,'../rapoo/index.html'),'utf8');
  let code=html.slice(html.indexOf('// Protocol start.'),html.indexOf('// Protocol end.'));
  assert.ok(code.includes('// Buttons helpers start.')&&code.includes('// Buttons methods start.'),'Button implementation must be in the shipped page');
  const context=vm.createContext({Uint8Array,DataView,TextDecoder,TextEncoder,setTimeout,clearTimeout});
  vm.runInContext(code+'\nglobalThis.api={Rapoo,RAPOO_BUTTON_DEFAULTS,rapooEncodeButton,rapooDecodeButton,rapooUsableLeftClick};',context);
  return context.api;
}
const api=load(),plain=value=>JSON.parse(JSON.stringify(value));
function fixture(){
  const memory=new Uint8Array(0x20000),sent=[];
  for(let p=0;p<8;p++)for(let i=0;i<15;i++)memory.set(api.RAPOO_BUTTON_DEFAULTS[i],0x600+p*0x400+i*4);
  let reply=Uint8Array.of(1,0,0,0);
  const device={vendorId:0x24ae,productId:0x4b07,opened:true,collections:[{usagePage:0xff00,usage:2}],addEventListener(){},removeEventListener(){},
    async sendReport(id,frame){assert.equal(id,6);sent.push([...frame]);const a=(frame[3]|frame[4]<<8|frame[5]<<16|frame[6]<<24)>>>0;
      if(frame[1]===0xa5)memory.set(frame.slice(7,7+frame[2]),a);
      reply=Uint8Array.from([1,0,0,0,...(frame[1]===0xa4?memory.slice(a,a+frame[2]):[])]);
    },async receiveFeatureReport(id){assert.equal(id,8);return new DataView(reply.buffer);}};
  const driver=new api.Rapoo(device,{delay:0});driver.model={...driver.model,keys:[0,1,2,5,6,9,10,13]};driver.ready=true;driver.s={profile:0};
  return{driver,memory,sent,device};
}
test('button encoders match the vendor four-byte records',()=>{
  assert.deepEqual(plain(api.rapooEncodeButton({kind:'mouse',button:'left'},0)),[3,0,1,0]);
  assert.deepEqual(plain(api.rapooEncodeButton({kind:'mouse',button:'middle'},1)),[3,0,4,0]);
  assert.deepEqual(plain(api.rapooEncodeButton({kind:'mouse',button:'forward'},5)),[3,0,16,0]);
  assert.deepEqual(plain(api.rapooEncodeButton({kind:'keyboard',code:6,modifiers:0},5)),[0,0,6,0]);
  assert.deepEqual(plain(api.rapooEncodeButton({kind:'keyboard',code:6,code2:25,modifiers:0x81},5)),[2,6,129,25]);
  assert.deepEqual(plain(api.rapooEncodeButton({kind:'disabled'},5)),[7,0,0,0]);
  assert.deepEqual(plain(api.rapooEncodeButton({kind:'dpi',direction:'up'},5)),[8,0,5,0]);
  assert.deepEqual(plain(api.rapooEncodeButton({kind:'dpi',direction:'down'},5)),[8,0,6,0]);
  assert.deepEqual(plain(api.rapooEncodeButton({kind:'macro',slot:11},5)),[5,0,11,0]);
  assert.deepEqual(plain(api.rapooEncodeButton({kind:'wheel',direction:'up'},10)),[11,255,1,255]);
  assert.deepEqual(plain(api.rapooEncodeButton({kind:'default'},13)),[10,0,0,0]);
  assert.throws(()=>api.rapooEncodeButton({kind:'macro',slot:12},5));assert.throws(()=>api.rapooEncodeButton({kind:'keyboard',code:0},5));
  assert.throws(()=>api.rapooEncodeButton({kind:'wheel',direction:'up'},0));assert.throws(()=>api.rapooEncodeButton({kind:'raw',raw:[0,0,0,0]},5));
});
test('unsupported and ambiguous records stay raw instead of being silently converted',()=>{
  for(const raw of [[13,1,2,3],[255,255,255,255],[3,1,1,0],[3,0,3,0],[8,0,1,0]])assert.equal(api.rapooDecodeButton(raw,0).kind,'preserve');
  assert.deepEqual(plain(api.rapooDecodeButton([2,6,129,25],5)),{kind:'keyboard',code:6,code2:25,modifiers:129});
});
test('button loading reads all fifteen records without writing',async()=>{
  const {driver,sent}=fixture();const result=await driver.loadButtons();
  assert.equal(result.profile,0);assert.equal(result.rows.length,15);assert.deepEqual(plain(result.rows[0].raw),[3,0,1,0]);
  assert.equal(result.rows[13].action.kind,'preserve');assert.ok(sent.every(f=>f[1]===0xa4));
});
test('a remap writes only the selected four-byte slot and verifies it',async()=>{
  const {driver,sent,memory}=fixture();memory.set([13,70,80,90],0x600+2*4);
  await driver.loadButtons();sent.length=0;await driver.setButton(5,{kind:'keyboard',code:6,modifiers:1});
  assert.deepEqual(sent.filter(f=>f[1]===0xa5),[[255,165,4,20,6,0,0,2,6,1,0]]);
  assert.deepEqual([...memory.slice(0x600+8,0x600+12)],[13,70,80,90],'Unrelated unknown bytes survive');
  assert.deepEqual(plain(driver.s.buttons.rows[5].raw),[2,6,1,0]);
});
test('last-left guard rereads hardware and does not trust a stale cached map',async()=>{
  const {driver,sent}=fixture();await driver.loadButtons();driver.s.buttons.rows[5].raw=[3,0,1,0];sent.length=0;
  await assert.rejects(driver.setButton(0,{kind:'mouse',button:'right'}),/at least one physical/);
  assert.ok(sent.every(f=>f[1]!==0xa5));
});
test('unused slots and wheel controls cannot satisfy the left-click guard',async()=>{
  const {driver,memory,sent}=fixture();memory.set([3,0,1,0],0x600+7*4);memory.set([3,0,1,0],0x600+9*4);
  await assert.rejects(driver.setButton(0,{kind:'disabled'}),/physical button/);assert.ok(sent.every(f=>f[1]!==0xa5));
  await assert.rejects(driver.setButton(7,{kind:'mouse',button:'left'}),/not present/);
});
test('mapping a second physical left click allows changing the first',async()=>{
  const {driver,memory}=fixture();await driver.setButton(5,{kind:'mouse',button:'left'});await driver.setButton(0,{kind:'mouse',button:'right'});
  assert.deepEqual([...memory.slice(0x600,0x604)],[3,0,2,0]);
  await assert.rejects(driver.setButton(5,{kind:'default'}),/physical button/);
});
test('binding a macro requires both a stored name and a valid payload length',async()=>{
  const {driver,memory,sent}=fixture();const slot=2,a=0x10000+slot*4096;
  await assert.rejects(driver.setButton(5,{kind:'macro',slot}),/named macro/);assert.ok(sent.every(f=>f[1]!==0xa5));
  memory.set(Buffer.from('Test macro'),0xfd00+slot*16);memory[a]=4;
  await assert.rejects(driver.setButton(5,{kind:'macro',slot}),/valid stored actions/);
  memory[a]=10;await driver.setButton(5,{kind:'macro',slot});assert.deepEqual([...memory.slice(0x600+20,0x600+24)],[5,0,2,0]);
});
test('profile changes prevent stale button loads and writes',async()=>{
  const {driver,memory,sent}=fixture();memory[0x10c]=1;
  await assert.rejects(driver.loadButtons(),/profile changed/);assert.ok(sent.every(f=>f[1]!==0xa5));
});
test('a failed write verification leaves the cached mapping unchanged',async()=>{
  const {driver,device}=fixture();await driver.loadButtons();const before=plain(driver.s.buttons.rows[5].raw),send=device.sendReport.bind(device);
  device.sendReport=async(id,frame)=>{if(frame[1]===0xa5){const wrong=Uint8Array.from(frame);wrong[9]=0;return send(id,wrong);}return send(id,frame);};
  await assert.rejects(driver.setButton(5,{kind:'mouse',button:'back'}),/Read-back/);assert.deepEqual(plain(driver.s.buttons.rows[5].raw),before);
});
