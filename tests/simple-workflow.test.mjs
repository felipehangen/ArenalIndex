import test from 'node:test';
import assert from 'node:assert/strict';
import {portalFixture} from './portal-fixture.mjs';
import {approvedRow,editorial} from './publication-fixture.mjs';
import {createPublication} from '../server/intake/publication.mjs';
import {reopenForEditing} from '../site/newlisting/account.mjs';

async function setup({published=false}={}){
  const e=portalFixture(),token=await e.adminSession(),row=approvedRow();
  if(published)row.publication=createPublication(row,editorial,{apiURL:e.options.config.publicAPIURL});
  const review=row.review;
  Object.assign(row,{status:'ready_for_review',review:{},edit_revision:4,publication_revision:published?1:0,review_token_hash:'current-review'});
  e.rows.set(row.id,row);
  const body={id:row.id,version:row.version,editRevision:4,publicationRevision:row.publication_revision,review,editorial,confirmed:true};
  return {...e,row,token,body,run:(action='approve_publish',patch={})=>e.call(action,{...body,...patch},token,'admin')};
}
test('one reviewer action approves and publishes; preview does neither',async()=>{
  const e=await setup(),before=structuredClone(e.row);
  const preview=await e.run('preview_publication');assert.equal(preview.status,200);assert.equal(preview.body.listing.area,3200);
  assert.deepEqual(e.rows.get(e.row.id),before);
  const result=await e.run();assert.equal(result.status,200);assert.equal(result.body.status,'approved');assert.equal(result.body.publishedVersion,e.row.version);
  const saved=e.rows.get(e.row.id);assert.equal(saved.reviewed_by,'admin@gmail.com');assert.equal(saved.published_by,'admin@gmail.com');assert.equal(saved.publication.listing.area,3200);
  assert.doesNotMatch(JSON.stringify(saved.publication),/PRIVATE-PLAN|seller@example.com/);
  assert.equal((await e.run()).status,409);
});
test('review checks, public confirmation and revisions all guard combined publication',async()=>{
  const e=await setup({published:true}),before=structuredClone(e.row);
  for(const [patch,status] of [[{review:{}},422],[{confirmed:false},422],[{editorial:{...editorial,title:''}},422],[{version:1},409],[{editRevision:3},409],[{publicationRevision:0},409]]){
    assert.equal((await e.run('approve_publish',patch)).status,status);assert.deepEqual(e.rows.get(e.row.id),before);
  }
  e.row.status='draft';assert.equal((await e.run()).status,409);
});
test('photo preparation failure and a racing reopen cannot approve or replace the current listing',async()=>{
  const e=await setup({published:true}),before=structuredClone(e.row);
  e.repository.publicPhoto=async()=>{throw Error('Storage unavailable');};
  assert.equal((await e.run()).status,500);assert.deepEqual(e.rows.get(e.row.id),before);
  e.repository.publicPhoto=async(path,file)=>({...file,path});
  e.repository.ensurePublishedIndex=async()=>{e.row.status='draft';e.row.edit_revision++;e.row.review_token_hash=null;};
  assert.equal((await e.run()).status,409);assert.deepEqual(e.row.publication,before.publication);assert.deepEqual(e.row.review,{});assert.equal(e.row.status,'draft');
});
test('customer sessions cannot approve and publish; optional approval remains private',async()=>{
  const e=await setup();await e.register('seller',e.token);const login=await e.login('seller');
  assert.equal((await e.call('approve_publish',e.body,login.body.token)).status,400);
  assert.equal((await e.call('approve_publish',e.body,login.body.token,'admin')).status,401);
  assert.equal((await e.run('approve')).status,200);assert.equal(e.row.publication,undefined);
  assert.equal((await e.run('publish')).status,200);
});
test('Edit reopens once, preserves unsaved changes and keeps the published snapshot',async()=>{
  const e=await setup({published:true});e.row.status='approved';
  const publicBefore=structuredClone(e.row.publication),draft={values:{title:'Unsaved change'},submission:{status:'approved'},cloud:{version:e.row.version,editRevision:4,dirty:true}};
  const account={kind:'admin',async request(action,body){const result=await e.call('workspace_'+action,{id:e.row.id,...body},e.token,'admin');if(result.status!==200)throw Error(result.body.error);return result.body;}};
  assert.equal(await reopenForEditing(draft,account),true);assert.equal(draft.submission.status,'draft');assert.equal(draft.cloud.dirty,true);assert.equal(draft.values.title,'Unsaved change');assert.equal(draft.cloud.editRevision,5);
  assert.deepEqual(e.row.publication,publicBefore);assert.deepEqual(e.row.review,{});
  assert.equal(await reopenForEditing(draft,account),false);assert.equal(e.row.edit_revision,5);
  draft.submission.status='approved';draft.cloud.editRevision=4;const before=structuredClone(draft);
  await assert.rejects(()=>reopenForEditing(draft,account));assert.deepEqual(draft,before);
});
