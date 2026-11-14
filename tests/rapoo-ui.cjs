// node --test tests/rapoo-ui.cjs
// Small DOM fixture for the page's actual inline script; this does not verify browser layout.
const {test}=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../rapoo/index.html'),'utf8');
function create(html,query,setTimeout,clearTimeout,media){
const Encoder=TextEncoder,Decoder=TextDecoder,Params=URLSearchParams;

const listeners=new Map(),elements=new Map(),all=[];
class Element {
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.dataset={};this.style={};this.attributes={};this.children=[];this._class='';this._text='';this._value='';this.disabled=false;this.checked=false;this.open=false;
    this.classList={add:(...names)=>{const c=new Set(this._class.split(/\s+/).filter(Boolean));names.forEach(n=>c.add(n));this._class=[...c].join(' ');},
      remove:(...names)=>{this._class=this._class.split(/\s+/).filter(n=>!names.includes(n)).join(' ');},
      contains:n=>this._class.split(/\s+/).includes(n),toggle:(n,force)=>{const on=force??!this.classList.contains(n);on?this.classList.add(n):this.classList.remove(n);return on;}};
  }
  set className(v){this._class=String(v);} get className(){return this._class;}
  set value(v){this._value=String(v);}get value(){return this._value;}
  set textContent(v){this._text=String(v);this.children=[];}get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
  setAttribute(k,v){this.attributes[k]=String(v);if(k==='class')this.className=v;if(k==='id'){this.id=v;elements.set(v,this);}if(k.startsWith('data-'))this.dataset[k.slice(5)]=v;}
  getAttribute(k){return this.attributes[k]??null;}
  append(...children){for(const c of children){this.children.push(c);c.parentNode=this;}}
  replaceChildren(...children){this.children=[];this._text='';this.append(...children);}
  get childElementCount(){return this.children.length;}get firstChild(){return this.children[0];}
  get options(){return this.children;}
  remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(c=>c!==this);}
  click(){if(!this.disabled&&this.onclick)return this.onclick({target:this,preventDefault(){}});}
  focus(){document.activeElement=this;}select(){this.selected=true;}
  dispatchEvent(event){event.target=this;return this['on'+event.type]?.(event);}
}
const body=new Element('body');
for(const match of html.slice(html.indexOf('<body>'),html.indexOf('// Protocol start.')).matchAll(/<([a-z][\w-]*)(\s[^<>]*?)?>/gi)){
  const el=new Element(match[1]);const attrs=match[2]||'';
  for(const a of attrs.matchAll(/([\w-]+)="([^"]*)"/g))el.setAttribute(a[1],a[2]);
  if(/\bhidden(?:\s|>)/.test(attrs))el.hidden=true;all.push(el);
}
const document={body,title:'',hidden:false,activeElement:null,createElement:tag=>new Element(tag),
  addEventListener(type,fn){listeners.set(type,fn);},dispatchEvent(event){listeners.get(event.type)?.(event);},
  querySelector(selector){return selector.startsWith('#')?elements.get(selector.slice(1)):null;},
  querySelectorAll(selector){if(selector==='[data-tab]')return all.filter(el=>el.dataset.tab);if(selector==='[data-panel]')return all.filter(el=>el.dataset.panel);if(selector==='[data-mouse-key]')return all.filter(el=>el.getAttribute('data-mouse-key')!==null);return[];}};
const location={search:query,href:'',origin:'https://openatk.test'};
const navigator={userAgent:'Test',userAgentData:{mobile:false}};
const sandbox={document,location,navigator,URLSearchParams:Params,Uint8Array,DataView,TextEncoder:Encoder,TextDecoder:Decoder,setTimeout,clearTimeout,
  addEventListener(){},localStorage:{getItem(){return null;}},parent:null};
if(media)sandbox.matchMedia=()=>media;
sandbox.window=sandbox;sandbox.parent=sandbox;sandbox.globalThis=sandbox;
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
const app=new Function('sandbox','with(sandbox){'+scripts+'\nreturn {get driver(){return driver},get busy(){return busy},makeDemo,connect,attach,detach,models:MODELS};}')(sandbox);
return {app,document,all,sandbox};

}

test('Rapoo tabs, segments, sliders, custom values and connection diagnostics work together',async()=>{
  const timers=new Set();
  const setTimeout=(fn,ms)=>{const id=globalThis.setTimeout(()=>{timers.delete(id);fn();},ms);timers.add(id);return id;};
  const clearTimeout=id=>{timers.delete(id);globalThis.clearTimeout(id);};
  try {

const checks=[];
const ok=(condition,name)=>{if(!condition)throw Error(name);checks.push(name);};
const wait=async(page)=>{for(let i=0;i<400;i++){if(page.app.driver?.ready&&!page.app.busy)return;await new Promise(r=>setTimeout(r,5));}throw Error('UI did not finish: '+page.document.querySelector('#toast').textContent);};
const $=(page,id)=>page.document.querySelector('#'+id);
const press=async(page,id,text)=>{const button=$(page,id).children.find(b=>b.textContent===text);ok(!!button,'Control exists: '+id+'/'+text);button.click();await wait(page);};
const p=create(html,'?demo=standard',setTimeout,clearTimeout);await wait(p);
ok(p.all.filter(e=>e.dataset.tab).map(e=>e.dataset.tab).join(',')==='basics,tracking,light,buttons,macros,device','All OpenATK and macro tabs');
for(const tab of p.all.filter(e=>e.dataset.tab)){tab.click();await wait(p);ok(p.all.filter(e=>e.dataset.panel&&!e.classList.contains('hidden')).map(e=>e.dataset.panel).join('')===tab.dataset.tab,'Tab switches to '+tab.dataset.tab);}
const mapControls=p.document.querySelectorAll('[data-mouse-key]');
const beforeMap=JSON.stringify(p.app.driver.s.buttons.rows);
mapControls.find(el=>el.tagName==='BUTTON'&&el.getAttribute('data-mouse-key')==='5').click();
ok($(p,'buttonControl').value==='5'&&$(p,'buttonSelectionTitle').textContent==='Editing: Forward','Mouse callout selects the editor control');
ok(mapControls.filter(el=>el.getAttribute('data-mouse-key')==='5').every(el=>el.getAttribute('aria-pressed')==='true'),'Selected control reports its pressed state');
const rightControl=mapControls.find(el=>el.getAttribute('role')==='button'&&el.getAttribute('data-mouse-key')==='2');
rightControl.onkeydown({key:'Enter',preventDefault(){}});
ok($(p,'buttonControl').value==='2','Control buttons support keyboard selection');
$(p,'buttonControl').value='13';$(p,'buttonControl').onchange({target:$(p,'buttonControl')});
ok(mapControls.filter(el=>el.getAttribute('data-mouse-key')==='13').every(el=>el.classList.contains('selected')),'Dropdown selection highlights the DIY control');
ok(mapControls.filter(el=>['3','4'].includes(el.getAttribute('data-mouse-key'))).every(el=>el.classList.contains('hidden')),'Absent DPI buttons are hidden for the current model');
ok(JSON.stringify(p.app.driver.s.buttons.rows)===beforeMap&&!p.app.busy,'Control selection does not write or alter assignments');
await press(p,'segDpi','1,600 DPI');ok(p.app.driver.s.stages[p.app.driver.s.active].x===1600,'Sensitivity preset writes DPI');
$(p,'dpiX').value=1701;$(p,'dpiY').value=1902;$(p,'saveDpi').click();await wait(p);ok($(p,'sDpi').textContent==='1701/1902','Custom X/Y DPI retained');
$(p,'stage').value=2;$(p,'stage').onchange({target:$(p,'stage')});await wait(p);ok(p.app.driver.s.active===2,'Stage select captures value');
$(p,'count').value=7;$(p,'count').onchange({target:$(p,'count')});await wait(p);ok(p.app.driver.s.count===7,'Stage count select captures value');
await press(p,'segRate','8K');ok(p.app.driver.s.rate===129,'Polling segment writes vendor key');
ok($(p,'segSensorMode').children.map(b=>b.textContent).join(',')==='Rampage Competitive,Competition Hyper,Hyper','Sensor modes follow polling');
await press(p,'segSensorMode','Rampage Competitive');ok(p.app.driver.s.modes[6]===5,'Sensor mode segment writes rate slot');
$(p,'lod').value=1.2;$(p,'lod').oninput();$(p,'lod').onchange({target:$(p,'lod')});await wait(p);ok(p.app.driver.s.lod===6&&$(p,'lodOut').textContent==='1.2 mm','LOD slider maps mm to one-based index');
$(p,'angle').value=-12;$(p,'angle').oninput();$(p,'angle').onchange({target:$(p,'angle')});await wait(p);ok(p.app.driver.s.angle===-12,'Rotation slider saves signed angle');
await press(p,'segPress','4 ms');await press(p,'segRelease','12 ms');ok(p.app.driver.s.press===4&&p.app.driver.s.release===12,'Debounce segments save independently');
$(p,'press').value=3;$(p,'press').onchange({target:$(p,'press')});await wait(p);ok(p.app.driver.s.press===3,'Custom debounce retained');
await press(p,'segSleep','Never');ok(p.app.driver.s.sleep===255,'Never-sleep segment');
$(p,'sleepOff').checked=false;$(p,'sleepOff').onchange();$(p,'sleep').value=11;$(p,'saveSleep').click();await wait(p);ok(p.app.driver.s.sleep===11,'Custom sleep timeout retained');
for(const id of ['snap','ripple','motion','glass','lowLight','dc']){$(p,id).checked=true;$(p,id).onchange({target:$(p,id)});await wait(p);}
ok((p.app.driver.s.correction&3)===0&&p.app.driver.s.glass===1&&p.app.driver.s.lowLight===1&&p.app.driver.s.dc===1,'Tracking, lighting and DC switches');
await press(p,'segProfile','Creative');ok(p.app.driver.s.profile===2&&$(p,'dpiX').value==='800','Profile segment loads existing settings');ok(!$(p,'dc').checked,'Profile switch reloads DC mode');
$(p,'dpiX').value=60001;$(p,'saveDpi').click();await wait(p);ok($(p,'dpiX').value==='800'&&$(p,'toast').textContent.includes('DPI'),'Invalid DPI rolls back');
$(p,'togglelog').click();ok(!$(p,'connectionDetails').classList.contains('hidden')&&$(p,'connectionDetails').open,'Device activity log remains available');
await $(p,'copylog').click();ok(!$(p,'logCopy').classList.contains('hidden'),'Copy-details fallback remains available');
const standard=p.app.makeDemo();standard.productId=p.app.models.find(m=>m.name==='VT9').wired;await p.app.attach(standard);await wait(p);
ok(String($(p,'lod').min)==='1'&&String($(p,'lod').max)==='2'&&$(p,'scanRow').classList.contains('hidden'),'Model-specific LOD and scan controls');
await p.app.detach();
const receiver=create(html,'?demo=dongle',setTimeout,clearTimeout);await wait(receiver);ok(!receiver.app.driver.wired,'Receiver demo retained');await receiver.app.detach();
const blocked=create(html,'',setTimeout,clearTimeout);ok(!$(blocked,'blocked').classList.contains('hidden'),'Unsupported browser fallback');
blocked.sandbox.navigator.hid={addEventListener(){},async requestDevice(){const d=blocked.app.makeDemo();d.collections=[{usagePage:0xff00,usage:2}];return[d];},async getDevices(){return[];}};
await blocked.app.connect();await wait(blocked);ok(!$(blocked,'app').classList.contains('hidden'),'Missing report metadata connection fix retained');await blocked.app.detach();
blocked.sandbox.navigator.hid.requestDevice=async()=>{const d=blocked.app.makeDemo();d.collections=[{usagePage:0xff00,usage:14}];return[d];};
await blocked.app.connect();ok(!$(blocked,'connectError').classList.contains('hidden')&&!$(blocked,'connectionDetails').classList.contains('hidden'),'Failed connection diagnostics visible');
const rt=create(html,'?demo=1',setTimeout,clearTimeout);await wait(rt);ok(!$(rt,'rtSettings').classList.contains('hidden'),'Default demo shows VT2 RT settings');
const beforeLeafSelection=JSON.stringify(rt.app.driver.s.rt);
$(rt,'rtLeafRight').click();ok($(rt,'rtPaneLeft').classList.contains('hidden')&&!$(rt,'rtPaneRight').classList.contains('hidden'),'Right click leaf opens right settings');
ok($(rt,'rtLeafRight').classList.contains('highlighted')&&!$(rt,'rtLeafLeft').classList.contains('highlighted'),'Only selected click leaf highlights');
$(rt,'rtLeafLeft').onmouseenter();ok($(rt,'rtLeafLeft').classList.contains('highlighted')&&!$(rt,'rtLeafRight').classList.contains('highlighted'),'Hover previews other click leaf');$(rt,'rtLeafLeft').onmouseleave();
ok($(rt,'rtLeafRight').classList.contains('highlighted'),'Leaving hover restores selected leaf');
$(rt,'rtLeafLeft').onkeydown({key:'Enter',preventDefault(){}});ok(!$(rt,'rtPaneLeft').classList.contains('hidden')&&$(rt,'rtSelectLeft').getAttribute('aria-pressed')==='true','Leaf keyboard selection opens left settings');
$(rt,'rt_rightVolume').onfocus();ok(!$(rt,'rtPaneRight').classList.contains('hidden'),'Focusing a right-side setting highlights the right leaf');
$(rt,'rt_feedback').onfocus();ok($(rt,'rtLeafLeft').classList.contains('highlighted')&&$(rt,'rtLeafRight').classList.contains('highlighted'),'Shared feedback highlights both leaves');$(rt,'rt_feedback').onblur();
ok(JSON.stringify(rt.app.driver.s.rt)===beforeLeafSelection,'Leaf selection, hover and focus do not alter RT settings');$(rt,'rtSelectLeft').click();
$(rt,'rt_leftTravel').value='7';$(rt,'rt_leftTravel').onchange({target:$(rt,'rt_leftTravel')});await wait(rt);ok(rt.app.driver.s.rt.leftTravel===7,'Actuation control saves');
$(rt,'rt_rightEnabled').checked=true;$(rt,'rt_rightEnabled').onchange({target:$(rt,'rt_rightEnabled')});await wait(rt);ok(rt.app.driver.s.rt.rightEnabled===1,'Rapid trigger switch saves');
$(rt,'rt_leftTravel').value='11';$(rt,'rt_leftTravel').onchange({target:$(rt,'rt_leftTravel')});await wait(rt);ok($(rt,'rt_leftTravel').value==='7','Invalid RT value rolls back');
ok($(p,'rtSettings').classList.contains('hidden')&&$(p,'rt_leftTravel').disabled,'Standard model hides and disables RT controls');await rt.app.detach();
const rtReceiver=create(html,'?demo=dongle',setTimeout,clearTimeout);await wait(rtReceiver);ok(rtReceiver.app.driver.model.rt&&!rtReceiver.app.driver.wired,'Default receiver demo uses VT2 RT');await rtReceiver.app.detach();
const assignments=create(html,'?demo=1',setTimeout,clearTimeout);await wait(assignments);
assignments.all.find(el=>el.dataset.tab==='buttons').click();await wait(assignments);
for(const [index,number] of [[0,1],[2,2],[1,3],[6,4],[5,5],[9,6],[10,7],[13,8]])ok($(assignments,'assignmentNumber'+index).textContent===String(number),'Contiguous mouse number '+number);
ok($(assignments,'assignmentRow3').classList.contains('hidden')&&$(assignments,'assignmentRow4').classList.contains('hidden'),'RT mouse hides absent DPI rows');
const rowSelect=$(assignments,'assignmentAction6');rowSelect.value='mouse:forward';rowSelect.onchange({target:rowSelect});await wait(assignments);
ok(assignments.app.driver.s.buttons.rows.find(r=>r.index===6).action.button==='forward','Row dropdown saves simple remap immediately');
const leftSelect=$(assignments,'assignmentAction0');leftSelect.value='mouse:right';leftSelect.onchange({target:leftSelect});await wait(assignments);
ok(leftSelect.value==='mouse:left'&&assignments.app.driver.s.buttons.rows.find(r=>r.index===0).action.button==='left','Last left click guard rolls back row dropdown');
const beforeDraft=JSON.stringify(assignments.app.driver.s.buttons.rows);rowSelect.value='keyboard';rowSelect.onchange({target:rowSelect});
ok($(assignments,'buttonAdvanced').open&&!$(assignments,'buttonKeyboardFields').classList.contains('hidden'),'Shortcut opens detailed editor');
ok(JSON.stringify(assignments.app.driver.s.buttons.rows)===beforeDraft,'Custom mapping selection does not write an unfinished shortcut');
$(assignments,'buttonKey').value='5';$(assignments,'buttonSave').click();await wait(assignments);
ok(assignments.app.driver.s.buttons.rows.find(r=>r.index===6).action.code===5,'Detailed shortcut save still works');
await press(assignments,'segProfile','Creative');ok($(assignments,'assignmentAction6').value==='mouse:back'&&!$(assignments,'assignmentAction6').disabled,'Profile switch reloads row assignments');
const label=assignments.all.find(el=>el.getAttribute('data-mouse-key')==='6'&&el.classList.contains('assignment-label'));label.onmouseenter();
ok($(assignments,'assignmentRow6').classList.contains('hovered')&&assignments.all.filter(el=>el.getAttribute('data-mouse-key')==='6').every(el=>el.classList.contains('hovered')),'Hover links numbered marker and assignment row');label.onmouseleave();await assignments.app.detach();
return checks;

  } finally { for(const timer of timers)globalThis.clearTimeout(timer); }
});


test('Rapoo artwork cycles, pauses, respects reduced motion and stops offscreen',()=>{
  const assert=require('node:assert/strict');
  let nextId=0;const timers=new Map();
  const later=(fn,ms)=>{const id=++nextId;timers.set(id,{fn,ms});return id;};
  const cancel=id=>timers.delete(id);
  const tick=()=>{const entry=[...timers].find(([,timer])=>timer.ms===5000);assert.ok(entry,'slideshow has one scheduled frame');timers.delete(entry[0]);entry[1].fn();};
  const media={matches:false,addEventListener(type,fn){this.change=fn;}};
  const p=create(html,'',later,cancel,media),get=id=>p.document.querySelector('#'+id);
  assert.equal(get('heroCaption').textContent,'Rapoo VT3S MAX V2');
  tick();assert.equal(get('heroCaption').textContent,'Rapoo VT9');
  assert.equal(get('blockedImage').src,get('heroImage').src);
  get('blockedPause').click();assert.equal(timers.size,0);assert.equal(get('heroPause').getAttribute('aria-pressed'),'true');
  get('heroPause').click();tick();assert.equal(get('heroCaption').textContent,'Rapoo VT1 MAX');
  tick();assert.equal(get('heroCaption').textContent,'Rapoo VT3S MAX V2');
  media.matches=true;media.change();assert.equal(timers.size,0);assert.ok(get('heroPause').classList.contains('hidden'));
  media.matches=false;media.change();assert.ok(!get('heroPause').classList.contains('hidden'));
  p.document.hidden=true;p.document.dispatchEvent({type:'visibilitychange'});assert.equal(timers.size,0);
  p.document.hidden=false;p.document.dispatchEvent({type:'visibilitychange'});tick();assert.equal(get('heroCaption').textContent,'Rapoo VT9');
  get('app').classList.remove('hidden');p.document.dispatchEvent({type:'visibilitychange'});assert.equal(timers.size,0);
  for(const el of p.all.filter(el=>el.tagName==='IMG'))assert.notEqual(el.getAttribute('src'),'../assets/mouse.webp');
});

test('Reduced-motion users get a static Rapoo image from first load',()=>{
  const assert=require('node:assert/strict');const timers=new Map();let id=0;
  const p=create(html,'',(fn,ms)=>{timers.set(++id,{fn,ms});return id;},id=>timers.delete(id),{matches:true,addEventListener(){}});
  assert.equal(timers.size,0);assert.equal(p.document.querySelector('#heroCaption').textContent,'Rapoo VT3S MAX V2');
});
