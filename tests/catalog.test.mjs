import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../site/catalog.js',import.meta.url),'utf8');
const seed=JSON.parse(fs.readFileSync(new URL('../supabase/demo-properties.json',import.meta.url),'utf8'));
function setup(fetch){
 const window={ArenalConfig:{supabaseUrl:'https://example.supabase.co',publishableKey:'public-test'}};
 vm.runInNewContext(source,{window,fetch,URLSearchParams,AbortSignal});return window.ArenalData;
}
test('preserves catalog values and rounds only for display',()=>{
 const api=setup();const item=api.normalize({...seed[0],area:'700.25',price:'65000.75'});
 assert.equal(item.area,700.25);assert.equal(item.price,65000.75);
 assert.equal(item.name,seed[0].name);assert.equal(item.isDemo,true);
 assert.equal(item.privateResidential,seed[0].private_residential);
});
test('rejects invalid identifiers, coordinates and zero area',()=>{
 const api=setup();for(const change of [{id:undefined},{id:null},{id:'../bad'},{id:'<script>'},{lat:91},{lng:-181},{area:0},{price:-1}])assert.throws(()=>api.normalize({...seed[0],...change}));
});
test('real listings without photos never borrow demonstration imagery',()=>{
 const api=setup();const item=api.normalize({...seed[0],is_demo:false,images:['javascript:alert(1)','data:text/html,hello']});
 assert.equal(item.images[0],'icons/no-photo.svg');
});
test('paginates published rows and sends only the public API key',async()=>{
 const calls=[];const api=setup(async(url,options)=>{
  calls.push({url,options});return {ok:true,json:async()=>calls.length===1?Array.from({length:1000},()=>seed[0]):[seed[1]]};
 });
 const rows=await api.load();assert.equal(rows.length,1001);assert.equal(calls.length,2);
 assert.match(calls[1].url,/offset=1000/);assert.match(calls[0].url,/status=eq.published/);
 assert.equal(calls[0].options.headers.apikey,'public-test');assert.equal(calls[0].options.headers.Authorization,undefined);
});
test('an empty or unavailable database never silently displays old demo listings',async()=>{
 assert.equal((await setup(async()=>({ok:true,json:async()=>[]})).load()).length,0);
 await assert.rejects(setup(async()=>({ok:false,status:503})).load(),/503/);
});
test('all seed rows validate and are explicitly marked as demo',()=>{
 const api=setup();assert.equal(seed.length,100);assert.equal(new Set(seed.map(d=>d.id)).size,100);
 for(const row of seed){assert.equal(api.normalize(row).isDemo,true);assert.equal(row.status,'published');}
});
