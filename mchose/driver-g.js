(function(root){
'use strict';
const REPORT_ID=0;
const FRAME_LENGTH=64;
const REQUEST_MAGIC=0x55;
const REPLY_MAGIC=0xAA;
const CMD={VERSION:0x03,BATTERY:0x30,ONLINE:0xED,READ_CONFIG:0x0E,WRITE_CONFIG:0x0F,STATUS_PUSH:0xFA};
const SENDABLE=new Set([CMD.VERSION,CMD.BATTERY,CMD.ONLINE,CMD.READ_CONFIG,CMD.WRITE_CONFIG]);
const HEADER_READ_CONFIG=Object.freeze([0xA5,0x0B,0x30,0x01,0x01,0x01]);
const HEADER_WRITE_CONFIG=Object.freeze([0xAE,0x0A,0x30,0x01,0x01,0x01]);
const HEADER_BATTERY=Object.freeze([0xA5,0x0B,0x2E,0x01,0x01,0x01]);
const HEADER_BYTES=[2,7];
const PAYLOAD_START=10;
const HEADERS={[CMD.READ_CONFIG]:HEADER_READ_CONFIG,[CMD.WRITE_CONFIG]:HEADER_WRITE_CONFIG,[CMD.BATTERY]:HEADER_BATTERY};
const CONFIG_USAGE_PAGE=0xFF01;
const CONFIG_USAGE=0x10;
const WIRED_VID=0xA8A4;
const VENDOR_VIDS=[0xA8A4,0xA8A5];
const REPLY_TIMEOUT_MS=500;
const UNSOLICITED_LOG_LIMIT=40;
const STATUS_IGNORED_BYTE=0xD0;
const OFFLINE_STATUS=1;
const OFF={RATE:10,COUNT:11,ACTIVE:12,DPI:13,SCROLL:48,LOD:49,SENSOR:50,DEBOUNCE:51,SLEEP:52,ESPORTS:53,ANGLE:55};
const RATES=[125,250,500,1000];
const WIRED_RATE=1000;
const DPI_SLOTS=6;
const DPI_MIN_FALLBACK=200;
const DPI_DEFAULTS=[400,800,1600,3200,6400,12000];
const SENSOR_BITS={angleSnap:1,ripple:16,motionSync:32};
const LOD_VALUES=[1,2];
const DEBOUNCE_MIN=0,DEBOUNCE_MAX=20;
const SLEEP_MIN=1,SLEEP_MAX=100;
const ANGLE_LIMIT=30;
const ANGLE_MIN_FW=[2,3,5];
const BLANK_DEBOUNCE=8,BLANK_SLEEP=3;
const FW_DIGIT_OFFSETS=[23,24,25];
const CHARGING_IS_NONZERO=true;
const PROFILE_NAME='Onboard';

const hex=n=>'0x'+n.toString(16).toUpperCase().padStart(2,'0');
const unsupported=what=>new Error(what+' not supported by this model');

function encodeFrame(cmd,block){
  if(!SENDABLE.has(cmd))throw new Error('Command '+hex(cmd)+' is not allowed');
  const f=new Uint8Array(FRAME_LENGTH);
  f[0]=REQUEST_MAGIC;f[1]=cmd;
  const h=HEADERS[cmd];if(h)f.set(h,HEADER_BYTES[0]);
  if(cmd===CMD.WRITE_CONFIG){
    if(!block||block.length!==FRAME_LENGTH)throw new Error('A write needs the full 64 byte block');
    f.set(block.slice(PAYLOAD_START),PAYLOAD_START);
  }
  return f;
}

function toBytes(data){
  if(!data)return new Uint8Array(0);
  if(data.buffer)return new Uint8Array(data.buffer,data.byteOffset||0,data.byteLength);
  return Uint8Array.from(data);
}

function parseFirmware(r){
  if(!r||r.length<=FW_DIGIT_OFFSETS[2])return null;
  const parts=FW_DIGIT_OFFSETS.map(o=>r[o]>=48&&r[o]<=57?r[o]-48:0);
  return {text:parts.join('.'),parts};
}
function fwAtLeast(parts,min){
  for(let i=0;i<min.length;i++){if(parts[i]!==min[i])return parts[i]>min[i];}
  return true;
}

function isBlank(b){
  return (b[13]===0&&b[14]===0&&b[15]===0)||(b[13]===255&&b[14]===255&&b[15]===255);
}
function checkBlock(b){
  if(b.length<FRAME_LENGTH)throw new Error('Configuration reply too short');
  if(b[0]!==REPLY_MAGIC||b[1]!==CMD.READ_CONFIG)throw new Error('Unexpected configuration reply');
  if(isBlank(b))return;
  if(b[OFF.RATE]<1||b[OFF.RATE]>RATES.length)throw new Error('Unexpected polling rate code '+b[OFF.RATE]);
  if(b[OFF.COUNT]<1||b[OFF.COUNT]>DPI_SLOTS)throw new Error('Unexpected DPI stage count '+b[OFF.COUNT]);
  const a=b[OFF.ACTIVE]>1?b[OFF.ACTIVE]-1:0;
  if(a>=b[OFF.COUNT])throw new Error('Unexpected active DPI stage '+b[OFF.ACTIVE]);
}
function u16(b,o){return b[o]|b[o+1]<<8;}

function collectionsOf(device){return (device&&device.collections)||[];}
function isConfigInterface(device){
  return collectionsOf(device).some(c=>c.usagePage===CONFIG_USAGE_PAGE&&c.usage===CONFIG_USAGE);
}
function pending(m){return !!(m.caps&&m.caps.extra&&m.caps.extra.protocolPending);}
function identities(m){
  if(Array.isArray(m.pids)&&m.pids.length)return m.pids.map(p=>[p.vid,p.pid]);
  return [...(m.wired||[]),...(m.receiver||[])].map(p=>[m.vid,p]);
}
function matches(device,models){
  if(!device||!models)return undefined;
  const found=models.filter(m=>m.family==='g'&&!pending(m)&&identities(m).some(i=>i[0]===device.vendorId&&i[1]===device.productId));
  if(found.length<=1)return found[0];
  const name=(device.productName||'').toLowerCase();
  const hit=m=>[m.name,...(m.aliases||[])].some(a=>name.includes(a.toLowerCase()));
  return found.filter(hit).sort((a,b)=>b.name.length-a.name.length)[0];
}
function isWired(device,model){
  if(VENDOR_VIDS.includes(device.vendorId))return device.vendorId===WIRED_VID;
  return (model.wired||[]).includes(device.productId);
}

class GMouse{
  constructor(device,model,opts){
    this.device=device;this.baseModel=model;this.model=model;this.caps=model.caps||{};this.opts=opts||{};
    this.timeout=this.opts.timeout||REPLY_TIMEOUT_MS;
    this.wired=isWired(device,model);
    this.tail=Promise.resolve();this.pending=null;this.unsolicited=0;
    this.closed=false;this.faulted=false;this.ready=false;this.readOnly=false;
    this.state=null;this.onChange=null;this.onProfile=null;
    this.firmware=null;this.online=true;this.battery=null;this.angleOk=false;
    this.listener=e=>this.receive(e);
  }
  log(label,bytes){try{if(this.opts.log)this.opts.log(label,bytes);}catch(e){}}
  note(text){this.log('NOTE',new TextEncoder().encode(text));}
  attach(){this.device.addEventListener('inputreport',this.listener);}
  detach(){try{this.device.removeEventListener('inputreport',this.listener);}catch(e){}}
  fault(){this.faulted=true;this.ready=false;}
  lock(fn){
    const run=this.tail.then(()=>{
      if(this.closed)throw new Error('Device disconnected');
      if(this.faulted)throw new Error('Reconnect the mouse after a transport timeout');
      return fn();
    });
    this.tail=run.catch(()=>{});return run;
  }
  receive(e){
    if(this.closed)return;
    const raw=toBytes(e.data);
    if(raw.length<2||raw[0]!==REPLY_MAGIC){
      if(this.unsolicited++<UNSOLICITED_LOG_LIMIT)this.log('RX unknown',raw);
      return;
    }
    const cmd=raw[1],p=this.pending;
    if(p&&p.cmd===cmd){this.log('RX',raw);p.resolve(raw);return;}
    this.log('RX async',raw);
    if(cmd===CMD.STATUS_PUSH)this.statusPush(raw);
    else if(cmd===CMD.BATTERY)this.batteryPush(raw);
    else if(cmd===CMD.ONLINE)this.onlinePush(raw);
    else if(this.unsolicited++<UNSOLICITED_LOG_LIMIT)this.log('RX unmatched '+hex(cmd),raw);
  }
  changed(){if(this.state&&this.onChange)this.onChange(this.state);}
  statusPush(r){
    const s=this.state;if(!s||r.length<11||r[8]===STATUS_IGNORED_BYTE)return;
    const idx=r[9]-1,rate=RATES[r[10]-1];
    if(idx>=0&&idx<s.stages.length)s.active=idx;
    if(rate)s.rate=rate;
    this.changed();
  }
  batteryPush(r){
    this.battery=this.parseBattery(r);
    if(this.state){this.state.battery=this.battery;this.changed();}
  }
  onlinePush(r){
    if(r.length<9||this.wired)return;
    this.online=r[8]!==OFFLINE_STATUS;
    if(this.state){this.state.online=this.online;this.changed();}
  }
  parseBattery(r){
    if(!r||r.length<10||r[8]>100)return null;
    return {percent:r[8],charging:CHARGING_IS_NONZERO?r[9]!==0:r[9]===1};
  }
  once(cmd,frame,soft=false){
    if(!SENDABLE.has(cmd)||frame[0]!==REQUEST_MAGIC||frame[1]!==cmd||frame.length!==FRAME_LENGTH)return Promise.reject(new Error('Command '+hex(cmd)+' is not allowed'));
    return new Promise((resolve,reject)=>{
      const done=()=>{clearTimeout(timer);this.pending=null;};
      const timer=setTimeout(()=>{
        done();
        if(soft){this.note('No reply to '+hex(cmd));resolve(null);return;}
        this.fault();reject(new Error('Device timed out. Reconnect before changing settings.'));
      },this.timeout);
      this.pending={cmd,resolve:r=>{done();resolve(r);}};
      this.log('TX',frame);
      Promise.resolve().then(()=>this.device.sendReport(REPORT_ID,frame)).catch(err=>{done();this.fault();reject(err);});
    });
  }
  async readBlock(){
    const b=await this.once(CMD.READ_CONFIG,encodeFrame(CMD.READ_CONFIG));
    checkBlock(b);return b;
  }
  blankBlock(){
    const d=this.caps.dpi||{},max=d.max||DPI_DEFAULTS[5],b=new Uint8Array(FRAME_LENGTH);
    b[0]=REPLY_MAGIC;b[1]=CMD.READ_CONFIG;
    b[OFF.RATE]=RATES.length;b[OFF.COUNT]=DPI_SLOTS;b[OFF.ACTIVE]=3;
    DPI_DEFAULTS.forEach((v,i)=>{const x=Math.min(v,max);b[OFF.DPI+2*i]=x&255;b[OFF.DPI+2*i+1]=x>>8;});
    b[OFF.LOD]=1;b[OFF.DEBOUNCE]=BLANK_DEBOUNCE;b[OFF.SLEEP]=BLANK_SLEEP;
    return b;
  }
  view(b){
    const c=this.caps,s={};
    s.profile=0;s.profiles=[{slot:0,name:PROFILE_NAME}];
    s.stages=[];for(let i=0;i<b[OFF.COUNT];i++){const v=u16(b,OFF.DPI+2*i);s.stages.push({x:v,y:v});}
    const a=b[OFF.ACTIVE]>1?b[OFF.ACTIVE]-1:0;s.active=a<s.stages.length?a:0;
    s.rate=RATES[b[OFF.RATE]-1];
    s.lod=c.lod&&LOD_VALUES.includes(b[OFF.LOD])?b[OFF.LOD]:null;
    s.debounce=c.debounce?b[OFF.DEBOUNCE]:null;
    s.sleep=c.sleep?b[OFF.SLEEP]:null;
    for(const k of Object.keys(SENSOR_BITS))s[k]=c[k]?(b[OFF.SENSOR]&SENSOR_BITS[k])!==0:null;
    s.glass=null;
    s.angle=c.rotation&&this.angleOk?(b[OFF.ANGLE]>127?b[OFF.ANGLE]-256:b[OFF.ANGLE]):null;
    s.mode=c.modes&&c.modes.length?b[OFF.ESPORTS]&1:null;
    s.scrollReverse=b[OFF.SCROLL]===1;
    s.battery=this.battery;s.firmware=this.firmware?this.firmware.text:null;s.online=this.online;
    return s;
  }
  async loadState(){
    const fw=parseFirmware(await this.once(CMD.VERSION,encodeFrame(CMD.VERSION),true));
    this.firmware=fw;
    this.angleOk=!!fw&&fwAtLeast(fw.parts,ANGLE_MIN_FW);
    const c=this.baseModel.caps||{};
    this.model=c.rotation&&!this.angleOk?{...this.baseModel,caps:{...c,rotation:null}}:this.baseModel;
    this.caps=this.model.caps;
    this.battery=this.parseBattery(await this.once(CMD.BATTERY,encodeFrame(CMD.BATTERY),true));
    if(!this.wired){
      const r=await this.once(CMD.ONLINE,encodeFrame(CMD.ONLINE),true);
      this.online=!(r&&r.length>8&&r[8]===OFFLINE_STATUS);
      if(!this.online){this.ready=false;throw new Error('The mouse is not connected to the receiver');}
    }else this.online=true;
    let b=await this.once(CMD.READ_CONFIG,encodeFrame(CMD.READ_CONFIG));
    checkBlock(b);
    this.readOnly=false;
    if(isBlank(b)){
      this.readOnly=true;b=this.blankBlock();
      this.note('The mouse configuration is blank, showing defaults and disabling writes');
    }
    this.state=this.view(b);this.ready=true;
    return this.state;
  }
  readState(){return this.lock(()=>this.loadState());}
  writable(){
    if(!this.ready||!this.state)throw new Error('Read the device state first');
    if(this.readOnly)throw new Error('The mouse configuration is blank, writes are disabled');
  }
  finish(){this.changed();return this.state;}
  mismatch(what,offsets){
    const e=new Error('Read-back mismatch for '+what+' (byte '+offsets.join(', ')+'). The mouse did not keep the value.');
    this.note(e.message);return e;
  }
  change(what,mutate){
    return this.lock(async()=>{
      this.writable();
      const cur=await this.readBlock();
      if(isBlank(cur)){this.readOnly=true;throw new Error('The mouse configuration is blank, writes are disabled');}
      const next=Uint8Array.from(cur);
      mutate(next);
      const diff=(x,y)=>{const o=[];for(let i=PAYLOAD_START;i<FRAME_LENGTH;i++)if(x[i]!==y[i])o.push(i);return o;};
      if(!diff(cur,next).length)return this.state;
      await this.once(CMD.WRITE_CONFIG,encodeFrame(CMD.WRITE_CONFIG,next),true);
      const back=await this.readBlock();
      this.state=this.view(back);
      const bad=diff(next,back);
      if(bad.length){this.finish();throw this.mismatch(what,bad);}
      return this.finish();
    });
  }
  setStage(i){
    if(!Number.isInteger(i)||i<0||!this.state||i>=this.state.stages.length)return Promise.reject(new RangeError('DPI stage out of range'));
    return this.change('DPI stage',b=>{b[OFF.ACTIVE]=i+1;});
  }
  setRate(hz){
    const rates=this.caps.rates||[];
    if(!rates.includes(hz)||!RATES.includes(hz))return Promise.reject(new RangeError('Polling rate '+hz+' Hz is not available on this model'));
    if(this.wired&&hz!==WIRED_RATE)return Promise.reject(new RangeError('Polling rate is fixed at '+WIRED_RATE+' Hz over the cable'));
    return this.change('polling rate',b=>{b[OFF.RATE]=RATES.indexOf(hz)+1;});
  }
  setLod(mm){
    const list=this.caps.lod;
    if(!list)return Promise.reject(unsupported('Lift-off distance'));
    if(!list.includes(mm)||!LOD_VALUES.includes(mm))return Promise.reject(new RangeError('Lift-off distance '+mm+' mm is not available'));
    return this.change('lift-off distance',b=>{b[OFF.LOD]=mm;});
  }
  setDebounce(v){
    if(!this.caps.debounce)return Promise.reject(unsupported('Debounce'));
    const vals=v&&typeof v==='object'?Object.values(v):[v];
    const ms=vals[0];
    if(!vals.length||vals.some(x=>x!==ms))return Promise.reject(new RangeError('This model uses one debounce value'));
    if(!Number.isInteger(ms)||ms<DEBOUNCE_MIN||ms>DEBOUNCE_MAX)return Promise.reject(new RangeError('Debounce must be '+DEBOUNCE_MIN+' to '+DEBOUNCE_MAX+' ms'));
    return this.change('debounce',b=>{b[OFF.DEBOUNCE]=ms;});
  }
  setSleep(min){
    const s=this.caps.sleep;
    if(!s)return Promise.reject(unsupported('Sleep timer'));
    if(!Number.isInteger(min))return Promise.reject(new RangeError('Sleep must be a whole number of minutes'));
    if(min===0&&!s.never)return Promise.reject(new RangeError('Never sleep is not available on this model'));
    if(min!==0&&(min<SLEEP_MIN||min>SLEEP_MAX))return Promise.reject(new RangeError('Sleep must be '+SLEEP_MIN+' to '+SLEEP_MAX+' minutes'));
    return this.change('sleep',b=>{b[OFF.SLEEP]=min;});
  }
  setFlag(name,on){
    if(!(name in SENSOR_BITS)&&name!=='glass')return Promise.reject(new RangeError('Unknown setting '+name));
    if(!this.caps[name]||!(name in SENSOR_BITS))return Promise.reject(unsupported(name));
    if(typeof on!=='boolean')return Promise.reject(new RangeError('Flag must be true or false'));
    const bit=SENSOR_BITS[name];
    return this.change(name,b=>{b[OFF.SENSOR]=on?b[OFF.SENSOR]|bit:b[OFF.SENSOR]&~bit&255;});
  }
  setAngle(deg){
    if(!this.caps.rotation)return Promise.reject(unsupported('Sensor angle (needs firmware '+ANGLE_MIN_FW.join('.')+' or later)'));
    if(!Number.isInteger(deg)||Math.abs(deg)>ANGLE_LIMIT)return Promise.reject(new RangeError('Angle must be a whole number from -'+ANGLE_LIMIT+' to '+ANGLE_LIMIT));
    return this.change('angle',b=>{b[OFF.ANGLE]=deg&255;});
  }
  setMode(id){
    const modes=this.caps.modes;
    if(!modes||!modes.length)return Promise.reject(unsupported('Mode'));
    if(!modes.some(m=>m.id===id))return Promise.reject(new RangeError('Unknown mode'));
    return this.change('eSports mode',b=>{b[OFF.ESPORTS]=b[OFF.ESPORTS]&~1&255|id;});
  }
  setScrollReverse(on){
    if(!(this.caps.extra&&this.caps.extra.scrollDirection))return Promise.reject(unsupported('Scroll direction'));
    if(typeof on!=='boolean')return Promise.reject(new RangeError('Scroll direction must be true or false'));
    return this.change('scroll direction',b=>{b[OFF.SCROLL]=on?1:0;});
  }
  validDpi(v){
    const d=this.caps.dpi||{},lo=d.min!==undefined?d.min:DPI_MIN_FALLBACK,step=d.step||1;
    return Number.isInteger(v)&&v>=lo&&(d.max===undefined||v<=d.max)&&(v-lo)%step===0;
  }
  setStageCount(n){
    const d=this.caps.dpi,max=Math.min(DPI_SLOTS,(d&&d.maxStages)||DPI_SLOTS);
    if(!d)return Promise.reject(unsupported('DPI'));
    if(!Number.isInteger(n)||n<1||n>max)return Promise.reject(new RangeError('Stage count must be 1 to '+max));
    return this.change('stage count',b=>{
      const old=b[OFF.COUNT];
      for(let i=old;i<n;i++){
        if(this.validDpi(u16(b,OFF.DPI+2*i)))continue;
        const v=Math.min(DPI_DEFAULTS[i],d.max);b[OFF.DPI+2*i]=v&255;b[OFF.DPI+2*i+1]=v>>8;
      }
      b[OFF.COUNT]=n;
      if(b[OFF.ACTIVE]>n)b[OFF.ACTIVE]=n;
    });
  }
  setDpi(i,x,y=x){
    const d=this.caps.dpi;
    if(!d)return Promise.reject(unsupported('DPI'));
    if(!Number.isInteger(i)||i<0||!this.state||i>=this.state.stages.length)return Promise.reject(new RangeError('DPI stage out of range'));
    if(!this.validDpi(x)||!this.validDpi(y))return Promise.reject(new RangeError('DPI must be '+d.min+' to '+d.max+' in steps of '+d.step));
    if(x!==y)return Promise.reject(unsupported('Separate X and Y DPI'));
    return this.change('DPI',b=>{b[OFF.DPI+2*i]=x&255;b[OFF.DPI+2*i+1]=x>>8;});
  }
  setProfile(){return Promise.reject(unsupported('Profiles'));}
  close(){
    this.closed=true;this.ready=false;this.detach();
    if(this.pending)this.pending.resolve(new Uint8Array(0));
    try{const r=this.device.close&&this.device.close();if(r&&r.catch)r.catch(()=>{});}catch(e){}
  }
}

async function open(device,model,opts={}){
  if(!model||model.family!=='g'||!model.caps)throw new Error('Not a supported MCHOSE model');
  if(model.caps.extra&&model.caps.extra.protocolPending)throw new Error(model.name+' uses a write-only protocol that is not supported');
  if(!isConfigInterface(device))throw new Error('Not an MCHOSE configuration interface');
  if(!device.opened)await device.open();
  const inst=new GMouse(device,model,opts);
  inst.attach();
  try{await inst.readState();}catch(e){inst.detach();inst.closed=true;throw e;}
  return inst;
}

const api={family:'g',open,matches,isConfigInterface,encodeFrame,parseFirmware,CMD,OFF,RATES,HEADER_READ_CONFIG,HEADER_WRITE_CONFIG,HEADER_BATTERY};
root.MchoseDrivers=root.MchoseDrivers||{};
root.MchoseDrivers.g=api;
})(typeof window!=='undefined'?window:globalThis);
