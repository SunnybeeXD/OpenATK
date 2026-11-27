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
  vm.runInContext(src+'\nglobalThis.api={fmtMm,Keyboard,SW_LIST,SW_BY_ID,SW_MIN_FW,CH_SW};',context);
  return context.api;
}
const api=load();
const R=5,C=14;
function fixture({supported=[1,7,8,12],statuses=[],corrupt=false,unsupported=false,travel=[4000,3500,3750,3300],count}={}){
  const sent=[];
  const m=new Array(R*C).fill(1);
  const dev={oninputreport:null,
    async sendReport(id,buf){
      const b=Array.from(buf);sent.push(b);
      const r=b.slice();
      if(!unsupported&&(b[0]===2||b[0]===3)&&b[1]===0x96&&b[2]===0x10){
        const sub=b[5];
        if(sub===8){r[6]=supported.length;supported.forEach((v,i)=>r[7+i]=v);}
        else if(sub===9){r[6]=count??travel.length;travel.forEach((v,i)=>{r[7+2*i]=v>>8;r[8+2*i]=v&255;});}
        else if(sub===4){const off=(b[6]<<8)|b[7],n=b[8];r[8]=n;for(let k=0;k<n;k++)r[9+k]=m[off+k];}
        else if(sub===5){const s=statuses.length?statuses.shift():0;if(s===0&&!corrupt)m[b[3]*C+b[4]]=b[6];r[7]=s;}
      }
      setTimeout(()=>dev.oninputreport({data:new DataView(new Uint8Array(r.slice(0,32)).buffer)}),0);
    }};
  const kb=new api.Keyboard(dev,{m:[R,C]});
  kb.swWait=0;
  return {kb,sent,m};
}
const hex=b=>b.slice(0,10).map(v=>v.toString(16).padStart(2,'0')).join(' ');

test('supported list read',async()=>{
  const {kb,sent}=fixture();
  assert.deepEqual(await kb.swSupported(),[1,7,8,12]);
  assert.equal(hex(sent[0]),'02 96 10 00 00 08 00 00 00 00');
});
test('an echoing or empty device is rejected',async()=>{
  await assert.rejects(fixture({unsupported:true}).kb.swSupported());
  await assert.rejects(fixture({supported:[]}).kb.swSupported());
  await assert.rejects(fixture({supported:[7,7]}).kb.swSupported());
});
test('matrix read uses 23 key frames',async()=>{
  const {kb,sent}=fixture();
  const m=await kb.swReadMatrix();
  assert.equal(m.length,R*C);
  assert.equal(sent.length,4);
  assert.equal(hex(sent[1]),'02 96 10 00 00 04 00 17 17 00');
  assert.equal(hex(sent[3]),'02 96 10 00 00 04 00 45 01 00');
});
test('write is per key, checked and read back',async()=>{
  const {kb,sent,m}=fixture();
  const after=await kb.swWrite([[1,2],[0,0]],7,[1,7,8,12]);
  const sets=sent.filter(f=>f[0]===3);
  assert.equal(sets.length,2);
  assert.equal(hex(sets[0]),'03 96 10 01 02 05 07 00 00 00');
  assert.equal(hex(sets[1]),'03 96 10 00 00 05 07 00 00 00');
  assert.equal(m[16],7);assert.equal(after[0],7);assert.equal(after[1],1);
  assert.ok(sent.slice(-4).every(f=>f[0]===2&&f[5]===4));
});
test('validation rejects before any write',async()=>{
  const {kb,sent}=fixture();
  await assert.rejects(kb.swWrite([[1,2]],99,[1,7]),/bad switch/);
  await assert.rejects(kb.swWrite([[1,2]],255,[1,7]),/bad switch/);
  await assert.rejects(kb.swWrite([],7,[1,7]),/no keys/);
  await assert.rejects(kb.swWrite([[5,0]],7,[1,7]),/out of range/);
  await assert.rejects(kb.swWrite([[0,14]],7,[1,7]),/out of range/);
  assert.equal(sent.filter(f=>f[0]===3).length,0);
});
test('busy status retries then succeeds, other statuses fail',async()=>{
  const f=fixture({statuses:[2,2,0]});
  await f.kb.swWrite([[0,1]],8,[1,8]);
  assert.equal(f.sent.filter(x=>x[0]===3).length,3);
  await assert.rejects(fixture({statuses:[1]}).kb.swWrite([[0,1]],8,[1,8]),/failed/);
  await assert.rejects(fixture({statuses:[3]}).kb.swWrite([[0,1]],8,[1,8]),/not supported/);
  await assert.rejects(fixture({statuses:[2,2,2,2,2]}).kb.swWrite([[0,1]],8,[1,8]),/busy/);
});
test('read-back mismatch is an error',async()=>{
  await assert.rejects(fixture({corrupt:true}).kb.swWrite([[0,1]],8,[1,8]),/read-back mismatch/);
});
test('catalogue and firmware gates',()=>{
  assert.ok(!api.SW_BY_ID.has(255));
  assert.ok(!api.SW_BY_ID.has(36));
  for(const id of [1,7,8,12,25,29,33,35])assert.ok(api.SW_BY_ID.get(id)[4]);
  assert.equal(api.SW_MIN_FW['EDGE 60HE ULTIMATE'],1.35);
  assert.equal(api.SW_MIN_FW['ATK EDGE75'],1.11);
  assert.equal(api.SW_MIN_FW['ATK RS6 Ultra'],1.4);
});

test('travel read is one read-only sub 9 frame, big endian in 0.001 mm',async()=>{
  const {kb,sent}=fixture();
  const t=await kb.swTravel([1,7,8,12]);
  assert.equal(sent.length,1);
  assert.equal(hex(sent[0]),'02 96 10 00 00 09 00 00 00 00');
  assert.equal(sent[0].length,32);
  assert.ok(sent.every(f=>f[0]===2));
  assert.deepEqual([...t],[[1,4],[7,3.5],[8,3.75],[12,3.3]]);
});
test('travel formatting',()=>{
  assert.equal(api.fmtMm(4),'4.0');
  assert.equal(api.fmtMm(3.5),'3.5');
  assert.equal(api.fmtMm(3.75),'3.75');
  assert.equal(api.fmtMm(3.3),'3.3');
  assert.equal(api.fmtMm(3.456),'3.46');
});
test('bad travel replies are ignored without throwing',async()=>{
  const ids=[1,7,8,12];
  assert.equal(await fixture({unsupported:true}).kb.swTravel(ids),null);
  assert.equal(await fixture({count:3}).kb.swTravel(ids),null);
  assert.equal(await fixture({count:5}).kb.swTravel(ids),null);
  assert.equal(await fixture({travel:[4000,0,3750,3300]}).kb.swTravel(ids),null);
  assert.equal(await fixture({travel:[4000,3500,400,3300]}).kb.swTravel(ids),null);
  assert.equal(await fixture({travel:[4000,3500,3750,10001]}).kb.swTravel(ids),null);
  const ids30=Array.from({length:30},(_,i)=>i+1);
  assert.equal(await fixture({travel:new Array(30).fill(3500),count:30}).kb.swTravel(ids30),null);
  const f=fixture();f.kb.getCustom=async()=>{throw new Error('timeout');};
  assert.equal(await f.kb.swTravel(ids),null);
});
