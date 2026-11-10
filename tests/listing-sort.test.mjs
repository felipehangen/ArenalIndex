import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const window={};
for(const file of ['pricing.js','listing-sort.js'])vm.runInNewContext(fs.readFileSync(new URL('../site/'+file,import.meta.url),'utf8'),{window});
const quote={source:'BCCR',method:'midpoint',buy:498,sell:502,date:'2026-11-09',checkedAt:'2026-11-09T12:00:00Z'};
const ids=list=>Array.from(list,item=>item.id);
const create=(items,options={seed:123},rate=quote)=>{
  const pricing=window.ArenalPricing.create(items,rate);
  return window.ArenalListingSort.create(items,pricing,options);
};
const catalog=Object.freeze(Array.from({length:300},(_,i)=>Object.freeze({id:'lot-'+i,price:i%2?(i+1)*250000:(i+1)*500,currency:i%2?'CRC':'USD',area:((i*7)%19+1)*100,water:i%3===0,house:i%4===0,place:['Jauri','La Fortuna','Zeta 13'][i%3]})));

test('Explore gives each visit a varied order while preserving membership, filters, and pagination',()=>{
  const before=JSON.stringify(catalog),sort=create(catalog),order=ids(sort.order(catalog));
  assert.equal(sort.mode,'explore');assert.equal(new Set(order).size,300);
  assert.deepEqual([...order].sort(),ids(catalog).sort());assert.notDeepEqual(order,ids(catalog));
  assert.notDeepEqual(ids(create(catalog,{seed:456}).order(catalog)),order);
  assert.deepEqual(ids(sort.order(catalog)),order);
  const water=catalog.filter(d=>d.water);
  assert.deepEqual(ids(sort.order(water)),order.filter(id=>water.some(d=>d.id===id)));
  const pages=[0,20,40].flatMap(start=>ids(sort.order(catalog).slice(start,start+20)));
  assert.deepEqual(pages,order.slice(0,60));
  sort.set('price-desc');sort.order(water);sort.set('explore');
  assert.deepEqual(ids(sort.order(catalog)),order);assert.equal(JSON.stringify(catalog),before);
});

test('price and per-m² sorting compares both currencies fairly, with stable ties after currency changes',()=>{
  const items=[{id:'usd',currency:'USD',price:100000,area:1000},{id:'crc',currency:'CRC',price:50000000,area:1000},{id:'cheap',currency:'CRC',price:25000000,area:200},{id:'large',currency:'USD',price:150000,area:6000}];
  const sort=create(items);
  for(const [mode,first,last] of [['price-asc','cheap','large'],['price-desc','large','cheap'],['unit-asc','large','cheap'],['area-desc','large','cheap']]){
    assert.equal(sort.set(mode),true);const order=ids(sort.order(items,'USD'));
    assert.equal(order[0],first);assert.equal(order.at(-1),last);
    assert.deepEqual(ids(sort.order(items,'CRC')),order);
  }
});

test('the tab session keeps its order and chosen sort across reloads and rejects corrupt state',()=>{
  const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(k,v)=>values.set(k,v)};
  const first=create(catalog,{storage});const order=ids(first.order(catalog));first.set('unit-asc');
  const second=create(catalog,{storage});assert.equal(second.mode,'unit-asc');
  second.set('explore');assert.deepEqual(ids(second.order(catalog)),order);
  values.set('arenalindex.browse-order.mode','invalid');values.set('arenalindex.browse-order.seed','NaN');
  const repaired=create(catalog,{storage});assert.equal(repaired.mode,'explore');assert.equal(repaired.order(catalog).length,300);
  assert.match(values.get('arenalindex.browse-order.seed'),/^\d+$/);
  const blocked=create(catalog,{storage:{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}}});
  assert.equal(blocked.order(catalog).length,300);assert.equal(blocked.set('area-desc'),true);
});

test('unavailable conversion cannot compare USD amounts directly with CRC amounts',()=>{
  const sort=create(catalog,{seed:12},null),original=ids(sort.order(catalog));
  for(const mode of ['price-asc','price-desc','unit-asc','unknown']){assert.equal(sort.available(mode),false);assert.equal(sort.set(mode),false);}
  assert.equal(sort.mode,'explore');assert.deepEqual(ids(sort.order(catalog)),original);
  assert.equal(sort.set('area-desc'),true);const sorted=sort.order(catalog);assert.ok(sorted.every((d,i)=>i===0||sorted[i-1].area>=d.area));
});

test('group sorting, focused properties, and paginated rendering use the same list without changing map results',()=>{
  const html=fs.readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
  const source=html.match(/ function listingResults\(\)\{[^\n]+/)[0];
  const group=catalog.slice(0,45),sort=create(catalog);sort.set('price-asc');
  const context={results:()=>catalog,selectedGroup:ids(group),selected:group[20].id,listingSort:sort,filters:{currency:'CRC'}};
  vm.createContext(context);vm.runInContext(source,context);
  const expected=ids(context.listingResults());assert.equal(expected.length,45);assert.equal(expected[0],group[20].id);
  assert.deepEqual(ids(catalog).slice(0,3),['lot-0','lot-1','lot-2']);
  context.selected=null;const unselected=ids(context.listingResults());assert.equal(unselected[0],'lot-0');
  assert.equal(new Set(unselected).size,45);
});
