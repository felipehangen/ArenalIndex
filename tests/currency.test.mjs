import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
const window={};
for(const file of ['pricing.js','ui-format.js','property-content.js'])vm.runInNewContext(fs.readFileSync(new URL('../site/'+file,import.meta.url),'utf8'),{window});
// Deliberately simple test quote, not production exchange-rate data.
const rate={source:'BCCR',method:'midpoint',buy:498,sell:502,date:'2026-11-09',checkedAt:'2026-11-09T12:00:00Z'};
const usd=Object.freeze({price:100000,area:2000,currency:'USD',river:false}),crc=Object.freeze({price:50000000,area:2000,currency:'CRC'});
const filters={currency:'USD',price:[0,100000],unit:[0,50],area:[0,10000],house:'any',zone:'all'};
const setup=(items=[usd,crc],quote=rate)=>{
 const pricing=window.ArenalPricing.create(items,quote);
 const matches=vm.runInNewContext('('+source.match(/function matches\(d,f\)\{[^\n]+/)[0]+')',{pricing});
 return {pricing,matches};
};
test('USD and CRC search the entire catalog using equivalent total and per-m² prices',()=>{
 const {pricing,matches}=setup();
 for(const item of [usd,crc]){
  assert.equal(matches(item,filters),true);
  assert.equal(matches(item,pricing.switchCurrency(filters,'CRC')),true);
  assert.equal(matches(item,{...filters,price:[0,99999]}),false);
  assert.equal(matches(item,{...filters,unit:[0,49]}),false);
 }
 assert.equal(pricing.view(crc,'USD').price,100000);
 assert.equal(pricing.view(usd,'CRC').unit,25000);
 assert.equal(pricing.view(usd,'USD').approximate,false);
 assert.equal(pricing.view(crc,'USD').approximate,true);
});
test('area and feature filters still apply independently of currency',()=>{
 const {pricing,matches}=setup();
 for(const currency of ['USD','CRC']){
  const f=pricing.switchCurrency(filters,currency);
  assert.equal(matches(usd,{...f,area:[0,1999]}),false);
  assert.equal(matches(usd,{...f,river:true}),false);
  assert.equal(matches({...usd,river:true},{...f,river:true}),true);
 }
});
test('switching currency preserves both budget ranges, features, and unbounded defaults',()=>{
 const {pricing}=setup();
 const f={...filters,price:[12345.67,98765.43],unit:[2.71,48.93],river:true};
 const next=pricing.switchCurrency(f,'CRC');
 assert.equal(next.price[1],98765.43*500);assert.equal(next.unit[0],2.71*500);assert.equal(next.river,true);
 let roundtrip=f;for(let i=0;i<100;i++)roundtrip=pricing.switchCurrency(pricing.switchCurrency(roundtrip,'CRC'),'USD');
 assert.ok(Math.abs(roundtrip.price[1]-f.price[1])<1e-8);assert.ok(Math.abs(roundtrip.unit[0]-f.unit[0])<1e-12);
 const caps=pricing.caps('USD'),all={...filters,price:[0,caps.price],unit:[0,caps.unit]};
 const converted=pricing.switchCurrency(all,'CRC');
 assert.equal(converted.price[1],pricing.caps('CRC').price);assert.equal(converted.unit[1],pricing.caps('CRC').unit);
 assert.deepEqual(f.price,[12345.67,98765.43]);
});
test('filtering uses full precision with only machine-rounding tolerance at converted boundaries',()=>{
 const p={price:150000.23,area:1234.56,currency:'USD'},q={...rate,buy:446.56,sell:452.13};
 const {pricing,matches}=setup([p],q);
 const f={...filters,price:[p.price,p.price],unit:[p.price/p.area,p.price/p.area]};
 assert.equal(matches(p,pricing.switchCurrency(f,'CRC')),true);
 const under={...f,price:[0,p.price-0.001]};assert.equal(matches(p,under),false);
});
test('300 mixed listings reuse prepared prices and produce identical results in both currencies',()=>{
 const items=Array.from({length:300},(_,i)=>Object.freeze({id:String(i),price:(i+1)*1000*(i%2?500:1),currency:i%2?'CRC':'USD',area:1000+i}));
 const {pricing,matches}=setup(items);
 const f={...filters,price:[75000,225000],unit:[50,170]};
 const usdResults=items.filter(d=>matches(d,f)).map(d=>d.id);
 const crcResults=items.filter(d=>matches(d,pricing.switchCurrency(f,'CRC'))).map(d=>d.id);
 assert.deepEqual(crcResults,usdResults);assert.ok(usdResults.length>0);
 for(const item of items)assert.equal(pricing.view(item,'CRC'),pricing.view(item,'CRC'));
 for(const currency of ['USD','CRC']){
  const caps=pricing.caps(currency),all={...filters,currency,price:[0,caps.price],unit:[0,caps.unit]};
  assert.equal(items.filter(d=>matches(d,all)).length,300);
 }
});
test('missing or malformed exchange rates retain all listings in their original currencies',()=>{
 for(const quote of [null,{}, {...rate,buy:0},{...rate,sell:NaN},{...rate,date:'2026-02-30'}]){
  const {pricing,matches}=setup([usd,crc],quote);
  assert.equal(pricing.rate,null);
  for(const item of [usd,crc]){
   assert.equal(matches(item,{...filters,currency:'CRC',price:[0,1]}),true);
   assert.equal(pricing.view(item,'CRC').currency,item.currency);
   assert.equal(pricing.view(item,'USD').price,item.price);
  }
  assert.match(pricing.note(),/temporalmente desactivados/);
 }
});
test('the rate is fixed for the browsing session and null draft prices are never converted to zero',()=>{
 const mutable={...rate},pricing=window.ArenalPricing.create([usd],mutable);mutable.buy=100;
 assert.equal(pricing.view(usd,'CRC').price,50000000);
 const draft={price:null,area:2000,currency:'USD'};
 assert.equal(pricing.view(draft,'CRC').price,null);assert.equal(pricing.view(draft,'CRC').unit,null);
 assert.match(pricing.note(),/BCCR/);assert.match(pricing.note(),/2026/);
});
test('formatting and buyer essentials show the selected currency and approximation',()=>{
 const {pricing}=setup();
 assert.equal(window.ArenalFormat.money(95000000,'CRC'),'₡95,000,000');
 assert.equal(window.ArenalFormat.compactMoney(95000000,'CRC'),'₡95M');
 const item={...usd,images:[],house:false};
 const html=window.ArenalListing.content(item,pricing.view(item,'CRC'));
 assert.match(html,/≈ ₡25,000/);assert.match(html,/CRC\/m²/);
 assert.doesNotMatch(html,/USD\/m²/);
});
