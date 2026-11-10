import test from 'node:test';
import assert from 'node:assert/strict';
import {portalFixture,hash} from './portal-fixture.mjs';
import {currentRules,rulesHash} from '../server/portal/listing-rules.mjs';
const consent={accepted:true,version:currentRules.version,contentHash:rulesHash,language:'en'};
async function setup(){const e=portalFixture({acceptRules:false}),admin=await e.adminSession();await e.register('owner-a',admin);const signed=await e.login('owner-a'),token=signed.body.token,subject=e.auth.get('owner-session/'+hash(token)).subject;return {...e,admin,signed,token,subject,account:()=>e.portal.get('accounts/'+hash(subject))};}

test('Google and password sessions require rules acceptance before any listing operation',async()=>{
  const e=await setup();assert.equal(e.signed.body.requiresRulesAcceptance,true);assert.deepEqual(e.signed.body.listingRules,currentRules);
  await e.call('set_owner_password',{email:'owner-a@gmail.com',password:'Temporary password 19'},e.admin,'admin');
  const password=await e.call('login_password',{email:'owner-a@gmail.com',password:'Temporary password 19'});
  assert.equal(password.body.requiresRulesAcceptance,true);
  await e.call('change_password',{password:'A new personal password 29'},password.body.token);
  for(const token of [e.token,password.body.token])for(const action of ['list','health','workspace_open','workspace_claim','workspace_save_prepare','workspace_save_commit','workspace_submit','workspace_status','workspace_reopen','workspace_unlist']){
    const result=await e.call(action,{id:'some-listing'},token);assert.equal(result.status,403,action);assert.equal(result.body.code,'listing_rules_required');
  }
  assert.equal(e.account().rulesAcceptances,undefined);assert.equal(e.rows.size,0);
});

test('acceptance is explicit, authenticated, versioned, and bound to the verified identity',async()=>{
  const e=await setup();assert.equal((await e.call('accept_listing_rules',consent)).status,401);
  for(const body of [{...consent,accepted:false},{...consent,accepted:'true'},{...consent,version:'old'},{...consent,contentHash:'0'.repeat(64)},{...consent,language:'fr'}]){
    assert.ok([409,422].includes((await e.call('accept_listing_rules',body,e.token)).status));assert.equal(e.account().rulesAcceptances,undefined);
  }
  const accepted=await e.call('accept_listing_rules',{...consent,email:'someone-else@example.com',subject:'someone-else',acceptedAt:'2000-01-01'},e.token);
  assert.equal(accepted.status,200);const receipt=accepted.body.receipt;
  assert.equal(receipt.email,'owner-a@gmail.com');assert.equal(receipt.subject,e.subject);assert.equal(receipt.method,'google');assert.equal(receipt.language,'en');assert.equal(receipt.acceptedAt,e.options.now().toISOString());assert.equal(receipt.version,currentRules.version);assert.equal(receipt.contentHash,rulesHash);assert.equal(receipt.rules.clauses.length,6);
  assert.equal((await e.call('session',{},e.token)).body.requiresRulesAcceptance,false);assert.equal((await e.call('list',{},e.token)).status,200);assert.equal(e.emails.length,0);assert.equal(e.rows.size,0);
});

test('retries and concurrent acceptance preserve the original durable receipt',async()=>{
  const e=await setup(),results=await Promise.all([e.call('accept_listing_rules',consent,e.token),e.call('accept_listing_rules',consent,e.token)]);
  assert.ok(results.every(r=>r.status===200));assert.deepEqual(results[0].body.receipt,results[1].body.receipt);
  e.advance(60000);const again=await e.call('accept_listing_rules',{...consent,language:'es'},e.token);
  assert.deepEqual(again.body.receipt,results[0].body.receipt);assert.equal(e.account().rulesRevision,1);
});

test('old acceptances and existing sessions cannot bypass current rules; prior receipts are retained',async()=>{
  const e=await setup(),old={version:'old',acceptedAt:'2026-01-01T00:00:00Z'};
  e.account().rulesAcceptances={old};e.account().rulesRevision=1;
  assert.equal((await e.call('session',{},e.token)).body.requiresRulesAcceptance,true);assert.equal((await e.call('list',{},e.token)).status,403);
  await e.accept(e.token);assert.deepEqual(e.account().rulesAcceptances.old,old);assert.ok(e.account().rulesAcceptances[rulesHash]);
  assert.equal((await e.login('owner-a')).body.requiresRulesAcceptance,false);
});

test('acceptance is isolated by account and admin sees version, date and language without private receipt payloads',async()=>{
  const e=await setup();await e.register('owner-b',e.admin);const b=await e.login('owner-b');await e.accept(e.token);
  assert.equal((await e.call('session',{},b.body.token)).body.requiresRulesAcceptance,true);
  const rows=(await e.call('owner_accounts',{},e.admin,'admin')).body.accounts;
  const a=rows.find(r=>r.email==='owner-a@gmail.com');assert.equal(a.rulesAccepted,true);assert.equal(a.rulesAcceptance.version,currentRules.version);assert.equal(a.rulesAcceptance.acceptedAt,e.options.now().toISOString());assert.equal(a.rulesAcceptance.language,'en');
  assert.equal(rows.find(r=>r.email==='owner-b@gmail.com').rulesAccepted,false);assert.doesNotMatch(JSON.stringify(rows),/contentHash|rulesAcceptances|clauses/);
});

test('failed persistence and suspension cannot create acceptance or open listings',async()=>{
  const e=await setup(),update=e.repository.portalUpdate;
  e.repository.portalUpdate=async()=>{throw Error('storage unavailable');};
  assert.equal((await e.call('accept_listing_rules',consent,e.token)).status,500);assert.equal((await e.call('list',{},e.token)).status,403);
  e.repository.portalUpdate=update;
  await e.call('set_owner_active',{id:hash(e.subject),active:false},e.admin,'admin');
  assert.equal((await e.call('accept_listing_rules',consent,e.token)).status,401);assert.equal(e.account().rulesAcceptances,undefined);
});

test('an account revoked during acceptance cannot gain a receipt',async()=>{
  const e=await setup(),update=e.repository.portalUpdate;
  e.repository.portalUpdate=async(...args)=>{e.account().active=false;return update(...args);};
  assert.equal((await e.call('accept_listing_rules',consent,e.token)).status,409);assert.equal(e.account().rulesAcceptances,undefined);
});
