const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../fm/index.html'),'utf8');
const stub=new Proxy(function(){},{get:(t,k)=>k===Symbol.toPrimitive?()=>'':stub,apply:()=>stub,set:()=>true});
function load(){
  const src=html.slice(html.indexOf('const VID = 0x361D;'),html.indexOf('let fm = null;'));
  const context=vm.createContext({Uint8Array,DataView,TextDecoder,TextEncoder,setTimeout,clearTimeout,Promise,Math,Number,$:()=>stub,document:stub,console});
  vm.runInContext(src+'\nglobalThis.api={Finalmouse,CMD,PROFILE_MAX,PROFILE_NAME_MAX};',context);
  return context.api;
}
const api=load();
function fixture({pid=0x300,supported=true}={}){
  const sent=[],listeners=new Set();
  const st={active:1,count:5,mask:0b00111,names:['Default','FPS','','',''],led:[0,1,2,3,4].map(i=>({mode:2,brightness:100,r:i*10,g:i*20,b:i*30}))};
  const out=(cmd,p)=>{const r=new Uint8Array(63);r[0]=2+p.length;r[1]=0x80|cmd;r[2]=p.length;r.set(p,3);for(const f of listeners)f({reportId:2,data:new DataView(r.buffer)});};
  const dev={vendorId:0x361D,productId:pid,opened:true,
    addEventListener(t,f){listeners.add(f);},removeEventListener(t,f){listeners.delete(f);},
    async sendReport(id,buf){
      const b=Array.from(buf),cmd=b[1]&127,n=b[2],p=b.slice(3,3+n);sent.push({cmd,p});
      if(!supported)return;
      if(cmd===57){if(n===0)out(57,[st.active,st.count]);else st.active=p[0];}
      if(cmd===63){if(n===0)out(63,[st.active,st.count,st.mask]);else st.mask=p[1]?st.mask|1<<p[0]:st.mask&~(1<<p[0]);}
      if(cmd===62){if(n===1)out(62,[p[0],...new TextEncoder().encode(st.names[p[0]]),0]);else st.names[p[0]]=new TextDecoder().decode(new Uint8Array(p.slice(1)));}
      if(cmd===61){if(n===1){const l=st.led[p[0]];out(61,[p[0],l.mode,l.brightness,l.r,l.g,l.b]);}else st.led[p[0]]={mode:p[1],brightness:p[2],r:p[3],g:p[4],b:p[5]};}
    }};
  return {fm:new api.Finalmouse(dev),dev,sent,st};
}
test('profile replies are parsed into state',async()=>{
  const {fm}=fixture();
  assert.equal(await fm.readProfiles(),true);
  const s=fm.state;
  assert.equal(s.profActive,1);assert.equal(s.profCount,5);assert.equal(s.profMask,7);
  assert.deepEqual(Array.from(s.profNames.slice(0,3)),['Default','FPS','']);
  assert.deepEqual({...s.profLed[2]},{mode:2,brightness:100,r:20,g:40,b:60});
  assert.equal(fm.profileOn(0),true);assert.equal(fm.profileOn(2),true);assert.equal(fm.profileOn(3),false);
});
test('names and colors are only read through the dongle',async()=>{
  const wired=fixture({pid:0x310});
  await wired.fm.readProfiles();
  assert.ok(wired.sent.every(f=>f.cmd===57||f.cmd===63));
  assert.equal(wired.fm.state.profNames,undefined);
  const dongle=fixture({pid:0x300});
  await dongle.fm.readProfiles();
  assert.equal(dongle.sent.filter(f=>f.cmd===62).length,5);
  assert.equal(dongle.sent.filter(f=>f.cmd===61).length,5);
  assert.deepEqual(dongle.sent.filter(f=>f.cmd===62).map(f=>f.p),[[0],[1],[2],[3],[4]]);
});
test('firmware without profiles leaves the state empty and skips the rest',async()=>{
  const {fm,sent}=fixture({supported:false});
  assert.equal(await fm.readProfiles(),false);
  assert.equal(fm.state.profActive,undefined);
  assert.ok(sent.every(f=>f.cmd===57));
});
test('a missing enable mask counts every slot as enabled',()=>{
  const {fm}=fixture();
  assert.equal(fm.profileOn(4),true);
  fm.state.profMask=0b00001;assert.equal(fm.profileOn(0),true);assert.equal(fm.profileOn(1),false);
});
test('profile count never exceeds the five slots Xpanel supports',()=>{
  const {fm}=fixture();
  fm.state.profCount=9;assert.equal(fm.profileSlots(),5);
  fm.state.profCount=3;assert.equal(fm.profileSlots(),3);
});
test('switch and enable frames carry the slot and flag',async()=>{
  const {fm,sent,st}=fixture();
  await fm.setProfile(2);assert.deepEqual(sent.at(-1),{cmd:57,p:[2]});assert.equal(st.active,2);
  await fm.setProfileOn(3,true);assert.deepEqual(sent.at(-1),{cmd:63,p:[3,1]});assert.equal(st.mask&8,8);
  await fm.setProfileOn(3,false);assert.deepEqual(sent.at(-1),{cmd:63,p:[3,0]});assert.equal(st.mask&8,0);
});
test('names are clipped to 31 bytes without splitting a character and empty names are refused',async()=>{
  const {fm,sent}=fixture();
  await fm.setProfileName(1,'a'.repeat(40));
  assert.equal(sent.at(-1).p.length,1+31);
  await fm.setProfileName(1,'é'.repeat(20));
  const p=sent.at(-1).p;assert.equal(p.length,1+30);
  assert.equal(new TextDecoder().decode(new Uint8Array(p.slice(1))),'é'.repeat(15));
  await assert.rejects(fm.setProfileName(1,''));
});
test('color writes keep the stored LED mode and brightness and need an existing entry',async()=>{
  const {fm,sent}=fixture();
  await assert.rejects(fm.setProfileColor(1,[1,2,3]));
  await fm.readProfiles();
  await fm.setProfileColor(1,[10,20,300]);
  assert.deepEqual(sent.at(-1),{cmd:61,p:[1,2,100,10,20,44]});
});
test('get requests for names and colors send the slot as the only argument',async()=>{
  const {fm,sent}=fixture();
  await fm.request(62,700,[3]);
  assert.deepEqual(sent.at(-1),{cmd:62,p:[3]});
});
