import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createAnalyticsHandler,recordInventory,analyticsReport,dateRange,dayOf,photoPath,summarize} from '../server/analytics/core.mjs';
import {createAdminHandler} from '../server/admin/core.mjs';
import {createPublicHandler} from '../server/intake/public.mjs';
import {memoryRepository,batch,listings,now} from './analytics-fixture.mjs';
function environment(){
  const fixture=memoryRepository(),config={rateSalt:'private-salt-'.repeat(4)};
  const handler=createAnalyticsHandler({repository:fixture.repository,config,now:()=>now});
  const call=(body=batch(),headers={},method='POST')=>handler(new Request('https://backend.example/api/analytics',{method,headers:{Origin:'https://arenalindex.com',...headers},...(['GET','OPTIONS'].includes(method)?{}:{body:typeof body==='string'?body:JSON.stringify(body)})}));
  return {...fixture,config,call};
}
test('retrying or concurrently sending a batch counts once and stores only whitelisted anonymous fields',async()=>{
  const e=environment();
  const input={...batch(),email:'PRIVATE-EMAIL',url:'https://example.com/?token=PRIVATE-TOKEN'};
  const results=await Promise.all([1,2,3].map(()=>e.call(input,{'x-forwarded-for':'203.0.113.17'})));
  assert.ok(results.every(response=>response.status===200));
  const stored=await e.repository.analyticsBatches(['2026-11-10']);assert.equal(stored.length,1);
  assert.equal(stored[0].referrer,'www.google.com');assert.notEqual(stored[0].visitor,input.visitor);
  assert.doesNotMatch(JSON.stringify([...e.rows]),/PRIVATE|203\.0\.113\.17|search\?q|private-salt/);
  assert.equal(e.puts.find(put=>put.path.includes('/batches/')).options.ttlDays,90);
  assert.equal(e.puts.find(put=>put.path.includes('/batches/')).options.access,'private');
});
test('collection rejects invalid origins, oversized bodies, arbitrary events, invalid photos and timestamps',async()=>{
  const e=environment();
  assert.equal((await e.call(batch(),{Origin:'https://attacker.example'})).status,403);
  assert.equal((await e.call(batch(),{Origin:''})).status,403);
  assert.equal((await e.call({}, {},'GET')).status,405);
  assert.equal((await e.call('x'.repeat(32769))).status,413);
  assert.equal((await e.call('not json')).status,400);
  for(const changes of [{activeMs:Infinity},{clicks:-1},{visit:'bad'},{events:[{type:'email',at:now.toISOString()}]},{sentAt:'2020-01-01'},{saved:['../secret']},{events:[{type:'photo_open',listingId:'real-property',photo:'https://example.com/?token=secret',at:now.toISOString()}]}])assert.equal((await e.call(batch(changes))).status,400);
  assert.equal((await e.repository.analyticsBatches(['2026-11-10'])).length,0);
  const preflight=await e.call({}, {},'OPTIONS');assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),'https://arenalindex.com');
});
test('privacy preferences, simple bots and rate limits do not inflate metrics',async()=>{
  const e=environment();
  for(const headers of [{DNT:'1'},{'Sec-GPC':'1'},{'user-agent':'Example crawler'}])assert.equal((await (await e.call(batch(),headers)).json()).accepted,false);
  assert.equal((await e.repository.analyticsBatches(['2026-11-10'])).length,0);
  e.repository.allow=async()=>false;assert.equal((await e.call()).status,429);
});
test('inventory uses actual public rows, preserves historical counts and never fills missing days',async()=>{
  const {repository}=memoryRepository();
  await recordInventory(repository,listings,new Date('2026-11-08T20:00:00Z'));
  await recordInventory(repository,[listings[1]],now);
  await recordInventory(repository,listings,new Date('2026-11-10T18:00:00Z'));
  const history=await repository.analyticsInventory();assert.deepEqual(history.map(row=>[row.day,row.real,row.demo]),[['2026-11-08',1,1],['2026-11-10',0,1]]);
  const report=summarize({batches:[],inventory:history,startedAt:null,range:dateRange({},now)});
  assert.equal(report.inventory.length,2);assert.equal(report.inventory.at(-1).real,0);assert.equal(report.total.visits,0);
  assert.equal(dayOf('2026-11-11T03:00:00Z'),'2026-11-10');
});
test('a withdrawn listing retains its canonical labels for earlier interactions that day',async()=>{
  const {repository}=memoryRepository();await recordInventory(repository,listings,new Date('2026-11-10T19:00:00Z'));await recordInventory(repository,[listings[1]],now);
  const snapshot=(await repository.analyticsInventory())[0];assert.equal(snapshot.real,0);assert.ok(snapshot.properties.some(row=>row.id==='real-property'));
});
test('report separates demos, events and latest observed saved state across visits and browsers',async()=>{
  const e=environment();await e.call();
  await e.call(batch({id:'d'.repeat(32),sentAt:'2026-11-10T20:00:10Z',saved:[],events:[{type:'remove_save',listingId:'real-property',at:'2026-11-10T20:00:05Z'},{type:'listing_view',listingId:'lot-101',at:'2026-11-10T20:00:05Z'}],activeMs:10000,clicks:2}));
  await e.call(batch({id:'e'.repeat(32),visitor:'f'.repeat(32),visit:'1'.repeat(32)}));
  e.repository.published=async()=>[listings[0]];const catalog={published:async()=>[listings[1]]};
  const report=await analyticsReport({repository:e.repository,catalog,body:{kind:'real'},now});
  assert.equal(report.total.visits,2);assert.equal(report.total.visitors,2);assert.equal(report.total.views,2);assert.equal(report.total.photoOpens,2);assert.equal(report.total.contacts,2);
  assert.equal(report.total.saves,2);assert.equal(report.total.removals,1);assert.equal(report.total.observedSaved,1);assert.equal(report.total.uniqueSaved,1);assert.equal(report.total.activeMs,100000);
  assert.equal(report.properties.length,1);assert.equal(report.places[0].name,'La Fortuna');assert.equal(report.photos[0].opens,2);assert.equal(report.visits[0].events.some(event=>event.name==='Jardín de demostración'),false);
  assert.equal(report.total.contactVisitRate,1);assert.equal(report.daily.at(-1).visits,2);
  const all=await analyticsReport({repository:e.repository,catalog,body:{},now});assert.equal(all.total.views,3);assert.equal(all.inventory.at(-1).real,1);
});
test('only an authenticated allowlisted administrator can read analytics',async()=>{
  const {repository}=memoryRepository(),token='a'.repeat(64),hash=createHash('sha256').update(token).digest('hex');
  repository.published=async()=>[listings[0]];
  const handler=createAdminHandler({repository,catalog:{published:async()=>[listings[1]]},config:{googleClientId:'client',adminEmails:['admin@example.com']},now:()=>now});
  const request=auth=>handler(new Request('https://example.com/admin',{method:'POST',headers:{...(auth?{Authorization:'Bearer '+auth}:{})},body:JSON.stringify({action:'analytics'})}));
  assert.equal((await request()).status,401);assert.equal((await request(token)).status,401);
  await repository.authCreate('session',hash,{email:'admin@example.com',expiresAt:now.getTime()+3600000,revoked:false});
  const response=await request(token);assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal((await response.json()).inventory[0].real,1);
  await repository.authUpdate('session',hash,{revoked:false},{revoked:true});assert.equal((await request(token)).status,401);
});
test('date bounds, pagination and image URLs remain bounded and safe',()=>{
  for(const body of [{start:'2026-02-30'},{start:'2025-01-01'},{end:'2027-01-01'},{start:'2026-11-10',end:'2026-11-09'}])assert.throws(()=>dateRange(body,now));
  assert.equal(photoPath('javascript:alert(1)'),null);assert.equal(photoPath('/photos/../secret'),null);
  assert.equal(photoPath('https://arenalindex-intake.vercel.app/api/listings?id=property-1&photo=photo-1&version=2&token=secret'),'https://arenalindex-intake.vercel.app/api/listings?id=property-1&photo=photo-1&version=2');
  const report=summarize({batches:Array.from({length:28},(_,i)=>batch({visit:String(i),visitor:String(i)})),inventory:[],range:dateRange({},now),page:1});
  assert.equal(report.pages,2);assert.equal(report.visits.length,3);assert.ok(report.visits.every(visit=>!('visitor' in visit)));
});
test('analytics storage failure never makes the public catalog unavailable',async()=>{
  const repository={published:async()=>[listings[0]],analyticsSnapshot:async()=>{throw Error('Offline');}};
  const handler=createPublicHandler(repository,{catalog:{published:async()=>[listings[1]]}});
  const response=await handler(new Request('https://example.com/api/listings?catalog=1'));assert.equal(response.status,200);assert.equal((await response.json()).length,2);
});
test('production can defer inventory writes until after the catalog response',async()=>{
  let finish,work;
  const repository={published:async()=>[listings[0]],analyticsSnapshot:()=>new Promise(resolve=>{finish=resolve;})};
  const handler=createPublicHandler(repository,{catalog:{published:async()=>[listings[1]]},defer:promise=>{work=promise;}});
  const response=await handler(new Request('https://example.com/api/listings?catalog=1'));
  assert.equal(response.status,200);assert.ok(work);assert.equal((await response.json())[0].id,'real-property');finish();await work;
});
