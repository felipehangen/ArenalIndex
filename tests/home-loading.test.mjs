import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../site/home-loading.js',import.meta.url),'utf8');
function setup(){
 const nodes=new Map(),timers=new Map(),controls=[{inert:true},{inert:true}];let timerId=0,reloads=0;
 const q=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,dataset:{},clientHeight:600,setAttribute(k,v){this[k]=v;}});return nodes.get(id);};
 const root={dataset:{catalog:'loading'},style:{setProperty(){}},querySelector:q,querySelectorAll:()=>controls},window={};
 vm.runInNewContext(source,{window,document:{getElementById:()=>root},ArenalSheetBounds:space=>({min:264,max:space}),ResizeObserver:class{observe(){}disconnect(){}},setTimeout:(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId;},clearTimeout:id=>timers.delete(id),location:{reload(){reloads++;}}});
 return {api:window.ArenalHomeLoading,q,root,controls,tick(ms){for(const [id,t] of [...timers])if(t.ms<=ms){timers.delete(id);t.fn();}},get reloads(){return reloads;}};
}
test('listings become usable while the map is still loading',()=>{
 const s=setup();s.api.mapStarted();s.api.catalogReady();
 assert.equal(s.root.dataset.catalog,'ready');assert.equal(s.q('#catalog-skeleton').hidden,true);
 assert.equal(s.q('#index-list')['aria-busy'],'false');assert.ok(s.controls.every(c=>!c.inert));
 assert.equal(s.q('#map-loading').hidden,false);
 s.api.mapReady();assert.equal(s.q('#map-loading').hidden,true);
 s.tick(10000);assert.equal(s.q('#catalog-wait').hidden,true);assert.equal(s.q('#map-loading').hidden,true);
});
test('a slow request offers a retry and a failed catalog removes the skeleton',()=>{
 const s=setup();s.tick(8000);assert.equal(s.q('#catalog-retry').hidden,false);
 s.q('#catalog-retry').onclick();assert.equal(s.reloads,1);
 s.api.catalogFailed();assert.equal(s.q('#catalog-skeleton').hidden,true);assert.equal(s.q('#catalog-retry').hidden,false);
 assert.equal(s.q('#map-loading').hidden,true);assert.equal(s.root.dataset.catalog,'error');assert.ok(s.controls.every(c=>c.inert));
});
test('map failure keeps the catalog available and survives a partial map load',()=>{
 const s=setup();s.api.catalogReady();s.api.mapStarted();s.api.mapFailed();s.api.mapReady();
 assert.equal(s.root.dataset.catalog,'ready');assert.equal(s.q('#map-loading').hidden,false);
 assert.equal(s.q('#map-loading').dataset.state,'error');assert.equal(s.q('#map-loading-retry').hidden,false);
 assert.ok(s.controls.every(c=>!c.inert));
 s.q('#map-loading-retry').onclick();assert.equal(s.reloads,1);
});
