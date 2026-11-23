(function(root){
'use strict';
const REPORT_ID=0x4D;
const FRAME_DATA_LENGTH=63;
const FRAME_HEADER_LENGTH=7;
const MAX_PAYLOAD=FRAME_DATA_LENGTH-FRAME_HEADER_LENGTH-1;
const CONFIG_USAGE_PAGES=[0xFF01,0xFF0B];
const BOOT_NAME_PATTERN=/upgrade/i;
const CMD={PERF:0x0002,DPI:0x0003,LOD:0x0009,INFO:0x0900,NAME:0x0905,SELECT_PROFILE:0x0906,
  WRITE_PERF:0x0102,WRITE_DPI:0x0103,WRITE_LOD:0x0109,ASYNC:0x0600};
const SENDABLE=new Set([CMD.PERF,CMD.DPI,CMD.LOD,CMD.INFO,CMD.NAME,CMD.SELECT_PROFILE,CMD.WRITE_PERF,CMD.WRITE_DPI,CMD.WRITE_LOD]);
const REPLY_TIMEOUT_MS=3000;
const BUSY_BYTE=0xFF;
const BUSY_ATTEMPTS=5;
const BUSY_DELAY_MS=30;
const UNSOLICITED_LOG_LIMIT=40;
const PROFILE_COUNT_FALLBACK=3;
const DPI_SLOTS=6;
const DPI_MIN_FALLBACK=200;
const DPI_DEFAULTS=[400,800,1600,3200,6400,26000];
const RATE_CODES={125:0,500:2,1000:3,2000:4,4000:5,8000:6};
const RATE_CODE_250_UNVERIFIED=1;
const RATE_BY_CODE={0:125,1:250,2:500,3:1000,4:2000,5:4000,6:8000};
const SLEEP_MIN_FALLBACK=1;
const SLEEP_MAX_FALLBACK=100;
const SLEEP_BYTE_MAX=255;
const DEBOUNCE_MIN_FALLBACK=1;
const DEBOUNCE_MAX_FALLBACK=20;
const DEBOUNCE_WIRE_PER_MS=1;
const ANGLE_LIMIT=30;
const CHARGING_IS_NONZERO=true;
const SENSOR_MODE_MASK=0x03;
const SENSOR_BITS={ripple:2,angleSnap:3,motionSync:4,glass:7};
const SENSOR_LOD_SHIFT=5;
const SENSOR_LOD_MASK=0x03;
const LOD_COMMAND_LIST_LENGTH=5;
const NAME_CHUNK=23;
const NAME_MAX=60;
const NAME_RETRIES=5;
const PERF_KEYS=['profile','rateUsb','rateG','stage','sleep','sleepMode','sensor','rotate','left','right'];

const hex=n=>'0x'+n.toString(16).toUpperCase().padStart(4,'0');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const unsupported=what=>new Error(what+' not supported by this model');

function xorSum(d,from,to){let x=0;for(let i=from;i<=to;i++)x^=d[i];return x;}

function encodeFrame(cmd,payload=[],seq=0){
  if(!Number.isInteger(cmd)||cmd<0||cmd>0xFFFF)throw new Error('Invalid command');
  if(payload.length>MAX_PAYLOAD)throw new Error('Payload too long');
  const d=new Uint8Array(FRAME_DATA_LENGTH),n=payload.length;
  d[0]=1;d[1]=1;d[2]=n;d[3]=cmd&255;d[4]=cmd>>8;d[5]=0;d[6]=seq&255;d.set(payload,FRAME_HEADER_LENGTH);
  d[FRAME_HEADER_LENGTH+n]=xorSum(d,1,FRAME_HEADER_LENGTH-1+n);
  return d;
}

function decodeFrame(bytes){
  const d=Uint8Array.from(bytes);
  if(d.length<=FRAME_HEADER_LENGTH)return null;
  const n=d[2];let checksum=null;
  if(d[1]===1&&FRAME_HEADER_LENGTH+n<d.length)checksum=d[FRAME_HEADER_LENGTH+n]===xorSum(d,1,FRAME_HEADER_LENGTH-1+n);
  return {magic:d[0],flags:d[1],length:n,cmd:d[3]|d[4]<<8,biz:d[5],seq:d[6],payload:d.slice(FRAME_HEADER_LENGTH),checksum};
}

function parseInfo(p){
  if(p.length<14)throw new Error('Device info reply too short');
  return {vid:p[0]|p[1]<<8,pid:p[2]|p[3]<<8,maxConfigNum:p[4],connectStatus:p[10],chargeStatus:p[11],battery:p[12],gameMode:p[13]};
}
function parsePerf(p){
  if(p.length<9)throw new Error('Performance reply too short');
  return {profile:p[0],rateUsb:p[1]>>4,stage:p[1]&15,rateG:p[2]>>4,sleep:p[3],sleepMode:p[4]&1,sensor:p[5],rotate:p[6],left:p[7],right:p[8]};
}
function encodePerf(b){
  return [b.profile,(b.rateUsb&15)<<4|(b.stage&15),(b.rateG&15)<<4|(b.stage&15),b.sleep,b.sleepMode&1,b.sensor,b.rotate,b.left,b.right,0,0,0,0,0,0,0,0,0,0];
}
function parseDpi(p){
  if(p.length<17)throw new Error('DPI reply too short');
  const values=[];for(let i=0;i<DPI_SLOTS;i++)values.push(p[5+2*i]|p[6+2*i]<<8);
  const t={profile:p[0],dir:p[1],sum:p[2],active:p[3],hasY:p[4]?1:0,values};
  if(t.sum<1||t.sum>DPI_SLOTS)throw new Error('Unexpected DPI stage count '+t.sum);
  return t;
}
function encodeDpi(profile,dir,hasY,sum,active,values){
  const out=[profile,dir,hasY,sum,active];
  for(const v of values)out.push(v&255,v>>8&255);
  return out;
}
function decodeName(bytes){
  let end=bytes.length;while(end>0&&bytes[end-1]===0)end--;
  const text=new TextDecoder().decode(Uint8Array.from(bytes.slice(0,end))).trim();
  return text.split('$')[0];
}

function collectionsOf(device){return (device&&device.collections)||[];}
function configCollections(device){return collectionsOf(device).filter(c=>CONFIG_USAGE_PAGES.includes(c.usagePage));}
function hasOutput(c){return !!(c.outputReports&&c.outputReports.some(r=>r.reportId===REPORT_ID));}
function pickCollection(device){const list=configCollections(device);return list.find(hasOutput)||list[0];}
function isConfigInterface(device){
  if(!device||BOOT_NAME_PATTERN.test(device.productName||''))return false;
  return configCollections(device).length>0;
}
function matches(device,models){
  if(!device||!models||BOOT_NAME_PATTERN.test(device.productName||''))return undefined;
  const found=models.filter(m=>m.family==='new'&&m.vid===device.vendorId&&((m.wired||[]).includes(device.productId)||(m.receiver||[]).includes(device.productId)));
  if(found.length<=1)return found[0];
  const name=(device.productName||'').toLowerCase();
  const named=found.filter(m=>name.includes(m.name.toLowerCase())).sort((a,b)=>b.name.length-a.name.length);
  return named[0];
}

function lodKind(list){
  if(!list)return null;
  if(list.length===LOD_COMMAND_LIST_LENGTH)return 'command';
  return list.length===2||list.length===3?'sensor':null;
}

class NewMouse{
  constructor(device,model,opts,collection){
    this.device=device;this.model=model;this.caps=model.caps||{};this.opts=opts||{};this.collection=collection;
    this.delay=this.opts.delay!==undefined?this.opts.delay:BUSY_DELAY_MS;
    this.timeout=this.opts.timeout||REPLY_TIMEOUT_MS;
    this.wired=!(model.receiver||[]).includes(device.productId);
    this.tail=Promise.resolve();this.pending=null;this.unsolicited=0;
    this.closed=false;this.faulted=false;this.ready=false;this.readOnly=false;this.stale=false;
    this.state=null;this.onChange=null;this.onProfile=null;this.replyReportIds=new Set();
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
    const raw=e.data&&e.data.buffer?new Uint8Array(e.data.buffer,e.data.byteOffset||0,e.data.byteLength):Uint8Array.from(e.data||[]);
    const f=decodeFrame(raw);
    const label='RX '+(e.reportId===undefined?'?':'id'+e.reportId);
    if(f)this.replyReportIds.add(e.reportId);
    if(!f){if(this.unsolicited++<UNSOLICITED_LOG_LIMIT)this.log(label+' unknown',raw);return;}
    if(f.cmd===CMD.ASYNC){this.log(label+' async',raw);this.asyncReport(f);return;}
    const p=this.pending;
    if(p&&f.cmd===p.cmd&&f.seq===p.seq){
      this.log(label,raw);
      if(f.checksum===false)this.note('Checksum mismatch in reply to '+hex(f.cmd)+' (ignored)');
      if(f.magic!==1)this.note('Unexpected first data byte '+f.magic+' in reply to '+hex(f.cmd));
      p.resolve(f);return;
    }
    if(this.unsolicited++<UNSOLICITED_LOG_LIMIT)this.log(label+' unmatched '+hex(f.cmd),raw);
  }
  asyncReport(f){
    const s=this.state,p=f.payload;if(!s||p.length<13)return;
    let changed=false;
    if(p[0]&1&&p[2]<s.stages.length){s.active=p[2];changed=true;}
    if(p[0]&2){
      const prev=s.battery;
      s.battery=p[3]>0&&p[3]<=100?{percent:p[3],charging:prev?prev.charging:false}:null;changed=true;
    }
    if(p[1]&2&&s.battery){s.battery.charging=CHARGING_IS_NONZERO?p[12]!==0:p[12]===1;changed=true;}
    if(p[0]&8&&p[6]!==s.profile){
      s.profile=p[6];this.stale=true;
      if(this.onProfile)this.onProfile(p[6]);
    }
    if(changed&&this.onChange)this.onChange(s);
  }
  once(cmd,payload){
    if(!SENDABLE.has(cmd))return Promise.reject(new Error('Command '+hex(cmd)+' is not allowed'));
    const frame=encodeFrame(cmd,payload,0);
    return new Promise((resolve,reject)=>{
      const done=()=>{clearTimeout(timer);this.pending=null;};
      const timer=setTimeout(()=>{done();this.fault();reject(new Error('Device timed out. Reconnect before changing settings.'));},this.timeout);
      this.pending={cmd,seq:0,resolve:f=>{done();resolve(f);}};
      this.log('TX',frame);
      Promise.resolve().then(()=>this.device.sendReport(REPORT_ID,frame)).catch(err=>{done();this.fault();reject(err);});
    });
  }
  async read(cmd,payload=[]){
    for(let a=0;a<BUSY_ATTEMPTS;a++){
      const f=await this.once(cmd,payload);
      if(f.payload[0]!==BUSY_BYTE)return f.payload;
      if(a<BUSY_ATTEMPTS-1)await sleep(this.delay);
    }
    throw new Error('Device busy, try again');
  }
  async write(cmd,payload){await this.once(cmd,payload);}
  async readName(slot){
    for(let attempt=0;attempt<=NAME_RETRIES;attempt++){
      const bytes=[];
      for(let off=0;off<NAME_MAX;off+=NAME_CHUNK){
        const n=Math.min(NAME_CHUNK,NAME_MAX-off),p=await this.read(CMD.NAME,[slot,off,n]);
        bytes.push(...Array.from(p).slice(0,n));
      }
      const nonzero=bytes.filter(b=>b!==0).length;
      if(nonzero!==1||attempt===NAME_RETRIES)return nonzero===1?'':decodeName(bytes);
      await sleep(this.delay);
    }
    return '';
  }
  profileCount(){return this.caps.profiles||PROFILE_COUNT_FALLBACK;}
  perfView(b){
    const c=this.caps,sb=b.sensor,kind=lodKind(c.lod),v={};
    v.profile=b.profile;v.active=b.stage;
    v.rate=RATE_BY_CODE[this.wired?b.rateUsb:b.rateG]||null;
    v.sleep=c.sleep?(b.sleepMode&&c.sleep.never||b.sleep===0?0:b.sleep):null;
    v.debounce=c.debounce?{left:b.left/DEBOUNCE_WIRE_PER_MS,right:b.right/DEBOUNCE_WIRE_PER_MS}:null;
    for(const k of Object.keys(SENSOR_BITS))v[k]=c[k]?!!(sb>>SENSOR_BITS[k]&1):null;
    v.angle=c.rotation?(b.rotate>127?b.rotate-256:b.rotate):null;
    v.mode=c.modes&&c.modes.length?sb&SENSOR_MODE_MASK:null;
    if(kind==='sensor'){
      const w=sb>>SENSOR_LOD_SHIFT&SENSOR_LOD_MASK,i=c.lod.length===2?w-1:w;
      v.lod=c.lod[i]!==undefined?c.lod[i]:null;
    }
    return v;
  }
  async loadState(){
    const info=parseInfo(await this.read(CMD.INFO));
    this.readOnly=info.vid!==this.model.vid;
    if(this.readOnly)this.note('Device reports vendor '+hex(info.vid)+', writes are disabled');
    const perf=parsePerf(await this.read(CMD.PERF));
    const count=this.profileCount(),profile=perf.profile<count?perf.profile:0;
    const dx=parseDpi(await this.read(CMD.DPI,[profile,0]));
    const dy=dx.hasY?parseDpi(await this.read(CMD.DPI,[profile,1])):dx;
    const s={...this.perfView(perf)};
    s.profile=profile;
    s.stages=[];for(let i=0;i<dx.sum;i++)s.stages.push({x:dx.values[i],y:dy.values[i]});
    if(s.active>=s.stages.length)s.active=0;
    if(lodKind(this.caps.lod)==='command'){
      const i=(await this.read(CMD.LOD,[profile]))[0];s.lod=this.caps.lod[i]!==undefined?this.caps.lod[i]:null;
    }else if(lodKind(this.caps.lod)!=='sensor')s.lod=null;
    s.profiles=[];
    for(let i=0;i<count;i++){const n=await this.readName(i);s.profiles.push({slot:i,name:n||'Profile '+(i+1)});}
    s.battery=info.battery>0&&info.battery<=100?{percent:info.battery,charging:CHARGING_IS_NONZERO?info.chargeStatus!==0:info.chargeStatus===1}:null;
    this.state=s;this.stale=false;this.ready=true;
    return s;
  }
  readState(){return this.lock(()=>this.loadState());}
  writable(){
    if(!this.ready||!this.state)throw new Error('Read the device state first');
    if(this.readOnly)throw new Error('Device identity did not match, writes are disabled');
  }
  finish(){if(this.onChange)this.onChange(this.state);return this.state;}
  mismatch(what,keys){
    const e=new Error('Read-back mismatch for '+what+' ('+keys.join(', ')+'). The mouse did not keep the value.');
    this.note(e.message);return e;
  }
  perfChange(what,mutate){
    return this.lock(async()=>{
      this.writable();
      const cur=parsePerf(await this.read(CMD.PERF));
      if(cur.profile>=this.profileCount())throw new Error('Unexpected active profile '+cur.profile);
      const next={...cur};mutate(next);
      await this.write(CMD.WRITE_PERF,encodePerf(next));
      const back=parsePerf(await this.read(CMD.PERF));
      Object.assign(this.state,this.perfView(back));
      const bad=PERF_KEYS.filter(k=>back[k]!==next[k]);
      if(bad.length){this.finish();throw this.mismatch(what,bad);}
      return this.finish();
    });
  }
  setStage(i){
    if(!Number.isInteger(i)||i<0||!this.state||i>=this.state.stages.length)return Promise.reject(new RangeError('DPI stage out of range'));
    return this.perfChange('DPI stage',b=>{b.stage=i;});
  }
  setRate(hz){
    const c=this.caps;
    if(!(c.rates||[]).includes(hz))return Promise.reject(new RangeError('Polling rate '+hz+' Hz is not available on this model'));
    if(!this.wired&&c.wirelessMaxRate&&hz>c.wirelessMaxRate)return Promise.reject(new RangeError('Polling rate above '+c.wirelessMaxRate+' Hz is not available wirelessly'));
    const code=RATE_CODES[hz];
    if(code===undefined)return Promise.reject(new RangeError('Polling rate '+hz+' Hz has no verified wire code'));
    return this.perfChange('polling rate',b=>{b.rateUsb=code;b.rateG=code;});
  }
  setSleep(min){
    const s=this.caps.sleep;
    if(!s)return Promise.reject(unsupported('Sleep timer'));
    if(!Number.isInteger(min))return Promise.reject(new RangeError('Sleep must be a whole number of minutes'));
    if(min===0){
      if(!s.never)return Promise.reject(new RangeError('Never sleep is not available on this model'));
      return this.perfChange('sleep',b=>{b.sleepMode=1;});
    }
    const lo=Math.max(1,s.min!==undefined?s.min:SLEEP_MIN_FALLBACK),hi=Math.min(SLEEP_BYTE_MAX,s.max!==undefined?s.max:SLEEP_MAX_FALLBACK);
    if(min<lo||min>hi)return Promise.reject(new RangeError('Sleep must be '+lo+' to '+hi+' minutes'));
    return this.perfChange('sleep',b=>{b.sleep=min;b.sleepMode=0;});
  }
  setDebounce(v){
    const d=this.caps.debounce;
    if(!d)return Promise.reject(unsupported('Debounce'));
    const pair=typeof v==='number'?{left:v,right:v}:v;
    if(!pair||typeof pair!=='object')return Promise.reject(new RangeError('Invalid debounce'));
    const lo=d.min!==undefined?d.min:DEBOUNCE_MIN_FALLBACK,hi=d.max!==undefined?d.max:DEBOUNCE_MAX_FALLBACK,step=d.step||1;
    for(const x of [pair.left,pair.right])
      if(!Number.isInteger(x)||x<lo||x>hi||(x-lo)%step!==0)return Promise.reject(new RangeError('Debounce must be '+lo+' to '+hi+' ms in steps of '+step));
    if(!d.split&&pair.left!==pair.right)return Promise.reject(new RangeError('This model uses one debounce value'));
    const wire=x=>x*DEBOUNCE_WIRE_PER_MS;
    return this.perfChange('debounce',b=>{b.left=wire(pair.left);b.right=wire(pair.right);});
  }
  setFlag(name,on){
    if(!(name in SENSOR_BITS))return Promise.reject(new RangeError('Unknown setting '+name));
    if(!this.caps[name])return Promise.reject(unsupported(name));
    if(typeof on!=='boolean')return Promise.reject(new RangeError('Flag must be true or false'));
    const bit=1<<SENSOR_BITS[name];
    return this.perfChange(name,b=>{b.sensor=on?b.sensor|bit:b.sensor&~bit&255;});
  }
  setAngle(deg){
    if(!this.caps.rotation)return Promise.reject(unsupported('Sensor rotation'));
    if(!Number.isInteger(deg)||Math.abs(deg)>ANGLE_LIMIT)return Promise.reject(new RangeError('Angle must be a whole number from -'+ANGLE_LIMIT+' to '+ANGLE_LIMIT));
    return this.perfChange('angle',b=>{b.rotate=deg<0?deg+256:deg;});
  }
  setMode(id){
    const modes=this.caps.modes;
    if(!modes||!modes.length)return Promise.reject(unsupported('Mode'));
    if(!Number.isInteger(id)||id<0||id>SENSOR_MODE_MASK||!modes.some(m=>m.id===id))return Promise.reject(new RangeError('Unknown mode'));
    return this.perfChange('mode',b=>{b.sensor=b.sensor&~SENSOR_MODE_MASK&255|id;});
  }
  setLod(mm){
    const list=this.caps.lod,kind=lodKind(list);
    if(!kind)return Promise.reject(unsupported('Lift-off distance'));
    const idx=list.indexOf(mm);
    if(idx<0)return Promise.reject(new RangeError('Lift-off distance '+mm+' mm is not available'));
    if(kind==='sensor'){
      const wire=list.length===2?idx+1:idx;
      return this.perfChange('lift-off distance',b=>{b.sensor=b.sensor&~(SENSOR_LOD_MASK<<SENSOR_LOD_SHIFT)&255|wire<<SENSOR_LOD_SHIFT;});
    }
    return this.lock(async()=>{
      this.writable();
      const profile=parsePerf(await this.read(CMD.PERF)).profile;
      if(profile>=this.profileCount())throw new Error('Unexpected active profile '+profile);
      await this.write(CMD.WRITE_LOD,[profile,idx]);
      const back=(await this.read(CMD.LOD,[profile]))[0];
      this.state.lod=list[back]!==undefined?list[back]:null;
      if(back!==idx){this.finish();throw this.mismatch('lift-off distance',['lod']);}
      return this.finish();
    });
  }
  validDpi(v){
    const d=this.caps.dpi||{},lo=d.min!==undefined?d.min:DPI_MIN_FALLBACK,step=d.step||1;
    return Number.isInteger(v)&&v>=lo&&(d.max===undefined||v<=d.max)&&(v-lo)%step===0;
  }
  dpiChange(what,mutate){
    return this.lock(async()=>{
      this.writable();
      const d=this.caps.dpi;
      if(!d)throw unsupported('DPI');
      const perf=parsePerf(await this.read(CMD.PERF));
      if(perf.profile>=this.profileCount())throw new Error('Unexpected active profile '+perf.profile);
      const profile=perf.profile;
      const dx=parseDpi(await this.read(CMD.DPI,[profile,0]));
      const dy=dx.hasY?parseDpi(await this.read(CMD.DPI,[profile,1])):dx;
      const t={sum:dx.sum,hasY:dx.hasY,x:dx.values.slice(),y:dy.values.slice()};
      mutate(t);
      let active=perf.stage;if(active>=t.sum)active=t.sum-1;
      for(let i=0;i<t.sum;i++)if(!this.validDpi(t.x[i])||!this.validDpi(t.y[i]))throw new RangeError('DPI table holds an invalid value for stage '+(i+1));
      await this.write(CMD.WRITE_DPI,encodeDpi(profile,0,t.hasY,t.sum,active,t.x));
      if(t.hasY)await this.write(CMD.WRITE_DPI,encodeDpi(profile,1,t.hasY,t.sum,active,t.y));
      const bx=parseDpi(await this.read(CMD.DPI,[profile,0]));
      const by=t.hasY?parseDpi(await this.read(CMD.DPI,[profile,1])):bx;
      const stages=[];for(let i=0;i<bx.sum;i++)stages.push({x:bx.values[i],y:by.values[i]});
      this.state.stages=stages;
      const bad=[];
      if(bx.sum!==t.sum)bad.push('count');
      if(bx.hasY!==t.hasY)bad.push('xy');
      for(let i=0;i<DPI_SLOTS;i++){if(bx.values[i]!==t.x[i])bad.push('x'+i);if(t.hasY&&by.values[i]!==t.y[i])bad.push('y'+i);}
      if(!bad.length&&active!==perf.stage){
        await this.write(CMD.WRITE_PERF,encodePerf({...perf,stage:active}));
        const back=parsePerf(await this.read(CMD.PERF));
        Object.assign(this.state,this.perfView(back));
        if(back.stage!==active)bad.push('active');
      }
      if(this.state.active>=stages.length)this.state.active=0;
      if(bad.length){this.finish();throw this.mismatch(what,bad);}
      return this.finish();
    });
  }
  fillDefaults(t,from,to){
    const max=(this.caps.dpi||{}).max;
    for(let i=from;i<to;i++){
      const def=max!==undefined?Math.min(DPI_DEFAULTS[i],max):DPI_DEFAULTS[i];
      if(!this.validDpi(t.x[i]))t.x[i]=def;
      if(!this.validDpi(t.y[i]))t.y[i]=t.x[i];
    }
  }
  setStageCount(n){
    const d=this.caps.dpi,max=Math.min(DPI_SLOTS,(d&&d.maxStages)||DPI_SLOTS);
    if(!Number.isInteger(n)||n<1||n>max)return Promise.reject(new RangeError('Stage count must be 1 to '+max));
    return this.dpiChange('stage count',t=>{if(n>t.sum)this.fillDefaults(t,t.sum,n);t.sum=n;});
  }
  setDpi(i,x,y=x){
    const d=this.caps.dpi;
    if(!d)return Promise.reject(unsupported('DPI'));
    if(!Number.isInteger(i)||i<0||!this.state||i>=this.state.stages.length)return Promise.reject(new RangeError('DPI stage out of range'));
    if(!this.validDpi(x)||!this.validDpi(y))return Promise.reject(new RangeError('DPI must be '+(d.min!==undefined?d.min:DPI_MIN_FALLBACK)+' to '+d.max+' in steps of '+(d.step||1)));
    if(x!==y&&!d.independentXY)return Promise.reject(unsupported('Separate X and Y DPI'));
    return this.dpiChange('DPI',t=>{
      if(x!==y&&!t.hasY){t.hasY=1;t.y=t.x.slice();}
      t.x[i]=x;t.y[i]=t.hasY?y:x;
    });
  }
  setProfile(slot){
    if(!Number.isInteger(slot)||slot<0||slot>=this.profileCount())return Promise.reject(new RangeError('Profile out of range'));
    return this.lock(async()=>{
      this.writable();
      if(this.state.profile===slot&&!this.stale)return this.state;
      await this.write(CMD.SELECT_PROFILE,[slot]);
      const back=parsePerf(await this.read(CMD.PERF));
      if(back.profile!==slot){this.state.profile=back.profile;this.finish();throw this.mismatch('profile',['profile']);}
      await this.loadState();
      if(this.onProfile)this.onProfile(slot);
      return this.finish();
    });
  }
  close(){
    this.closed=true;this.ready=false;this.detach();
    if(this.pending)this.pending.resolve({payload:[],cmd:0,seq:0});
    try{const r=this.device.close&&this.device.close();if(r&&r.catch)r.catch(()=>{});}catch(e){}
  }
}

async function open(device,model,opts={}){
  if(!model||model.family!=='new'||!model.caps)throw new Error('Not a supported MCHOSE model');
  if(!isConfigInterface(device))throw new Error('Not an MCHOSE configuration interface');
  const col=pickCollection(device),log=opts.log;
  if(log)log('NOTE',new TextEncoder().encode('Using collection usagePage '+hex(col.usagePage)+(hasOutput(col)?' (declares output report 0x4D)':' (output 0x4D not declared, using first match)')));
  if(!device.opened)await device.open();
  const inst=new NewMouse(device,model,opts,col);
  inst.attach();
  try{await inst.readState();}catch(e){inst.detach();inst.closed=true;throw e;}
  return inst;
}

const api={family:'new',open,matches,isConfigInterface,pickCollection,encodeFrame,decodeFrame,xorSum,RATE_CODES,RATE_CODE_250_UNVERIFIED,CMD};
root.MchoseDrivers=root.MchoseDrivers||{};
root.MchoseDrivers.new=api;
})(typeof window!=='undefined'?window:globalThis);
