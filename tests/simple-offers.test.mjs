import test from 'node:test';
import assert from 'node:assert/strict';
import {portalFixture,hash} from './portal-fixture.mjs';
import {offerToken} from '../server/offers/links.mjs';
import {blankSimpleOffer,simpleNoticeVersion} from '../site/offer/model.mjs';
const valid=name=>({...blankSimpleOffer('USD'),name,contact:name.toLowerCase()+'@example.test',amount:'150000'});
async function setup(){
  const e=portalFixture(),admin=await e.adminSession();await e.register('broker-a',admin);await e.register('broker-b',admin);const a=(await e.login('broker-a')).body.token,b=(await e.login('broker-b')).body.token,subject=e.auth.get('owner-session/'+hash(a)).subject;
  e.repository.ensureOfferIndex=async()=>{};e.repository.ownerOffers=async()=>({records:[...e.portal].filter(([k])=>k.startsWith('offers/')).map(([,v])=>structuredClone(v)),cursor:null});
  e.rows.set('property-test-001',{id:'property-test-001',owner_subject:subject,status:'approved',payload:{private:'SECRET-DOCUMENT'},publication:{listing:{id:'ai-public',name:'Lake house',place:'La Fortuna',price:180000,currency:'USD',area:1400,is_demo:false}}});
  const form=await e.call('offer_form',{propertyId:'property-test-001'},a);assert.equal(form.status,200,JSON.stringify(form.body));const token=new URL(form.body.url).hash.slice(1);
  const open=()=>e.call('offer_form_open',{token}),opened=(await open()).body;
  const send=(name='Alice',overrides={})=>e.call('offer_form_submit',{token,offer:valid(name),submissionId:name==='Alice'?'a'.repeat(32):'b'.repeat(32),language:'en',noticeVersion:simpleNoticeVersion,propertyVersion:opened.propertyVersion,confirmed:true,...overrides});
  return {...e,a,b,subject,form:form.body,token,open,opened,send};
}
test('one stable form per listing requires account ownership and returns only current public property data',async()=>{
  const e=await setup();const again=await e.call('offer_form',{propertyId:'property-test-001'},e.a);assert.equal(again.body.url,e.form.url);
  assert.equal([...e.portal.keys()].filter(k=>k.startsWith('offer-forms/')).length,1);assert.equal([...e.portal.keys()].filter(k=>k.startsWith('offers/')).length,0);
  assert.equal((await e.call('offer_form',{propertyId:'property-test-001'},e.b)).status,404);assert.equal((await e.call('offer_form',{propertyId:'property-test-001'})).status,401);
  assert.doesNotMatch(JSON.stringify(e.opened),/SECRET|ownerSubject|sourceId|email|versions|receipt/i);
  e.rows.get('property-test-001').publication.listing.price=190000;assert.equal((await e.open()).body.property.price,190000);assert.equal((await e.call('offer_form',{propertyId:'property-test-001'},e.a)).body.url,e.form.url);
});
test('two buyers use one link but get separate offers and private receipts; shared link never reveals submissions',async()=>{
  const e=await setup(),alice=await e.send(),bob=await e.send('Bob');assert.equal(alice.status,200);assert.equal(bob.status,200);assert.notEqual(alice.body.id,bob.body.id);assert.notEqual(alice.body.receiptURL,bob.body.receiptURL);
  const publicPage=await e.open();assert.deepEqual(Object.keys(publicPage.body).sort(),['broker','property','propertyVersion']);assert.doesNotMatch(JSON.stringify(publicPage.body),/Alice|Bob|example.test|receipt/);
  const receiptToken=new URL(alice.body.receiptURL).hash.slice(1),copy=await e.call('offer_receipt',{token:receiptToken});assert.equal(copy.status,200);assert.equal(copy.body.versions[0].offer.name,'Alice');assert.doesNotMatch(JSON.stringify(copy.body),/Bob/);
  assert.equal((await e.call('offer_receipt',{token:e.token})).status,404);assert.equal((await e.call('offer_form_open',{token:receiptToken})).status,404);
  assert.equal((await e.call('offers_list',{},e.a)).body.records.length,2);assert.deepEqual((await e.call('offers_list',{},e.b)).body.records,[]);
  const latest=alice.body.versions[0];assert.equal(latest.validUntil,null);assert.equal('funding' in latest.offer,false);assert.equal('deposit' in latest.offer,false);assert.equal(latest.noticeVersion,simpleNoticeVersion);assert.equal(e.emails.length,0);
});
test('retries, including simultaneous retries, save exactly one receipt and never silently replace an earlier offer',async()=>{
  const e=await setup(),results=await Promise.all([e.send(),e.send()]);assert.ok(results.every(r=>r.status===200));assert.equal(results[0].body.id,results[1].body.id);assert.equal((await e.call('offers_list',{},e.a)).body.records.length,1);
  const changed=await e.send('Alice',{offer:{...valid('Alice'),amount:'170000'}});assert.equal(changed.status,200);assert.equal(changed.body.alreadySent,true);assert.equal(changed.body.versions[0].offer.amount,'150000');
});
test('short form validates contact and amount, requires reviewed terms, and rejects stale property details',async()=>{
  const e=await setup();
  for(const offer of [{...valid('Alice'),contact:'not contact'},{...valid('Alice'),contact:'1234'},{...valid('Alice'),amount:'0'},{...valid('Alice'),amount:'1e6'},{...valid('Alice'),name:''},{...valid('Alice'),message:'x'.repeat(2001)}])assert.equal((await e.send('Alice',{offer})).status,422);
  assert.equal((await e.send('Alice',{confirmed:false})).status,422);assert.equal((await e.send('Alice',{noticeVersion:'wrong'})).status,422);
  e.rows.get('property-test-001').publication.listing.price=200000;assert.equal((await e.send()).status,409);
  const current=(await e.open()).body;assert.equal((await e.send('Alice',{propertyVersion:current.propertyVersion,offer:{...valid('Alice'),contact:'+506 8888-7777'}})).status,200);
});
test('withdrawal and suspension stop shared forms; receipts are independent and revoking one never exposes another',async()=>{
  const e=await setup(),a=await e.send(),b=await e.send('Bob'),tokenA=new URL(a.body.receiptURL).hash.slice(1),tokenB=new URL(b.body.receiptURL).hash.slice(1);
  e.rows.get('property-test-001').publication=null;assert.equal((await e.open()).status,404);assert.equal((await e.send('New',{submissionId:'f'.repeat(32)})).status,404);assert.equal((await e.call('offer_receipt',{token:tokenA})).status,200);
  assert.equal((await e.call('offer_revoke',{id:a.body.id,revision:1},e.a)).status,200);assert.equal((await e.call('offer_receipt',{token:tokenA})).status,404);assert.equal((await e.call('offer_receipt',{token:tokenB})).status,200);
  e.portal.get('accounts/'+hash(e.subject)).active=false;assert.equal((await e.call('offer_receipt',{token:tokenB})).status,404);
});
test('earlier buyer-specific links accept the reduced form and keep old submissions intact',async()=>{
  const e=await setup(),legacy=await e.call('offer_create',{propertyId:'property-test-001',label:'Old test',requestId:'d'.repeat(64)},e.a),token=new URL(legacy.body.url).hash.slice(1);
  const result=await e.call('offer_submit',{token,offer:valid('Alice'),revision:0,submissionId:'a'.repeat(32),confirmed:true,language:'en',noticeVersion:simpleNoticeVersion});assert.equal(result.status,200);assert.equal(result.body.versions[0].offer.schema,2);assert.equal(result.body.versions[0].validUntil,null);
});
test('offer welcome exposes only published gallery images and the public WhatsApp contact',async()=>{
  const e=await setup(),row=e.rows.get('property-test-001');row.publication.listing.images=['/photos/lot.jpg','/photos/garden-volcano.jpg'];row.publication.listing.details={contact:{name:'Public Broker',whatsapp:'50688887777',email:'public@example.test'},privateNotes:'SECRET'};row.payload.images=['PRIVATE-DOCUMENT'];
  const opened=(await e.open()).body;assert.equal(opened.property.images.length,2);assert.equal(opened.property.contact.whatsapp,'50688887777');assert.equal(opened.property.contact.name,'Public Broker');assert.doesNotMatch(JSON.stringify(opened),/SECRET|PRIVATE|public@example/);
});
test('reply preference is saved explicitly and cannot disagree with the submitted contact',async()=>{
  const e=await setup();for(const patch of [{replyMethod:'email',contact:'+50688887777'},{replyMethod:'whatsapp',contact:'buyer@example.test'},{replyMethod:'sms',contact:'+50688887777'}])assert.equal((await e.send('Alice',{offer:{...valid('Alice'),...patch}})).status,422);
  const sent=await e.send('Alice',{offer:{...valid('Alice'),replyMethod:'whatsapp',contact:'+50688887777',email:'UNSELECTED-CONTACT'}});assert.equal(sent.status,200);assert.equal(sent.body.versions[0].offer.replyMethod,'whatsapp');assert.doesNotMatch(JSON.stringify(sent.body),/UNSELECTED/);
});

test('broker links are short and stable; earlier long links reach the same form and receipt on retry',async()=>{
  const e=await setup();assert.match(e.token,/^l\.[A-Za-z0-9_-]{22}$/);assert.equal(e.form.url.length,55);
  const form=[...e.portal].find(([key])=>key.startsWith('offer-forms/'))[1],legacy=offerToken('listing',form.id,e.options.config);
  const oldOpened=await e.call('offer_form_open',{token:legacy});assert.equal(oldOpened.status,200);assert.deepEqual(oldOpened.body,e.opened);
  const first=await e.send('Alice',{token:legacy}),retry=await e.send();assert.equal(first.status,200);assert.equal(retry.status,200);assert.equal(first.body.receiptURL,retry.body.receiptURL);
  const alias=[...e.portal].find(([key])=>key.startsWith('offer-links/'))[1];assert.deepEqual(alias,{kind:'listing',id:form.id});
  const concurrent=await Promise.all([1,2].map(()=>e.call('offer_form',{propertyId:'property-test-001'},e.a)));assert.ok(concurrent.every(r=>r.body.url===e.form.url));
});
test('unknown, altered and wrong-purpose short links cannot reveal any offer data',async()=>{
  const e=await setup();await e.send();
  for(const token of ['l.'+'a'.repeat(22),e.token.slice(0,-1)+(e.token.endsWith('A')?'Q':'A'),e.token+'.extra',e.token.replace('l.','r.'),'l.']){
    const response=await e.call('offer_form_open',{token});assert.equal(response.status,404);assert.doesNotMatch(JSON.stringify(response.body),/Alice|example.test|Lake house/);
  }
  assert.equal((await e.call('offer_receipt',{token:e.token})).status,404);
  e.options.config.reviewSecret='y'.repeat(64);assert.equal((await e.open()).status,404);
});
