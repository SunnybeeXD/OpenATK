(function(root){
'use strict';
const SHORT_ID=0x11,LONG_ID=0x12;
const DATA_LENGTH={[SHORT_ID]:20,[LONG_ID]:64};
const CONFIG_USAGE_PAGES=[0xff01,0xff0b];
const IGNORED_INPUT_IDS=[0x2c,0x2d];
const LEGACY_RATES=[125,500,1000,2000,4000,8000];
const CMD={deviceInfo:0x06,fullRead:0x67,name:0x68,sleep:0x0a,dpi:0x40,rate:0x41,sensor:0x42,debounce:0x43,profile:0x58};
const FULL_READ_BYTES=63;
const STATUS_REPORT=0xe2,DONE_REPORT=0xe5;
const WATCHDOG_MS=150,WATCHDOG_FULL_READ_MS=600,WATCHDOG_STEP_MS=50;
const RETRY_MS=100,READ_ATTEMPTS=4,SEND_ATTEMPTS=5,SEND_BACKOFF_MS=50;
const TIMEOUT_MS=3000,PROFILE_SETTLE_MS=100,MAX_LOGGED_INPUT=40;
const RATE_IN_HIGH_NIBBLE=true;
const DPI_DIFF_BYTE=255;
const DPI_STAGE_LIMIT=6;
const DEFAULT_DPI_STEP=50,DEFAULT_DPI_MIN=200;
const DEFAULT_DEBOUNCE={min:0,max:20,step:1};
const DEFAULT_SLEEP={min:1,max:100,never:true};
const ANGLE_LIMIT=30;
const CHARGING_IS_NONZERO=true;
const PROFILE_CHANGED_BIT=0x80;
const FLAG_BITS={ripple:2,angleSnap:3,motionSync:4};
const FLAG_FIELD={ripple:2,angleSnap:3,motionSync:4};
const FLAG_ON=1,FLAG_OFF=2;
const SUPPORTED_MODE_IDS=[0,1,2];

function toBytes(raw){
  if(raw instanceof Uint8Array)return raw;
  if(raw&&raw.buffer)return new Uint8Array(raw.buffer,raw.byteOffset||0,raw.byteLength);
  return Uint8Array.from(raw||[]);
}
function encodeRequest(id,bytes){
  const length=DATA_LENGTH[id];
  if(!length)throw new Error('Unknown report id');
  if(bytes.length>length||!bytes.length)throw new Error('Bad request length');
  const out=new Uint8Array(length).fill(0xff);
  bytes.forEach((v,i)=>{if(!Number.isInteger(v)||v<0||v>255)throw new Error('Request byte out of range');out[i]=v^0xff;});
  return out;
}
function decodeReply(raw,id,command){
  const b=toBytes(raw),offsets=b.length>DATA_LENGTH[id]?[1,0]:[0,1];
  for(const o of offsets)if(b.length>o&&(b[o]^0xff)===command)return b.slice(o+1).map(v=>v^0xff);
  return null;
}
function unpackNibbles(byte){const hi=byte>>4,lo=byte&15;return RATE_IN_HIGH_NIBBLE?{rate:hi,dpi:lo}:{rate:lo,dpi:hi};}
function u16(p,o){return p[o]|p[o+1]<<8;}
function parseFull(p){
  if(p.length<FULL_READ_BYTES)throw new Error('Truncated settings reply');
  const usb=unpackNibbles(p[1]),g=unpackNibbles(p[2]);
  return {raw:Uint8Array.from(p.slice(0,FULL_READ_BYTES)),profile:p[0],usbRate:usb.rate,usbDpi:usb.dpi,gRate:g.rate,gDpi:g.dpi,
    x:Array.from({length:6},(_,i)=>u16(p,4+2*i)),y:Array.from({length:6},(_,i)=>u16(p,51+2*i)),count:p[16],sensor:p[17],
    debounce:p[18],sleep:p[19],angle:p[49]>127?p[49]-256:p[49]};
}
function parseDeviceInfo(p){return {connectMode:p[8]&7,battery:p[9],charge:p[10]};}
function parseName(p,slot){
  let end=1;while(end<p.length&&p[end]!==0&&p[end]!==0xff)end++;
  const text=new TextDecoder('utf-8').decode(p.slice(1,end)).replace(/\$\d\$.*$/,'').trim();
  return text||'Profile '+(slot+1);
}
function integer(v,min,max,label){
  if(!Number.isInteger(v)||v<min||v>max)throw new Error(label+' must be a whole number from '+min+' to '+max);
  return v;
}
function flatten(collections){
  return (collections||[]).flatMap(c=>[c,...flatten(c.children)]);
}
function reportIds(collection){return (collection.featureReports||[]).map(r=>r.reportId);}
function interfaceScore(device){
  const pages=flatten(device&&device.collections).filter(c=>CONFIG_USAGE_PAGES.includes(c.usagePage));
  if(!pages.length)return 0;
  const withMeta=pages.filter(c=>(c.featureReports||[]).length);
  if(!withMeta.length)return 1;
  return withMeta.some(c=>{const ids=reportIds(c);return ids.includes(SHORT_ID)&&ids.includes(LONG_ID);})?2:0;
}
function isConfigInterface(device){return interfaceScore(device)>0;}
function chooseInterface(devices,log){
  const scored=devices.map(d=>[d,interfaceScore(d)]).filter(e=>e[1]>0).sort((a,b)=>b[1]-a[1]);
  if(!scored.length)return undefined;
  if(log){const page=flatten(scored[0][0].collections).find(c=>CONFIG_USAGE_PAGES.includes(c.usagePage));log('INFO','config interface usage page 0x'+page.usagePage.toString(16)+(scored[0][1]===2?' (lists feature reports 0x11 and 0x12)':' (no report metadata)'));}
  return scored[0][0];
}
function normalName(name){return String(name||'').replace(/^(RealTek|YJX-CHIP)\s*/i,'').replace(/^MCHOSE\s+/i,'').trim().toLowerCase();}
function candidates(device,models){
  if(!device)return [];
  const list=models.filter(m=>m.family==='legacy'&&m.vid===device.vendorId&&(m.wired.includes(device.productId)||m.receiver.includes(device.productId)));
  if(list.length>1){const named=list.filter(m=>normalName(m.name)===normalName(device.productName));if(named.length)return named;}
  return list;
}
function matches(device,models){const c=candidates(device,models);return c.length===1?c[0]:undefined;}

class LegacyMouse{
  constructor(device,model,opts={}){
    if(!model||model.family!=='legacy')throw new Error('Not a legacy family model');
    this.device=device;this.model=model;this.caps=model.caps;
    if(model.wired.includes(device.productId))this.wired=true;
    else if(model.receiver.includes(device.productId))this.wired=false;
    else throw new Error('Product id does not belong to '+model.name);
    this.logFn=opts.log||(()=>{});this.sleep=opts.sleep||(ms=>new Promise(r=>setTimeout(r,ms)));
    this.settle=opts.delay??PROFILE_SETTLE_MS;this.timeout=opts.timeout??TIMEOUT_MS;this.watchdog=opts.watchdogMs??WATCHDOG_MS;
    this.watchdogFull=opts.watchdogMs??WATCHDOG_FULL_READ_MS;
    this.tail=Promise.resolve();this.waiters=new Set();this.inLogged=0;
    this.ready=false;this.faulted=false;this.closed=false;this.state=null;this.parsed=null;
    this.onChange=()=>{};this.onProfile=()=>{};
    this.listener=e=>this.onInput(e);device.addEventListener('inputreport',this.listener);
  }
  log(label,bytes){try{this.logFn(label,bytes);}catch(e){}}
  lock(fn){
    const run=this.tail.then(()=>{
      if(this.closed)throw new Error('Device disconnected');
      if(this.faulted)throw new Error('Reconnect the mouse after a transport timeout');
      return fn();
    });
    this.tail=run.catch(()=>{});return run;
  }
  async bounded(operation){
    let timer;
    try{return await Promise.race([operation,new Promise((_,reject)=>{timer=setTimeout(()=>{this.faulted=true;this.ready=false;reject(new Error('Device timed out. Reconnect before changing settings.'));},this.timeout);})]);}
    finally{clearTimeout(timer);}
  }
  onInput(e){
    if(IGNORED_INPUT_IDS.includes(e.reportId))return;
    const b=toBytes(e.data).map(v=>v^0xff);
    if(this.inLogged<MAX_LOGGED_INPUT){this.inLogged++;this.log('IN',b);}
    if(b[0]===DONE_REPORT){for(const w of this.waiters)if(w.command===b[1])w.hit();}
    else if(b[0]===STATUS_REPORT)this.onStatus(b);
  }
  onStatus(b){
    if(b[1]===1&&b[2]===2&&!this.wired){if(this.state){this.state.battery=null;this.onChange();}return;}
    if(this.state&&Number.isInteger(b[4])&&b[4]<=100&&(b[1]===0)===this.wired)this.state.battery={percent:b[4],charging:CHARGING_IS_NONZERO?b[3]!==0:b[3]===1};
    if(this.state&&(b[1]===0)===this.wired&&b[5]<this.state.stages.length){this.state.active=b[5];}
    this.onChange();
    if(b[8]&PROFILE_CHANGED_BIT){this.ready=false;this.onProfile();}
  }
  expect(command){
    let done,seen=false,timer;
    const p=new Promise(r=>{done=r;});
    const entry={command,hit(){seen=true;done(true);}};
    this.waiters.add(entry);
    return {
      wait:ms=>seen?Promise.resolve(true):Promise.race([p,new Promise(r=>{timer=setTimeout(()=>r(false),ms);})]).then(v=>{clearTimeout(timer);return v;}),
      cancel:()=>{this.waiters.delete(entry);clearTimeout(timer);}
    };
  }
  async send(id,frame){
    for(let n=1;;n++){
      try{await this.bounded(this.device.sendFeatureReport(id,frame));return;}
      catch(e){if(!(e&&e.name==='InvalidStateError')||n>=SEND_ATTEMPTS||this.faulted)throw e;await this.sleep(SEND_BACKOFF_MS*n);}
    }
  }
  async exchange(id,bytes,reads){
    if(!this.device.opened)throw new Error('Device is not open');
    const command=bytes[0],frame=encodeRequest(id,bytes);
    for(let n=0;n<(reads?READ_ATTEMPTS:1);n++){
      if(this.closed)throw new Error('Device disconnected');
      this.log('TX',Uint8Array.of(id,...frame));
      const bell=this.expect(command);
      let heard;
      try{
        await this.send(id,frame);
        const full=command===CMD.fullRead;
        heard=await bell.wait((full?this.watchdogFull:this.watchdog)+(full?WATCHDOG_STEP_MS*n:0));
      }finally{bell.cancel();}
      if(!heard)this.log('INFO','no completion report for command 0x'+command.toString(16));
      if(!reads)return null;
      const view=await this.bounded(this.device.receiveFeatureReport(id));
      const reply=toBytes(view);this.log('RX',reply);
      const payload=decodeReply(reply,id,command);
      if(payload)return payload;
      await this.sleep(RETRY_MS);
    }
    throw new Error('Mouse reply did not match the request (commands mixed up)');
  }
  async fetch(){return parseFull(await this.exchange(LONG_ID,[CMD.fullRead],true));}
  validateParsed(p){
    integer(p.count,1,DPI_STAGE_LIMIT,'Stage count');
    integer(p.profile,0,Math.max(this.caps.profiles||1,1)-1,'Profile');
    return p;
  }
  rateList(){
    const caps=this.caps,all=(caps.rates||[]).filter(r=>LEGACY_RATES.includes(r));
    if(this.wired)return all;
    const entry=(this.model.pids||[]).find(p=>p.pid===this.device.productId&&p.role==='receiver'),cap=entry&&entry.rateMax?entry.rateMax:caps.wirelessMaxRate;
    return cap?all.filter(r=>r<=cap):all;
  }
  lodWire(){const l=this.caps.lod;return l&&(l.length===2||l.length===3)?l:null;}
  buildState(p){
    const caps=this.caps,prev=this.state||{};
    const idx=this.wired?p.usbRate:p.gRate,dpiIdx=this.wired?p.usbDpi:p.gDpi,lodBits=p.sensor&3,lod=this.lodWire();
    const stages=Array.from({length:p.count},(_,i)=>({x:p.x[i],y:caps.dpi&&caps.dpi.independentXY?p.y[i]:p.x[i]}));
    const gm=p.sensor&0x80?(p.sensor&0x40?2:1):0;
    return {profile:p.profile,profiles:prev.profiles||this.defaultProfiles(),stages,active:dpiIdx<p.count?dpiIdx:0,
      rate:LEGACY_RATES[idx]??null,lod:lod?(lod.length===2?lod[lodBits-1]:lod[lodBits])??null:null,
      debounce:p.debounce,sleep:p.sleep,motionSync:!!(p.sensor>>FLAG_BITS.motionSync&1),ripple:!!(p.sensor>>FLAG_BITS.ripple&1),
      angleSnap:!!(p.sensor>>FLAG_BITS.angleSnap&1),glass:null,angle:p.angle,mode:caps.modes?gm:null,battery:prev.battery||null};
  }
  defaultProfiles(){return Array.from({length:this.caps.profiles||1},(_,i)=>({slot:i,name:'Profile '+(i+1)}));}
  adopt(p){this.parsed=p;this.state=this.buildState(p);}
  async soft(fn){try{return await fn();}catch(e){if(this.faulted||this.closed)throw e;this.log('INFO','optional read failed: '+e.message);return undefined;}}
  async loadExtras(){
    const info=await this.soft(()=>this.exchange(SHORT_ID,[CMD.deviceInfo],true));
    if(info){const d=parseDeviceInfo(info);this.state.battery=d.battery>0&&d.battery<=100?{percent:d.battery,charging:CHARGING_IS_NONZERO?d.charge!==0:d.charge===1}:null;}
    if((this.caps.profiles||1)>1){
      const profiles=[];
      for(let slot=0;slot<this.caps.profiles;slot++){
        const p=await this.soft(()=>this.exchange(LONG_ID,[CMD.name,slot],true));
        profiles.push({slot,name:p?parseName(p,slot):'Profile '+(slot+1)});
      }
      this.state.profiles=profiles;
    }
  }
  readState(){return this.lock(async()=>{
    this.ready=false;
    this.adopt(this.validateParsed(await this.fetch()));
    await this.loadExtras();
    this.ready=true;return this.state;
  });}
  change(fn){return this.lock(async()=>{
    if(!this.ready||!this.state)throw new Error('Read the mouse settings first');
    const p=this.validateParsed(await this.fetch());
    if(p.profile!==this.state.profile){this.adopt(p);this.ready=false;throw new Error('The active profile changed. Refresh before saving.');}
    this.parsed=p;
    return fn(p);
  });}
  async write(id,bytes,check){
    await this.exchange(id,bytes,false);
    const after=this.validateParsed(await this.fetch());
    this.adopt(after);
    if(!check(after)){this.ready=false;throw new Error('Read-back did not match. Refresh to see the device settings.');}
    this.onChange();return this.state;
  }
  unsupported(what){return new Error(what+' is not supported by this model');}
  dpiRules(){
    const d=this.caps.dpi||{};
    return {min:d.min??DEFAULT_DPI_MIN,max:d.max,step:d.step||DEFAULT_DPI_STEP};
  }
  checkDpi(v,label){
    const r=this.dpiRules();
    if(!Number.isInteger(v)||v<r.min||(r.max&&v>r.max)||(v-r.min)%r.step!==0)throw new Error(label+' must be '+r.min+' to '+r.max+' in steps of '+r.step);
    return v;
  }
  dpiFrame(p,{x=p.x,y=p.y,count=p.count,active}){
    const ua=active??Math.min(p.usbDpi,count-1),ga=active??Math.min(p.gDpi,count-1);
    const out=[CMD.dpi,ua,ga,0];
    for(const v of x)out.push(v&255,v>>8);
    out.push(count,DPI_DIFF_BYTE);
    for(const v of y)out.push(v&255,v>>8);
    return out;
  }
  composeStages(p,count,edit){
    const split=!!(this.caps.dpi&&this.caps.dpi.independentXY),defaults=(this.caps.dpi&&this.caps.dpi.defaults)||[];
    const x=p.x.slice(),y=p.y.slice();
    for(let i=0;i<count;i++){
      const r=this.dpiRules(),ok=v=>Number.isInteger(v)&&v>=r.min&&(!r.max||v<=r.max)&&(v-r.min)%r.step===0;
      if(!ok(x[i]))x[i]=defaults[i]??x[Math.max(0,i-1)];
      if(!split)y[i]=x[i];else if(!ok(y[i]))y[i]=x[i];
    }
    if(edit)edit(x,y,split);
    for(let i=0;i<count;i++){this.checkDpi(x[i],'DPI');this.checkDpi(y[i],'DPI');}
    return {x,y};
  }
  verifyStages(a,count,x,y,active){
    return a.count===count&&x.slice(0,count).every((v,i)=>a.x[i]===v&&(!(this.caps.dpi&&this.caps.dpi.independentXY)||a.y[i]===y[i]))&&(active===undefined||(a.usbDpi===active&&a.gDpi===active));
  }
  setStage(i){
    return this.change(p=>{
      integer(i,0,p.count-1,'Stage');
      const {x,y}=this.composeStages(p,p.count);
      return this.write(LONG_ID,this.dpiFrame(p,{x,y,active:i}),a=>this.verifyStages(a,p.count,x,y,i));
    });
  }
  setStageCount(n){
    const max=Math.min(DPI_STAGE_LIMIT,(this.caps.dpi&&this.caps.dpi.maxStages)||DPI_STAGE_LIMIT);
    return this.change(p=>{
      integer(n,1,max,'Stage count');
      const {x,y}=this.composeStages(p,n),active=Math.min(this.wired?p.usbDpi:p.gDpi,n-1);
      return this.write(LONG_ID,this.dpiFrame(p,{x,y,count:n,active}),a=>this.verifyStages(a,n,x,y,active));
    });
  }
  setDpi(i,xv,yv){
    return this.change(p=>{
      integer(i,0,p.count-1,'Stage');
      const split=!!(this.caps.dpi&&this.caps.dpi.independentXY);
      if(yv===undefined)yv=xv;
      if(!split&&yv!==xv)throw this.unsupported('Separate X and Y DPI');
      this.checkDpi(xv,'DPI');this.checkDpi(yv,'DPI');
      const {x,y}=this.composeStages(p,p.count,(ax,ay)=>{ax[i]=xv;ay[i]=yv;});
      return this.write(LONG_ID,this.dpiFrame(p,{x,y}),a=>this.verifyStages(a,p.count,x,y));
    });
  }
  setRate(hz){
    return this.change(p=>{
      const list=this.rateList();
      if(!list.includes(hz))throw new Error('Polling rate '+hz+' Hz is not available on this connection');
      const idx=LEGACY_RATES.indexOf(hz);
      return this.write(SHORT_ID,[CMD.rate,this.wired?idx:0,this.wired?0:idx],a=>(this.wired?a.usbRate:a.gRate)===idx);
    });
  }
  sensorWrite(p,fields,check){
    const bytes=[CMD.sensor,p.sensor&3,0,0,0,0,0,0,0,0];
    for(const [i,v] of Object.entries(fields))bytes[i]=v;
    return this.write(SHORT_ID,bytes,a=>check(a)&&(fields[1]!==undefined||(a.sensor&3)===(p.sensor&3)));
  }
  setLod(mm){
    return this.change(p=>{
      const l=this.lodWire(),i=l?l.indexOf(mm):-1;
      if(!l)throw this.unsupported('Lift-off distance');
      if(i<0)throw new Error('Lift-off '+mm+' mm is not available');
      const wire=l.length===2?i+1:i;
      return this.sensorWrite(p,{1:wire},a=>(a.sensor&3)===wire);
    });
  }
  setDebounce(v){
    const ms=v&&typeof v==='object'?(v.press===v.release?v.press:NaN):v;
    return this.change(p=>{
      const r=this.caps.debounce===undefined?DEFAULT_DEBOUNCE:this.caps.debounce;
      if(!r)throw this.unsupported('Debounce');
      if(!Number.isInteger(ms)||ms<r.min||ms>r.max||(ms-r.min)%(r.step||1)!==0)throw new Error('Debounce must be '+r.min+' to '+r.max+' ms with one value for both buttons');
      return this.write(SHORT_ID,[CMD.debounce,ms],a=>a.debounce===ms);
    });
  }
  setSleep(minutes){
    return this.change(p=>{
      const r=this.caps.sleep===undefined?DEFAULT_SLEEP:this.caps.sleep;
      if(!r)throw this.unsupported('Sleep timer');
      const never=minutes===0;
      if(never&&!r.never)throw new Error('This model cannot disable the sleep timer');
      if(!never)integer(minutes,r.min,r.max,'Sleep timer');
      return this.write(SHORT_ID,[CMD.sleep,never?0:1,never?0:minutes],a=>a.sleep===(never?0:minutes));
    });
  }
  setFlag(name,on){
    return this.change(p=>{
      if(!(name in FLAG_BITS)||!this.caps[name])throw this.unsupported(name==='glass'?'Glass mode':'Flag '+name);
      if(typeof on!=='boolean')throw new Error('Flag value must be true or false');
      return this.sensorWrite(p,{[FLAG_FIELD[name]]:on?FLAG_ON:FLAG_OFF},a=>!!(a.sensor>>FLAG_BITS[name]&1)===on);
    });
  }
  setAngle(deg){
    return this.change(p=>{
      if(!this.caps.rotation)throw this.unsupported('Sensor angle');
      integer(deg,-ANGLE_LIMIT,ANGLE_LIMIT,'Angle');
      return this.sensorWrite(p,{8:1,9:deg&255},a=>a.angle===deg);
    });
  }
  setMode(id){
    return this.change(p=>{
      const modes=this.caps.modes;
      if(!modes)throw this.unsupported('Mode');
      if(!modes.some(m=>m.id===id)||!SUPPORTED_MODE_IDS.includes(id))throw new Error('Unknown mode');
      return this.sensorWrite(p,{7:id+1},a=>(a.sensor&0x80?(a.sensor&0x40?2:1):0)===id);
    });
  }
  setProfile(slot){
    return this.lock(async()=>{
      if(!this.ready)throw new Error('Read the mouse settings first');
      if(!((this.caps.profiles||1)>1))throw this.unsupported('Profile switching');
      integer(slot,0,this.caps.profiles-1,'Profile');
      await this.exchange(SHORT_ID,[CMD.profile,slot],false);
      await this.sleep(this.settle);
      this.ready=false;
      const p=this.validateParsed(await this.fetch());
      this.adopt(p);await this.loadExtras();
      if(p.profile!==slot)throw new Error('Profile switch did not take effect');
      this.ready=true;this.onChange();this.onProfile();return this.state;
    });
  }
  close(){
    this.closed=true;this.ready=false;
    try{this.device.removeEventListener('inputreport',this.listener);}catch(e){}
    try{if(this.device.opened)this.device.close();}catch(e){}
  }
}

async function open(device,model,opts={}){
  if(!isConfigInterface(device))throw new Error('This HID interface does not expose the configuration reports');
  if(opts.log)opts.log('INFO','legacy driver, usage page choice: '+(interfaceScore(device)===2?'collection lists feature reports 0x11 and 0x12':'accepted without report metadata'));
  const mouse=new LegacyMouse(device,model,opts);
  try{
    if(!device.opened)await device.open();
    await mouse.readState();
  }catch(e){mouse.close();throw e;}
  return mouse;
}

const driver={family:'legacy',open,matches,candidates,isConfigInterface,chooseInterface,encodeRequest,decodeReply,parseFull,LEGACY_RATES};
root.MchoseDrivers=root.MchoseDrivers||{};
root.MchoseDrivers.legacy=driver;
})(typeof window!=='undefined'?window:globalThis);
