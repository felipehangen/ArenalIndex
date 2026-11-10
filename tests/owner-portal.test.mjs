import test from 'node:test';
import assert from 'node:assert/strict';
import {portalFixture,hash} from './portal-fixture.mjs';
import {completeDraft} from './intake-fixtures.mjs';
import {approvedRow,editorial} from './publication-fixture.mjs';
import {newDraft} from '../site/newlisting/model.mjs';
import {createPublication} from '../server/intake/publication.mjs';
async function setup(){const e=portalFixture(),invitation=await e.invite(),a=await e.login('owner-a',invitation.code),b=await e.login('owner-b',invitation.code);assert.equal(a.status,200);assert.equal(b.status,200);return {...e,...invitation,a:a.body.token,b:b.body.token};}
async function save(e,payload,token=e.a,revision=0,version=0,reuse=[]){const prepared=await e.call('workspace_save_prepare',{draft:payload,editRevision:revision,version,reuse},token);assert.equal(prepared.status,200,JSON.stringify(prepared.body));e.upload(prepared.body,payload);return e.call('workspace_save_commit',{id:payload.id,transaction:prepared.body.transaction},token);}
test('reusable invitations activate separate Google accounts; revoking a code blocks new accounts, not existing owners',async()=>{
  const e=await setup();assert.doesNotMatch(JSON.stringify([...e.portal]),new RegExp(e.code));
  assert.equal((await e.login('unknown','bad')).status,403);
  assert.equal((await e.call('revoke_invitation',{id:e.id},e.admin,'admin')).status,200);
  assert.equal((await e.login('new-owner',e.code)).status,403);
  assert.equal((await e.login('owner-a')).status,200);
  assert.equal((await e.call('list',{},e.admin)).status,401);assert.equal((await e.call('list',{},e.a,'admin')).status,401);
  for(const action of ['create_invitation','revoke_invitation','approve','publish','review','workspace_reopen_owner'])assert.equal((await e.call(action,{},e.a)).status,400);
});
test('incomplete cloud drafts are isolated by account, and a second user cannot read, overwrite, submit or unlist them',async()=>{
  const e=await setup(),draft=newDraft('owner-draft-01');draft.values.listing_title='My draft';
  const saved=await save(e,draft);assert.equal(saved.status,200);assert.equal(saved.body.status,'draft');
  assert.equal((await e.call('list',{},e.a)).body.records.length,1);assert.deepEqual((await e.call('list',{},e.b)).body.records,[]);
  for(const action of ['workspace_open','workspace_save_prepare','workspace_save_commit','workspace_submit','workspace_status','workspace_reopen','workspace_unlist']){
    const result=await e.call(action,{id:draft.id,draft,version:1,editRevision:1},e.b);assert.equal(result.status,404,action);
  }
  assert.equal((await e.call('workspace_submit',{id:draft.id,version:1},e.a)).status,422);
});
test('uploads become a draft only after validation; failed files and stale commits preserve the prior draft',async()=>{
  const e=await setup(),draft=completeDraft();await save(e,draft);
  const original=structuredClone(e.rows.get(draft.id));draft.values.price='200000';
  const first=await e.call('workspace_save_prepare',{draft,version:1,editRevision:1},e.a);
  assert.equal((await e.call('workspace_save_commit',{id:draft.id,transaction:first.body.transaction},e.a)).status,422);
  assert.deepEqual(e.rows.get(draft.id),original);
  const saved=await save(e,draft,e.a,1,1,draft.files.map(f=>f.id));assert.equal(saved.status,200);
  e.upload(first.body,draft);assert.equal((await e.call('workspace_save_commit',{id:draft.id,transaction:first.body.transaction},e.a)).status,409);
  assert.equal(e.rows.get(draft.id).version,2);
});
test('saving is idempotent, and a complete account draft can enter the existing review workflow',async()=>{
  const e=await setup(),draft=completeDraft();const prepared=await e.call('workspace_save_prepare',{draft,version:0,editRevision:0},e.a);e.upload(prepared.body,draft);
  const body={id:draft.id,transaction:prepared.body.transaction};assert.equal((await e.call('workspace_save_commit',body,e.a)).status,200);assert.equal((await e.call('workspace_save_commit',body,e.a)).status,200);assert.equal(e.rows.get(draft.id).version,1);
  const submitted=await e.call('workspace_submit',{id:draft.id,version:1},e.a);assert.equal(submitted.status,200);assert.equal(submitted.body.status,'ready_for_review');assert.equal(e.emails.length,1);
  assert.equal((await e.call('workspace_save_prepare',{draft,version:1,editRevision:1},e.a)).status,409);
  const review=await e.call('review',{id:draft.id},e.admin,'admin');assert.equal(review.status,200);assert.match(review.body.draft.files[0].url,/draft-/);
});
test('administrators edit received data and reopen for owners while the old publication remains unchanged',async()=>{
  const e=await setup(),row=approvedRow();row.owner_subject='owner-a';row.owner_email='owner-a@gmail.com';row.publication=createPublication(row,editorial,{apiURL:e.options.config.publicAPIURL});e.rows.set(row.id,row);
  const published=structuredClone(row.publication),payload=structuredClone(row.payload);payload.values.price='999999';payload.files=[];payload.values.photo_exception='New photos pending';
  const reopened=await e.call('workspace_reopen_owner',{id:row.id,version:row.version,editRevision:0,feedback:'Confirm the price.'},e.admin,'admin');assert.equal(reopened.body.status,'changes_requested');assert.deepEqual(e.rows.get(row.id).publication,published);
  const saved=await save(e,payload,e.a,1,row.version);assert.equal(saved.status,200);assert.deepEqual(e.rows.get(row.id).publication,published);
  const opened=await e.call('workspace_open',{id:row.id},e.a);assert.equal(opened.body.draft.values.price,'999999');assert.equal(opened.body.feedback,'Confirm the price.');
  const prepared=await e.call('workspace_save_prepare',{draft:payload,version:opened.body.version,editRevision:opened.body.editRevision},e.admin,'admin');assert.equal(prepared.status,200);
  const unlisted=await e.call('workspace_unlist',{id:row.id,version:opened.body.version,publicationRevision:0},e.a);assert.equal(unlisted.status,200);assert.equal(e.rows.get(row.id).publication,null);
  assert.equal((await e.call('workspace_save_commit',{id:row.id,transaction:prepared.body.transaction},e.admin,'admin')).status,409);
});
test('an owner must prove original token access to claim a legacy listing; matching a contact email is insufficient',async()=>{
  const e=await setup(),row=approvedRow();row.token_hash=hash('c'.repeat(64));e.rows.set(row.id,row);
  assert.equal((await e.call('workspace_claim',{id:row.id,token:'d'.repeat(64)},e.a)).status,403);
  assert.equal((await e.call('workspace_claim',{id:row.id,token:'c'.repeat(64)},e.a)).status,200);
  assert.equal((await e.call('workspace_claim',{id:row.id,token:'c'.repeat(64)},e.b)).status,403);
  assert.equal((await e.call('workspace_open',{id:row.id},e.a)).status,200);
});
test('owner challenges are single-use and sessions expire, revoke and obey account suspension',async()=>{
  const e=await setup(),challenge=await e.call('challenge'),body={nonce:challenge.body.nonce,credential:'owner-a'};
  const results=await Promise.all([e.call('login',body),e.call('login',body)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,401]);
  await e.call('logout',{},e.a);assert.equal((await e.call('list',{},e.a)).status,401);
  e.portal.get('accounts/'+hash('owner-b')).active=false;assert.equal((await e.call('list',{},e.b)).status,401);
  const fresh=await e.login('owner-a');e.advance(8*3600000);assert.equal((await e.call('list',{},fresh.body.token)).status,401);
});
test('direct admin edits invalidate an owner save in progress and require a new review before publication',async()=>{
  const e=await setup(),draft=completeDraft();await save(e,draft);
  const pending=await e.call('workspace_save_prepare',{draft,version:1,editRevision:1,reuse:draft.files.map(f=>f.id)},e.a);
  draft.values.price='250000';draft.values.lat='10.49';e.rows.get(draft.id).editorial={place:'Old locality'};
  const adminStage=await e.call('workspace_save_prepare',{draft,version:1,editRevision:1,reuse:draft.files.map(f=>f.id)},e.admin,'admin');
  const saved=await e.call('workspace_save_commit',{id:draft.id,transaction:adminStage.body.transaction},e.admin,'admin');assert.equal(saved.status,200);assert.equal(saved.body.version,2);assert.equal(e.rows.get(draft.id).editorial.place,'');
  assert.equal((await e.call('workspace_save_commit',{id:draft.id,transaction:pending.body.transaction},e.a)).status,409);
  assert.equal((await e.call('publish',{id:draft.id,version:2,publicationRevision:0,confirmed:true,editorial},e.admin,'admin')).status,422);
  assert.equal((await e.call('workspace_submit',{id:draft.id,version:2},e.admin,'admin')).status,200);
  const approved=await e.call('approve',{id:draft.id,version:2,review:{plan_number:'TEST',documented_area:1000,plan_matches:true,copy_checked:true}},e.admin,'admin');assert.equal(approved.status,200,JSON.stringify(approved.body));
  assert.equal((await e.call('publish',{id:draft.id,version:2,publicationRevision:0,confirmed:true,editorial},e.admin,'admin')).status,200);
  const published=e.rows.get(draft.id).publication;assert.equal(published.listing.price,250000);assert.ok(Object.values(published.media).every(file=>file.path.includes('/draft-')));
});
