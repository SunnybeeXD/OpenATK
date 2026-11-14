// node --test tests/rapoo-profiles.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const page=fs.readFileSync(path.join(__dirname,'../rapoo/index.html'),'utf8');
function load(){
  let source=page.slice(page.indexOf('// Protocol start.'),page.indexOf('// Protocol end.'));
  assert.ok(source.includes('createManagedProfile('),'Profile management must be in the shipped page');
  const context=vm.createContext({Uint8Array,DataView,TextEncoder,TextDecoder,setTimeout,clearTimeout});
  vm.runInContext(source+'\nglobalThis.api={Rapoo,MODELS,profileAddress,profileNameBytes,profileDecodeName,profileUserSlots,makeProfileSettingsBackup,validateProfileSettingsBackup,profileSettingsPreview,RAPOO_BUTTON_DEFAULTS};',context);return context.api;
}
const api=load();
function fixture(){
  const model=api.MODELS.find(m=>m.name==='VT3S MAX V2'),memory=new Uint8Array(0x3000),frames=[],listeners=new Set();
  memory[0x10c]=memory[0x10d]=1;memory[0x60]=2;
  for(let p=0;p<8;p++){
    const a=o=>0x600+p*0x400+o;
    if(p<3)memory.set(Buffer.from(['Default','Gaming','Creative'][p]),a(1004));
    memory[a(640)]=1;memory[a(641)]=4;memory[a(644)]=4;memory[a(645)]=1;memory[a(662)]=3;memory[a(664)]=1;
    memory.set([2,8,10,0xab,0,0],a(704));memory.set([1,1,2,4,4,4,4],a(732));
    [400,800,1600,3200,6400,12800,25600].forEach((dpi,i)=>{for(const offset of [648,712]){memory[a(offset+i*2)]=dpi&255;memory[a(offset+i*2+1)]=dpi>>>8;}});
  }
  let reply=Uint8Array.of(1,0,0,0);
  const device={vendorId:0x24ae,productId:model.wired,opened:true,collections:[{usagePage:0xff00,usage:2}],addEventListener(t,fn){listeners.add(fn);},removeEventListener(t,fn){listeners.delete(fn);},async sendReport(id,frame){assert.equal(id,6);frames.push([...frame]);const addr=(frame[3]|frame[4]<<8|frame[5]<<16|frame[6]<<24)>>>0;if(frame[1]===0xa5)memory.set(frame.slice(7,7+frame[2]),addr);reply=Uint8Array.from([1,0,0,0,...(frame[1]===0xa4?memory.slice(addr,addr+frame[2]):[])]);},async receiveFeatureReport(id){assert.equal(id,8);return new DataView(reply.buffer,reply.byteOffset,reply.byteLength);}};
  const driver=new api.Rapoo(device,{delay:0});driver.profileSettleDelay=driver.profileRetryDelay=0;return{driver,memory,frames};
}
const plain=value=>JSON.parse(JSON.stringify(value));
test('profile names use trimmed, padded UTF-8 with a strict 16-byte limit',()=>{
  assert.equal(api.profileNameBytes('  Gaming  ').length,16);assert.equal(api.profileDecodeName(api.profileNameBytes('  Gaming  ')),'Gaming');
  assert.equal(api.profileDecodeName(api.profileNameBytes('四个汉字')),'四个汉字');
  assert.throws(()=>api.profileNameBytes('一二三四五六'),/16 UTF-8/);assert.throws(()=>api.profileNameBytes(' '));assert.throws(()=>api.profileNameBytes('bad\0name'));
});
test('creating a profile only names an empty user slot and leaves stored settings unchanged',async()=>{
  const {driver,memory,frames}=fixture();await driver.readState();frames.length=0;const settings=memory.slice(0x600+3*0x400,0x600+3*0x400+1004);
  assert.equal(await driver.createManagedProfile('Work'),3);assert.equal(driver.s.profiles.find(p=>p.slot===3).name,'Work');
  assert.deepEqual(memory.slice(0x600+3*0x400,0x600+3*0x400+1004),settings);
  assert.deepEqual(frames.filter(f=>f[1]===0xa5).map(f=>[f[3]|f[4]<<8,f[2]]),[[0x15ec,16]]);
  await assert.rejects(driver.createManagedProfile('Bad',1),/empty user/);await assert.rejects(driver.createManagedProfile('Bad',8),/empty user/);
});
test('renaming updates only the name and cannot edit reserved slots',async()=>{
  const {driver,frames}=fixture();await driver.readState();driver.model={...driver.model,userProfileSlots:[0,1]};frames.length=0;
  await assert.rejects(driver.renameManagedProfile(2,'Reserved'),/reserved/);await driver.renameManagedProfile(1,'Daily');
  assert.equal(driver.s.profiles.find(p=>p.slot===1).name,'Daily');assert.equal(frames.filter(f=>f[1]===0xa5).length,1);
});
test('deleting the active non-default profile selects slot zero, clears name and restores vendor key defaults',async()=>{
  const {driver,memory,frames}=fixture();await driver.readState();frames.length=0;await driver.deleteManagedProfile(1);
  const writes=frames.filter(f=>f[1]===0xa5);assert.deepEqual(writes[0],[255,165,2,12,1,0,0,0,0]);
  assert.deepEqual(writes.slice(1,3).map(f=>[f[2],f[3]|f[4]<<8]),[[16,0xdec],[0,0xdec]]);
  assert.equal(memory[0x10c],0);assert.equal(driver.s.profile,0);assert.equal(driver.ready,false);assert.ok(memory.slice(0xdec,0xdfc).every(v=>v===0));
  for(let i=0;i<15;i++)assert.deepEqual([...memory.slice(0xa00+i*4,0xa00+i*4+4)],plain(api.RAPOO_BUTTON_DEFAULTS[i]));
});
test('default/last profile deletion is rejected without EEPROM writes',async()=>{
  const {driver,memory,frames}=fixture();await driver.readState();frames.length=0;await assert.rejects(driver.deleteManagedProfile(0),/default/);assert.ok(frames.every(f=>f[1]!==0xa5));
  memory.fill(0,0x9ec,0x9fc);frames.length=0;await assert.rejects(driver.deleteManagedProfile(1),/default/);assert.ok(frames.every(f=>f[1]!==0xa5));
});
test('settings backup validates model, keys, ranges and excludes global and button/macro state',async()=>{
  const {driver}=fixture();await driver.readState();const backup=await driver.exportProfileSettings();
  assert.equal(backup.kind,'rapoo-profile-settings');assert.equal(backup.settings.dpi.count,4);assert.equal(backup.settings.rfPacket,undefined);assert.equal(backup.settings.buttons,undefined);assert.equal(backup.settings.macros,undefined);assert.ok(api.profileSettingsPreview(backup,driver.model).length>8);
  for(const mutate of [b=>b.model='Other',b=>b.settings.dpi.count=8,b=>b.settings.dpi.stages[0].x=60001,b=>b.settings.sleep=0,b=>b.settings.modes[0]=5,b=>b.settings.rfPacket=0,b=>b.settings.eeprom={address:0,bytes:[0]}]){const bad=plain(backup);mutate(bad);assert.throws(()=>api.validateProfileSettingsBackup(bad,driver.model));}
});
test('restore touches only validated active-profile settings and preserves names, buttons, reserved correction bits and global RF',async()=>{
  const {driver,memory,frames}=fixture();await driver.readState();const backup=await driver.exportProfileSettings();backup.settings.dpi.stages[0]={x:1701,y:1902};backup.settings.dpi.count=2;backup.settings.dpi.stages=backup.settings.dpi.stages.slice(0,2);backup.settings.dpi.active=1;backup.settings.angleSnap=true;backup.settings.ripple=true;backup.settings.sleep=30;
  const names=memory.slice(0xdec,0xdfc),buttons=memory.slice(0xa00,0xa00+60),reserved=memory[0xa00+707]&~3;frames.length=0;
  await driver.restoreProfileSettings(backup);assert.equal(memory[0x60],2);assert.deepEqual(memory.slice(0xdec,0xdfc),names);assert.deepEqual(memory.slice(0xa00,0xa00+60),buttons);assert.equal(memory[0xa00+707],reserved);assert.equal(memory[0xa00+662],1);assert.equal(memory[0xa00+664],1);assert.equal(memory[0xa00+706],30);
  assert.ok(frames.filter(f=>f[1]===0xa5).every(f=>{const a=f[3]|f[4]<<8;return a>=0xa00+640&&a<=0xa00+738;}));
  const writes=frames.filter(f=>f[1]===0xa5);assert.deepEqual(writes.slice(0,5).map(f=>[f[3]|f[4]<<8,f[2]]),[[0xc88,4],[0xcc8,4],[0xc98,1],[0xc96,1],[0xc98,1]]);
});
test('invalid restore is rejected before any USB command',async()=>{
  const {driver,frames}=fixture();await driver.readState();const backup=await driver.exportProfileSettings();backup.settings.angle=31;frames.length=0;
  assert.throws(()=>driver.restoreProfileSettings(backup));assert.equal(frames.length,0);
});

test('DC mode backs up and restores; legacy backups leave DC untouched',async()=>{
  const {driver,memory,frames}=fixture(),address=api.profileAddress(1,730);memory[address]=1;await driver.readState();
  const backup=await driver.exportProfileSettings();assert.equal(backup.settings.dc,true);assert.ok(api.profileSettingsPreview(backup,driver.model).includes('DC mode: on'));
  memory[address]=0;await driver.restoreProfileSettings(backup);assert.equal(memory[address],1);await driver.readState();
  delete backup.settings.dc;frames.length=0;await driver.restoreProfileSettings(backup);assert.equal(memory[address],1);
  assert.ok(frames.filter(f=>f[1]===0xa5).every(f=>(f[3]|f[4]<<8)!==address));
  backup.settings.dc=1;frames.length=0;assert.throws(()=>driver.restoreProfileSettings(backup),/DC mode/);assert.equal(frames.length,0);
});
