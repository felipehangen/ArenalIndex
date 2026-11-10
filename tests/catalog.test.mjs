import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../site/catalog.js',import.meta.url),'utf8');
const seed=JSON.parse(fs.readFileSync(new URL('../supabase/demo-properties.json',import.meta.url),'utf8'));
function setup(fetch,config={}){
 const window={ArenalConfig:{supabaseUrl:'https://example.supabase.co',publishableKey:'public-test',...config}};
 vm.runInNewContext(source,{window,fetch,URLSearchParams,AbortSignal});return window.ArenalData;
}
test('preserves catalog values and rounds only for display',()=>{
 const api=setup();const item=api.normalize({...seed[0],area:'700.25',price:'65000.75'});
 assert.equal(item.area,700.25);assert.equal(item.price,65000.75);
 assert.equal(item.name,seed[0].name);assert.equal(item.isDemo,true);
 assert.equal(item.privateResidential,false); // The old flag cannot establish a condominium regime.
});
test('rejects invalid identifiers, coordinates and zero area',()=>{
 const api=setup();for(const change of [{id:undefined},{id:null},{id:'../bad'},{id:'<script>'},{lat:91},{lng:-181},{area:0},{price:-1}])assert.throws(()=>api.normalize({...seed[0],...change}));
});
test('real listings without photos never borrow demonstration imagery',()=>{
 const api=setup();const item=api.normalize({...seed[0],is_demo:false,images:['javascript:alert(1)','data:text/html,hello']});
 assert.equal(item.images[0],'/icons/no-photo.svg');
});
test('paginates published rows and sends only the public API key',async()=>{
 const calls=[];const api=setup(async(url,options)=>{
  calls.push({url,options});return {ok:true,json:async()=>calls.length===1?Array.from({length:1000},()=>seed[0]):[seed[1]]};
 });
 const rows=await api.load();assert.equal(rows.length,1001);assert.equal(calls.length,2);
 assert.match(calls[1].url,/offset=1000/);assert.match(calls[0].url,/status=eq.published/);
 assert.equal(calls[0].options.headers.apikey,'public-test');assert.equal(calls[0].options.headers.Authorization,undefined);
 const selected=new URL(calls[0].url).searchParams.get('select').split(',');
 assert.ok(selected.includes('currency'));assert.ok(selected.includes('details'));
});
test('an empty or unavailable database never silently displays old demo listings',async()=>{
 assert.equal((await setup(async()=>({ok:true,json:async()=>[]})).load()).length,0);
 await assert.rejects(setup(async()=>({ok:false,status:503})).load(),/503/);
});
test('all seed rows validate and are explicitly marked as demo',()=>{
 const api=setup();assert.equal(seed.length,100);assert.equal(new Set(seed.map(d=>d.id)).size,100);
 for(const row of seed){assert.equal(api.normalize(row).isDemo,true);assert.equal(row.status,'published');}
});
test('approved listings join the catalog in their original currency without leaking private fields',async()=>{
 const api=setup(async url=>({ok:true,json:async()=>url.includes('/published')?[{...seed[0],id:'approved-listing',currency:'CRC',contact:'private',details:{schemaVersion:1,residential:'condo'}}]:seed.slice(0,1)}),{listingsUrl:'https://example.test/published'});
 const rows=await api.load();assert.equal(rows.length,2);assert.equal(rows[0].currency,'CRC');assert.equal(rows[0].privateResidential,true);assert.equal(rows[0].contact,undefined);
 assert.throws(()=>api.normalize({...seed[0],currency:'EUR'}),/currency/);
});
test('a failed publication feed cannot silently present a partial catalog',async()=>{
 const api=setup(async url=>url.includes('/published')?{ok:false}:{ok:true,json:async()=>seed.slice(0,1)},{listingsUrl:'https://example.test/published'});
 await assert.rejects(api.load(),/Published listings unavailable/);
});
test('both sources start before either responds and the catalog waits for both',async()=>{
 const requests=[];let completed=false;
 const api=setup(url=>new Promise(resolve=>requests.push({url,resolve})),{listingsUrl:'https://example.test/published'});
 const loading=api.load().then(rows=>{completed=true;return rows;});
 assert.equal(requests.length,2);
 const database=requests.find(r=>r.url.includes('/rest/')),published=requests.find(r=>r.url.includes('/published'));
 database.resolve({ok:true,json:async()=>seed.slice(0,1)});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(completed,false);
 published.resolve({ok:true,json:async()=>[{...seed[1],id:'new-publication'}]});
 const rows=await loading;assert.equal(rows.length,2);assert.equal(rows[0].id,'new-publication');
});
test('the managed catalog is the only source when enabled, so deleted demos cannot reappear from Supabase',async()=>{
 const calls=[],api=setup(async url=>{calls.push(url);return {ok:true,json:async()=>[seed[1]]};},{managedCatalog:true,listingsUrl:'https://example.test/listings'});
 const rows=await api.load();assert.equal(calls.length,1);assert.equal(calls[0],'https://example.test/listings?catalog=1');assert.equal(rows.length,1);assert.equal(rows[0].id,seed[1].id);
});
