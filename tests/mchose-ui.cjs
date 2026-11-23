// node --test tests/mchose-ui.cjs
// Small DOM fixture running the page's real inline script; it does not verify browser layout.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../mchose/index.html'),'utf8');

function create(query,extra={}){
  const elements=new Map(),all=[],listeners=new Map();
  class Element {
    constructor(tag='div'){this.tagName=tag.toUpperCase();this.dataset={};this.style={};this.attributes={};this.children=[];this._class='';this._text='';this._value='';this.disabled=false;this.checked=false;this.open=false;
      this.classList={add:(...n)=>{const c=new Set(this._class.split(/\s+/).filter(Boolean));n.forEach(x=>c.add(x));this._class=[...c].join(' ');},
        remove:(...n)=>{this._class=this._class.split(/\s+/).filter(x=>!n.includes(x)).join(' ');},
        contains:n=>this._class.split(/\s+/).includes(n),toggle:(n,force)=>{const on=force??!this.classList.contains(n);on?this.classList.add(n):this.classList.remove(n);return on;}};}
    set className(v){this._class=String(v);} get className(){return this._class;}
    set value(v){this._value=String(v);}get value(){return this._value;}
    set textContent(v){this._text=String(v);this.children=[];}get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
    setAttribute(k,v){this.attributes[k]=String(v);if(k==='class')this.className=v;if(k==='id'){this.id=v;elements.set(v,this);}if(k.startsWith('data-'))this.dataset[k.slice(5)]=v;}
    getAttribute(k){return this.attributes[k]??null;}
    append(...c){for(const x of c){this.children.push(x);x.parentNode=this;}}
    replaceChildren(...c){this.children=[];this._text='';this.append(...c);}
    get childElementCount(){return this.children.length;}get firstChild(){return this.children[0];}
    remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(c=>c!==this);}
    click(){if(!this.disabled&&this.onclick)return this.onclick({target:this,preventDefault(){}});}
    focus(){document.activeElement=this;}select(){}
  }
  const body=new Element('body');
  for(const match of html.slice(html.indexOf('<body>'),html.indexOf('// UI start.')).matchAll(/<([a-z][\w-]*)(\s[^<>]*?)?>/gi)){
    const el=new Element(match[1]);const attrs=match[2]||'';
    for(const a of attrs.matchAll(/([\w-]+)="([^"]*)"/g))el.setAttribute(a[1],a[2]);
    if(/\bhidden(?:\s|>)/.test(attrs))el.hidden=true;all.push(el);
  }
  const document={body,documentElement:new Element('html'),title:'',hidden:false,activeElement:null,createElement:t=>new Element(t),
    addEventListener(t,fn){listeners.set(t,fn);},
    querySelector(s){return s.startsWith('#')?elements.get(s.slice(1)):null;},
    querySelectorAll(s){if(s==='[data-tab]')return all.filter(e=>e.dataset.tab);if(s==='[data-panel]')return all.filter(e=>e.dataset.panel);return[];}};
  const store=extra.storage||{};
  const hidListeners=[];
  const sandbox={document,location:{search:query,href:'',origin:'https://openatk.test'},navigator:{userAgent:'Test',userAgentData:{mobile:false},...(extra.hid?{hid:{addEventListener(t,fn){hidListeners.push(fn);},...extra.hid}}:{})},
    URLSearchParams,Uint8Array,TextEncoder,TextDecoder,structuredClone,setTimeout,clearTimeout,addEventListener(){},
    localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v);}},MchoseModels:extra.models,MchoseDrivers:extra.drivers};
  sandbox.window=sandbox;sandbox.parent=sandbox;sandbox.globalThis=sandbox;
  const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
  const app=new Function('sandbox','with(sandbox){'+scripts+'\nreturn {get driver(){return driver},get busy(){return busy},attach,detach,connect,resolve,started,dpiError};}')(sandbox);
  app.store=store;
  return {app,document,all,$:id=>elements.get(id)};
}
const wait=async(p)=>{await p.app.started;for(let i=0;i<400;i++){if(!p.app.busy)return;await new Promise(r=>setTimeout(r,5));}throw Error('UI stuck');};
const press=async(p,id,text)=>{const b=p.$(id).children.find(x=>x.textContent===text);assert.ok(b,'no button '+text+' in '+id);b.click();await wait(p);};
const labels=(p,id)=>p.$(id).children.map(b=>b.textContent);

const NULL_CAPS={dpi:{min:200,max:12000,step:50,maxStages:4,defaults:[400,800,1600,3200],independentXY:false},rates:[125,500,1000],wirelessMaxRate:null,lod:null,debounce:null,sleep:null,modes:null,motionSync:false,ripple:false,angleSnap:false,glass:false,rotation:false,profiles:1,remap:false,extra:{}};
const FULL_CAPS={dpi:{min:200,max:26000,step:50,maxStages:6,defaults:[400,800,1600,3200,6400,12800],independentXY:true},rates:[125,500,1000,2000,4000,8000],wirelessMaxRate:1000,lod:[0.7,1,2],debounce:{min:1,max:20,step:1,split:false},sleep:{min:1,max:100,never:true},modes:[{id:0,name:'Performance'}],motionSync:true,ripple:true,angleSnap:true,glass:true,rotation:true,profiles:3,remap:false,extra:{}};
const mk=(id,pids,caps,extra={})=>({id,name:id.toUpperCase(),family:'new',vid:0x3837,wired:[pids[0]],receiver:[pids[1]],filters:[{usagePage:0xff01}],caps,image:null,...extra});
const device=(pid,name)=>({vendorId:0x3837,productId:pid,productName:name||'M',opened:false,collections:[{usagePage:0xff01,usage:1}],async open(){this.opened=true;},async close(){this.opened=false;}});
function fakeDrivers(delay=0){
  const opened=[];
  const drv={family:'new',
    matches:(d,models)=>{const h=models.filter(m=>m.vid===d.vendorId&&[...m.wired,...m.receiver].includes(d.productId));return h.length===1?h[0]:undefined;},
    isConfigInterface:d=>d.collections.some(c=>c.usagePage===0xff01),
    async open(dev,model){
      const c=model.caps,inst={device:dev,model,wired:model.wired.includes(dev.productId),ready:true,faulted:false,closed:false,calls:[],
        state:{profile:0,profiles:[{slot:0,name:'A'}],stages:[{x:800,y:800},{x:1600,y:1600}],active:0,rate:1000,lod:null,debounce:null,sleep:null,motionSync:null,ripple:null,angleSnap:null,glass:null,angle:null,mode:null,battery:null},
        async readState(){return this.state;},close(){this.closed=true;}};
      inst.setRate=async function(hz){this.calls.push(['rate',hz]);if(delay)await new Promise(r=>setTimeout(r,delay));this.state.rate=hz;};
      inst.setDpi=async function(i,x,y){this.calls.push(['dpi',i,x,y]);this.state.stages[i]={x,y};};
      opened.push(inst);return inst;}};
  return {drv,opened};
}

test('Controls are hidden when their capability is null or false',async()=>{
  const {drv}=fakeDrivers();const m=mk('plain',[1,2],NULL_CAPS);
  const p=create('',{models:[m],drivers:{new:drv},hid:{async getDevices(){return[device(1)];}}});await wait(p);
  assert.ok(p.app.driver,'auto connected');
  for(const id of ['itemLod','itemDebounce','itemSleep','itemMode','itemAngle','itemMotionSync','itemRipple','itemAngleSnap','itemGlass','itemProfile','sectMotion','sectSurface'])assert.ok(p.$(id).classList.contains('hidden'),id+' hidden');
  assert.ok(!p.$('trackEmpty').classList.contains('hidden'));
  assert.ok(p.$('dpiYLabel').classList.contains('hidden'),'single DPI axis');
  assert.ok(!p.$('itemDpi').classList.contains('hidden')&&!p.$('itemRate').classList.contains('hidden'));
  assert.equal(p.$('sBatt').textContent,'…');
  const full=create('',{models:[mk('full',[1,2],FULL_CAPS)],drivers:{new:fakeDrivers().drv},hid:{async getDevices(){return[device(1)];}}});await wait(full);
  for(const id of ['itemLod','itemDebounce','itemSleep','itemMode','itemAngle','itemMotionSync','itemRipple','itemAngleSnap','itemGlass'])assert.ok(!full.$(id).classList.contains('hidden'),id+' shown');
  assert.ok(full.$('itemProfile').classList.contains('hidden'),'one profile hides selector');
  assert.deepEqual(labels(full,'segLod'),['0.7 mm','1 mm','2 mm']);
});

test('Polling rates are capped when connected through a receiver',async()=>{
  const m=mk('full',[1,2],FULL_CAPS),hid={async getDevices(){return[device(1),device(2)];}};
  const wired=create('',{models:[m],drivers:{new:fakeDrivers().drv},hid:{async getDevices(){return[device(1)];}}});await wait(wired);
  assert.deepEqual(labels(wired,'segRate'),['125','500','1K','2K','4K','8K']);
  assert.ok(wired.$('rateNote').classList.contains('hidden'));
  const rx=create('',{models:[m],drivers:{new:fakeDrivers().drv},hid:{async getDevices(){return[device(2)];}}});await wait(rx);
  assert.equal(rx.app.driver.wired,false);
  assert.deepEqual(labels(rx,'segRate'),['125','500','1K']);
  assert.ok(!rx.$('rateNote').classList.contains('hidden'));
  const demo=create('?demo=dongle');await wait(demo);
  assert.deepEqual(labels(demo,'segRate'),['125','250','500','1K']);
});

test('DPI stage editor enforces model bounds',async()=>{
  const {drv,opened}=fakeDrivers();const m=mk('full',[1,2],FULL_CAPS);
  const p=create('',{models:[m],drivers:{new:drv},hid:{async getDevices(){return[device(1)];}}});await wait(p);
  assert.deepEqual([p.$('dpiX').min,p.$('dpiX').max,p.$('dpiX').step].map(Number),[200,26000,50]);
  assert.equal(p.$('count').children.length,6);
  for(const bad of [100,26050,1225,801.5]){p.$('dpiX').value=bad;p.$('dpiY').value=800;p.$('saveDpi').click();await wait(p);assert.ok(p.$('toast').className.includes('bad'),'rejects '+bad);}
  assert.equal(opened[0].calls.length,0,'nothing was sent');
  p.$('dpiX').value=1200;p.$('dpiY').value=1300;p.$('saveDpi').click();await wait(p);
  assert.deepEqual(opened[0].calls[0],['dpi',0,1200,1300]);assert.equal(p.$('sDpi').textContent,'1200/1300');
  const single=create('',{models:[mk('plain',[1,2],NULL_CAPS)],drivers:{new:fakeDrivers().drv},hid:{async getDevices(){return[device(1)];}}});await wait(single);
  single.$('dpiX').value=1000;single.$('dpiY').value=9999;single.$('saveDpi').click();await wait(single);
  assert.deepEqual(single.app.driver.calls[0],['dpi',0,1000,1000],'Y follows X when axes are not independent');
  assert.equal(single.$('count').children.length,4);
});

test('Demo mode renders and a change round-trips through the demo driver',async()=>{
  const p=create('?demo=1');await wait(p);
  assert.ok(!p.$('app').classList.contains('hidden'));assert.ok(!p.$('demoBar').classList.contains('hidden'));
  assert.equal(p.app.driver.model.family,'demo');assert.equal(p.$('sBatt').textContent,'78%');
  assert.ok(!p.$('itemProfile').classList.contains('hidden'));
  await press(p,'segDpi','3,200 DPI');assert.equal(p.app.driver.state.stages[p.app.driver.state.active].x,3200);assert.equal(p.$('sDpi').textContent,'3200');
  assert.equal(p.$('toast').textContent,'Saved and verified');
  await press(p,'segRate','8K');assert.equal(p.app.driver.state.rate,8000);
  await press(p,'segLod','1.4 mm');assert.equal(p.app.driver.state.lod,1.4);
  p.$('debRelease').value=12;p.$('debRelease').onchange({target:p.$('debRelease')});await wait(p);assert.deepEqual(p.app.driver.state.debounce,{press:4,release:12});
  await press(p,'segSleep','Never');assert.equal(p.app.driver.state.sleep,0);
  await press(p,'segMode','Gaming');assert.equal(p.app.driver.state.mode,1);
  p.$('angle').value=-12;p.$('angle').onchange({target:p.$('angle')});await wait(p);assert.equal(p.app.driver.state.angle,-12);
  p.$('ripple').checked=true;p.$('ripple').onchange({target:p.$('ripple')});await wait(p);assert.equal(p.app.driver.state.ripple,true);
  await press(p,'segProfile','Competitive');assert.equal(p.app.driver.state.profile,1);assert.equal(p.app.driver.state.rate,500,'profile switch loads its own settings');
  p.$('dpiX').value=10;p.$('saveDpi').click();await wait(p);assert.ok(p.$('toast').className.includes('bad'));
});

test('A busy write never disables the whole controls fieldset',async()=>{
  const {drv}=fakeDrivers(30);
  const p=create('',{models:[mk('full',[1,2],FULL_CAPS)],drivers:{new:drv},hid:{async getDevices(){return[device(1)];}}});await wait(p);
  p.$('segRate').children.find(b=>b.textContent==='500').click();
  assert.ok(p.app.busy);assert.equal(p.$('controls').disabled,false);
  await wait(p);assert.equal(p.app.driver.state.rate,500);
});

test('Auto reconnect picks the remembered authorized device',async()=>{
  const models=[mk('a',[10,11],NULL_CAPS),mk('b',[20,21],FULL_CAPS)];
  const devs=()=>[device(10,'A'),device(20,'B')];
  const list=devs();
  const remembered=create('',{models,drivers:{new:fakeDrivers().drv},storage:{'mchose:last':'3837:14'},hid:{async getDevices(){return list;}}});await wait(remembered);
  assert.equal(remembered.app.driver.device.productId,20);
  assert.equal(remembered.$('connect').textContent,'Change device');
  const none=create('',{models,drivers:{new:fakeDrivers().drv},hid:{async getDevices(){return devs();}}});await wait(none);
  assert.equal(none.app.driver,null,'two devices and no memory: wait for the user');
  const single=create('',{models,drivers:{new:fakeDrivers().drv},hid:{async getDevices(){return[device(21)];}}});await wait(single);
  assert.equal(single.app.driver.device.productId,21);assert.equal(single.app.store['mchose:last'],'3837:15');
  const missing=create('',{models,drivers:{},hid:{async getDevices(){return[device(10)];}}});await wait(missing);
  assert.equal(missing.app.driver,null,'a family with no driver loaded is not offered');
});

test('Connect builds filters from the registry and opens the matching interface',async()=>{
  const {drv}=fakeDrivers();let seen;
  const other=device(10);other.collections=[{usagePage:1,usage:2}];
  const p=create('',{models:[mk('a',[10,11],NULL_CAPS,{filters:[{usagePage:0xff01},{usagePage:0xff0b,usage:2}]})],drivers:{new:drv},
    hid:{async getDevices(){return[];},async requestDevice(o){seen=o;return[other,device(10)];}}});await wait(p);
  await p.app.connect();await wait(p);
  assert.equal(seen.filters.length,4);assert.deepEqual(seen.filters[1],{vendorId:0x3837,productId:10,usagePage:0xff0b,usage:2});
  assert.equal(p.app.driver.device.collections[0].usagePage,0xff01);
  assert.ok(p.$('kv').children.some(r=>r.textContent==='USB identity3837:000A'));
});

test('Device tab flags inferred USB IDs',async()=>{
  const p=create('',{models:[mk('a',[10,11],NULL_CAPS,{pids:[{pid:10,inferred:false},{pid:11,inferred:true}]})],drivers:{new:fakeDrivers().drv},hid:{async getDevices(){return[device(11)];}}});await wait(p);
  assert.ok(!p.$('inferredNote').classList.contains('hidden'));
  const q=create('',{models:[mk('a',[10,11],NULL_CAPS,{pids:[{pid:10,inferred:false},{pid:11,inferred:true}]})],drivers:{new:fakeDrivers().drv},hid:{async getDevices(){return[device(10)];}}});await wait(q);
  assert.ok(q.$('inferredNote').classList.contains('hidden'));
});

test('A shared USB ID asks the user, remembers the pick, and never guesses',async()=>{
  const pids=ids=>({pids:ids.map(pid=>({pid,vid:0x3837,inferred:false}))});
  const models=[mk('p1',[30,50],NULL_CAPS,pids([30,50])),mk('p2',[31,50],FULL_CAPS,pids([31,50]))];
  const hid=(extra={})=>({async getDevices(){return[];},async requestDevice(){return[device(50)];},...extra});
  const p=create('',{models,drivers:{new:fakeDrivers().drv},hid:hid()});await wait(p);
  const c=p.app.connect();await new Promise(r=>setTimeout(r,20));
  assert.ok(!p.$('picker').classList.contains('hidden'));assert.deepEqual(labels(p,'pickList'),['P1','P2']);assert.equal(p.app.driver,null);
  p.$('pickList').children[1].click();await c;await wait(p);
  assert.equal(p.app.driver.model.id,'p2');
  const cancel=create('',{models,drivers:{new:fakeDrivers().drv},hid:hid()});await wait(cancel);
  const c2=cancel.app.connect();await new Promise(r=>setTimeout(r,20));cancel.$('pickCancel').click();await c2;
  assert.equal(cancel.app.driver,null);
  const storage={'mchose:pick:3837:32':'p1'};
  const again=create('',{models,drivers:{new:fakeDrivers().drv},storage,hid:hid({async getDevices(){return[device(50)];}})});await wait(again);
  assert.equal(again.app.driver,null,'no remembered pick: no auto connect');
  const saved=create('',{models,drivers:{new:fakeDrivers().drv},storage:{'mchose:pick:3837:32':'p2'},hid:hid({async getDevices(){return[device(50)];}})});await wait(saved);
  assert.equal(saved.app.driver.model.id,'p2','remembered pick reused on auto reconnect');
});

test('Models without a protocol yet show a support-in-progress state',async()=>{
  const g=mk('gx',[40,41],NULL_CAPS,{family:'g',extra:{protocolPending:true}});
  const p=create('',{models:[g],drivers:{new:fakeDrivers().drv},hid:{async getDevices(){return[];},async requestDevice(){return[device(40)];}}});await wait(p);
  await p.app.connect();await wait(p);
  assert.equal(p.app.driver,null);assert.ok(p.$('connectError').textContent.includes('still in progress'));
  assert.ok(p.$('app').classList.contains('hidden'));
});
