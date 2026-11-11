import test from 'node:test';
import assert from 'node:assert/strict';
import {portalFixture,hash} from './portal-fixture.mjs';
import {createOwnerHandler} from '../server/portal/core.mjs';
import {blankOffer,validateOffer,noticeVersion} from '../site/offer/model.mjs';
const valid=()=>({...blankOffer('USD'),name:'Test Buyer',email:'buyer@example.test',amount:'150000',funding:'cash',depositMode:'discuss',closing:'60',conditions:['inspection','legal'],message:'Subject to discussion'});
async function setup(){
  const e=portalFixture(),admin=await e.adminSession();await e.register('broker-a',admin);await e.register('broker-b',admin);
  const a=(await e.login('broker-a')).body.token,b=(await e.login('broker-b')).body.token,subject=e.auth.get('owner-session/'+hash(a)).subject;
  e.repository.ensureOfferIndex=async()=>{};
  e.repository.ownerOffers=async()=>({records:[...e.portal].filter(([k])=>k.startsWith('offers/')).map(([,v])=>structuredClone(v)),cursor:null});
  const listing={id:'ai-test-public',name:'Lake property',place:'La Fortuna',currency:'USD',price:180000,area:1400,is_demo:false,images:['/photos/lot.jpg'],details:{translations:{en:{title:'Lake home'}}}};
  e.rows.set('property-test-001',{id:'property-test-001',owner_subject:subject,status:'approved',payload:{private:'PRIVATE-NOTES'},publication:{listing}});
  const invite=await e.call('offer_create',{propertyId:'property-test-001',label:'PRIVATE-LABEL',requestId:'a'.repeat(64)},a);
  assert.equal(invite.status,200,JSON.stringify(invite.body));const token=new URL(invite.body.url).hash.slice(1);
  const send=(body={})=>e.call('offer_submit',{token,offer:valid(),revision:0,submissionId:'c'.repeat(32),language:'en',noticeVersion,confirmed:true,...body});
  return {...e,a,b,subject,invite:invite.body,token,send};
}
test('invitation creation uses owned published snapshots, is retry-safe, and public links exclude account/private fields',async()=>{
  const e=await setup();
  assert.equal((await e.call('offer_create',{propertyId:'property-test-001',label:'',requestId:'b'.repeat(64)},e.b)).status,404);
  assert.equal((await e.call('offer_create',{propertyId:'property-test-001',label:'',requestId:'b'.repeat(64)})).status,401);
  const again=await e.call('offer_create',{propertyId:'property-test-001',label:'same',requestId:'a'.repeat(64)},e.a);assert.equal(again.body.url,e.invite.url);
  const opened=await e.call('offer_open',{token:e.token});assert.equal(opened.status,200);assert.equal(opened.body.property.price,180000);
  assert.doesNotMatch(JSON.stringify(opened.body),/PRIVATE-|broker-a@gmail|ownerSubject|sourceId|password/);
  const other=await e.call('offers_list',{},e.b);assert.deepEqual(other.body.records,[]);
  assert.equal((await e.call('offers_list',{},e.a)).body.records.length,1);
  e.rows.get('property-test-001').publication=null;
  assert.equal((await e.call('offer_create',{propertyId:'property-test-001',label:'',requestId:'b'.repeat(64)},e.a)).status,404);
});
test('confirmed proposals retain exact notice and immutable versions; retries do not duplicate and stale submissions conflict',async()=>{
  const e=await setup();assert.equal((await e.send({confirmed:false})).status,422);assert.equal((await e.send({noticeVersion:'old'})).status,422);
  const sent=await e.send();assert.equal(sent.status,200);assert.equal(sent.body.revision,1);assert.match(sent.body.versions[0].notice,/not a purchase agreement/);
  assert.equal(sent.body.versions[0].offer.deposit,'');assert.equal(sent.body.versions[0].validUntil,'2026-11-16T12:00:00.000Z');
  assert.equal((await e.send()).body.revision,1);
  assert.equal((await e.send({submissionId:'d'.repeat(32)})).status,409);
  const revised=await e.send({revision:1,submissionId:'e'.repeat(32),offer:{...valid(),amount:'155000'}});assert.equal(revised.status,200);assert.equal(revised.body.versions.length,2);
  assert.equal(revised.body.versions[0].offer.amount,'150000');assert.equal(revised.body.versions[1].offer.amount,'155000');
  assert.equal((await e.call('offer_reviewed',{id:e.invite.id,revision:1},e.a)).status,409);
  assert.equal((await e.call('offer_reviewed',{id:e.invite.id,revision:2},e.b)).status,404);
  assert.equal((await e.call('offer_reviewed',{id:e.invite.id,revision:2},e.a)).status,200);
  assert.equal((await e.call('offers_list',{},e.a)).body.records[0].reviewedRevision,2);assert.equal(e.emails.length,0);
});
test('invalid financial terms, contact fields, enum values and forged tokens are rejected',async()=>{
  const e=await setup();
  for(const patch of [{amount:'0'},{amount:'-1'},{amount:'1e6'},{amount:'NaN'},{amount:'1,000'},{currency:'EUR'},{funding:''},{closing:'yesterday'},{validity:'999'},{email:'bad'},{depositMode:'amount',deposit:'200000'},{conditions:['made-up']},{conditions:['inspection','inspection']},{message:'x'.repeat(2001)}]){
    assert.ok(Object.keys(validateOffer({...valid(),...patch})).length);assert.equal((await e.send({offer:{...valid(),...patch}})).status,422,JSON.stringify(patch));
  }
  for(const token of ['','x'.repeat(129),'a'.repeat(64)+'.'+'b'.repeat(64),e.token.slice(0,-1)+(e.token.endsWith('a')?'b':'a')])assert.equal((await e.call('offer_open',{token})).status,404);
  assert.equal((await e.call('offer_open',{token:e.token},null,'owner',{Origin:'https://evil.example'})).status,403);
});
test('revocation, account suspension, expired links and withdrawn listings prevent new proposals',async()=>{
  const e=await setup();await e.send();
  e.rows.get('property-test-001').publication=null;assert.equal((await e.send({revision:1,submissionId:'d'.repeat(32)})).status,404);
  e.portal.get('accounts/'+hash(e.subject)).active=false;assert.equal((await e.call('offer_open',{token:e.token})).status,410);e.portal.get('accounts/'+hash(e.subject)).active=true;
  assert.equal((await e.call('offer_revoke',{id:e.invite.id,revision:1},e.b)).status,404);
  assert.equal((await e.call('offer_revoke',{id:e.invite.id,revision:1},e.a)).status,200);assert.equal((await e.call('offer_open',{token:e.token})).status,410);
  assert.equal((await e.call('offers_list',{},e.a)).body.records[0].versions.length,1);
  const f=await setup();await f.send();f.advance(31*86400000);assert.equal((await f.call('offer_open',{token:f.token})).body.expired,true);assert.equal((await f.send({revision:1,submissionId:'d'.repeat(32)})).status,410);
});
test('simultaneous submissions cannot replace one another and rate limits fail closed',async()=>{
  const e=await setup();const results=await Promise.all([e.send(),e.send({submissionId:'d'.repeat(32),offer:{...valid(),amount:'151000'}})]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  e.repository.allow=async()=>false;assert.equal((await e.call('offer_open',{token:e.token})).status,429);
});
test('assigned demo invitations remain visibly fictional and unassigned demos cannot be used',async()=>{
  const e=await setup();const demo={id:'lot-107',name:'Demo house',currency:'CRC',price:70000000,area:1000,is_demo:true};
  const catalog={published:async subject=>subject===e.subject?[demo]:[]};const handler=createOwnerHandler({...e.options,catalog});
  const call=async token=>handler(new Request('https://api.example/owner',{method:'POST',headers:{Authorization:'Bearer '+token},body:JSON.stringify({action:'offer_create',propertyId:'lot-107',label:'',requestId:'f'.repeat(64)})}));
  const response=await call(e.a);assert.equal(response.status,200);assert.equal((await response.json()).property.isDemo,true);assert.equal((await call(e.b)).status,404);
});
