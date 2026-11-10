import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const source=readFileSync(new URL('../site/analytics.js',import.meta.url),'utf8');
function browser({hostname='arenalindex.com',pathname='/',dnt,admin=false,disabledStorage=false}={}){
  let clock=Date.parse('2026-11-10T20:00:00Z');const intervals=[],listeners={},requests=[];
  const storage=()=>{const rows=new Map();return {getItem:key=>rows.get(key)||null,setItem:(key,value)=>rows.set(key,value)};};
  const window={location:{hostname,pathname,hash:''},localStorage:storage(),sessionStorage:storage(),crypto:webcrypto,innerWidth:400,ArenalConfig:{intakeUrl:'https://arenalindex-intake.vercel.app/api/intake'},arenalDemo:{state:{saved:[]}},ArenalI18n:{language:'en'},setInterval(fn,ms){intervals.push({fn,ms});},addEventListener(name,fn){listeners[name]=fn;},async fetch(url,options){requests.push({url,body:JSON.parse(options.body),options});return {ok:true};}};
  if(admin)window.sessionStorage.setItem('arenalindex.admin-session',JSON.stringify({expiresAt:clock+3600000}));
  if(disabledStorage)Object.defineProperty(window,'localStorage',{get(){throw Error('Storage disabled');}});
  const document={hidden:false,readyState:'loading',referrer:'https://www.google.com/search?email=private',addEventListener(name,fn){listeners[name]=fn;}};
  class FakeDate extends Date{constructor(value){super(value===undefined?clock:value);}static now(){return clock;}}
  vm.runInNewContext(source,{window,document,navigator:{doNotTrack:dnt},Date:FakeDate,Uint8Array,URL,URLSearchParams,AbortSignal});
  const tick=()=>intervals.find(timer=>timer.ms===5000)?.fn(),flush=()=>intervals.find(timer=>timer.ms===60000)?.fn();
  return {window,document,listeners,requests,tick,flush,advance(ms){clock+=ms;},async settle(){await new Promise(resolve=>setImmediate(resolve));}};
}
test('tracking excludes private routes, local previews, admin sessions and Do Not Track',()=>{
  for(const settings of [{hostname:'127.0.0.1'},{pathname:'/admin/'},{pathname:'/newlisting/preview/'},{admin:true},{dnt:'1'}])assert.equal(browser(settings).window.ArenalAnalytics,undefined);
});
test('active time stops after inactivity and hidden time is excluded; page loads and interactions remain distinct',async()=>{
  const e=browser();e.window.ArenalAnalytics.start();await e.settle();assert.equal(e.requests[0].body.events[0].type,'page_view');
  assert.equal(e.requests[0].body.referrer,'https://www.google.com');
  for(let i=0;i<24;i++){e.advance(5000);e.tick();}e.flush();await e.settle();assert.equal(e.requests[1].body.activeMs,60000);
  e.document.hidden=true;for(let i=0;i<12;i++){e.advance(5000);e.tick();}e.flush();await e.settle();assert.equal(e.requests.length,2);
  e.document.hidden=false;e.listeners.visibilitychange();e.window.ArenalAnalytics.track('listing_view',{id:'real-property'});e.window.ArenalAnalytics.photo('photo_open',{id:'real-property'},'/photos/lot.jpg');
  e.advance(5000);e.tick();e.flush();await e.settle();assert.equal(e.requests[2].body.activeMs,5000);assert.deepEqual(e.requests[2].body.events.map(event=>event.type),['listing_view','photo_open']);
});
test('visits rotate after 30 minutes, saved snapshots reflect the latest local state and storage can be unavailable',async()=>{
  const e=browser({disabledStorage:true});e.window.ArenalAnalytics.start();await e.settle();const first=e.requests[0].body.visit;
  e.advance(31*60000);e.listeners.pointerdown();e.window.arenalDemo.state.saved=['real-property'];e.window.ArenalAnalytics.saved({id:'real-property'},true);e.flush();await e.settle();
  assert.notEqual(e.requests.at(-1).body.visit,first);assert.deepEqual(e.requests.at(-1).body.saved,['real-property']);assert.ok(e.requests.at(-1).body.events.some(event=>event.type==='save'));
});
test('network retries resend the same batch id without discarding newer activity',async()=>{
  const e=browser();let fail=true;const sent=[];e.window.fetch=async(url,options)=>{sent.push(JSON.parse(options.body));if(fail)throw Error('Offline');return {ok:true};};
  e.window.ArenalAnalytics.start();await e.settle();fail=false;e.window.ArenalAnalytics.track('listing_view',{id:'real-property'});e.flush();await e.settle();
  assert.equal(sent[0].id,sent[1].id);assert.notEqual(sent[1].id,sent[2].id);assert.equal(sent[2].events[0].type,'listing_view');
});
test('public page visits begin on DOM readiness without waiting for a successful catalog load',async()=>{
  const e=browser({pathname:'/publicar/'});delete e.window.arenalDemo;e.listeners.DOMContentLoaded();await e.settle();
  assert.equal(e.requests.length,1);assert.equal(e.requests[0].body.events[0].page,'/publicar/');
});
