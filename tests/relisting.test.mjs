import test from 'node:test';
import assert from 'node:assert/strict';
import {portalFixture,hash} from './portal-fixture.mjs';
import {approvedRow,editorial} from './publication-fixture.mjs';
import {createPublication} from '../server/intake/publication.mjs';
import {recordSummary} from '../server/portal/summary.mjs';
import {createPublicHandler} from '../server/intake/public.mjs';
import {renderRows} from '../site/admin/view.mjs';
async function setup(){
 const e=portalFixture(),admin=await e.adminSession();await e.register('owner',admin);await e.register('other',admin);
 const token=(await e.login('owner')).body.token,other=(await e.login('other')).body.token;
 const subject=e.auth.get('owner-session/'+hash(token)).subject,row=approvedRow();
 row.owner_subject=subject;row.owner_email='owner@gmail.com';row.publication=createPublication(row,editorial,{apiURL:e.options.config.publicAPIURL});e.rows.set(row.id,row);
 e.repository.published=async()=>[...e.rows.values()].flatMap(r=>r.publication?[r.publication.listing]:[]);
 const body=()=>{const r=e.rows.get(row.id);return {id:r.id,version:r.version,editRevision:r.edit_revision||0,publicationRevision:r.publication_revision||0};};
 return {...e,admin,token,other,row,body};
}
test('owner can withdraw and restore the exact approved snapshot and photos repeatedly, without approving new content',async()=>{
 const e=await setup(),snapshot=structuredClone(e.row.publication),publicAPI=createPublicHandler(e.repository);
 const photo=Object.keys(snapshot.media)[0],url='https://example.test/?id='+e.row.id+'&photo='+photo+'&version='+snapshot.version;
 for(let i=0;i<2;i++){
  assert.equal((await e.call('workspace_unlist',e.body(),e.token)).status,200);
  const withdrawn=e.rows.get(e.row.id);assert.equal(recordSummary(withdrawn).canRelist,true);
  assert.deepEqual((await (await publicAPI(new Request('https://example.test/'))).json()),[]);
  assert.equal((await publicAPI(new Request(url))).status,404);
  assert.equal((await e.call('workspace_unlist',e.body(),e.token)).status,409);
  assert.equal((await e.call('workspace_relist',e.body(),e.other)).status,404);
  assert.equal((await e.call('workspace_relist',e.body())).status,401);
  assert.equal((await e.call('workspace_relist',{...e.body(),publicationRevision:0},e.token)).status,409);
  assert.equal((await e.call('workspace_relist',{...e.body(),listing:{name:'UNAPPROVED'}},e.token)).status,200);
  assert.deepEqual(e.rows.get(e.row.id).publication,snapshot);assert.equal(recordSummary(e.rows.get(e.row.id)).canRelist,false);
  assert.equal((await publicAPI(new Request(url))).status,307);
  assert.equal((await e.call('workspace_relist',e.body(),e.token)).status,409);
 }
});
test('saved changes before or after withdrawal require review; opening without saving does not',async()=>{
 for(const editFirst of [true,false]){
  const e=await setup();
  if(!editFirst)await e.call('workspace_unlist',e.body(),e.token);
  await e.call('workspace_reopen',e.body(),e.token);
  if(!editFirst)assert.equal(recordSummary(e.rows.get(e.row.id)).canRelist,true);
  const draft=structuredClone(e.row.payload);draft.values.price='999999';draft.files=[];
  const stage=await e.call('workspace_save_prepare',{...e.body(),draft},e.token);assert.equal(stage.status,200);
  assert.equal((await e.call('workspace_save_commit',{id:e.row.id,transaction:stage.body.transaction},e.token)).status,200);
  if(editFirst)await e.call('workspace_unlist',e.body(),e.token);
  assert.equal(recordSummary(e.rows.get(e.row.id)).canRelist,false);
  assert.equal((await e.call('workspace_relist',e.body(),e.token)).status,409);
  assert.equal(e.rows.get(e.row.id).publication,null);
 }
});
test('admin withdrawal and records without a stored prior publication cannot be relisted by owners',async()=>{
 const e=await setup();assert.equal((await e.call('workspace_unlist',e.body(),e.admin,'admin')).status,200);
 assert.equal(recordSummary(e.rows.get(e.row.id)).canRelist,false);assert.equal((await e.call('workspace_relist',e.body(),e.token)).status,409);
 e.rows.get(e.row.id).status='deleted';assert.equal((await e.call('workspace_relist',e.body(),e.token)).status,404);
});
test('a save racing relist is rejected; an updated record cannot be restored by a stale atomic write',async()=>{
 const e=await setup();await e.call('workspace_unlist',e.body(),e.token);await e.call('workspace_reopen',e.body(),e.token);
 const draft=structuredClone(e.row.payload);draft.files=[];
 const stage=await e.call('workspace_save_prepare',{...e.body(),draft},e.token);assert.equal(stage.status,200);
 assert.equal((await e.call('workspace_relist',e.body(),e.token)).status,200);
 assert.equal((await e.call('workspace_save_commit',{id:e.row.id,transaction:stage.body.transaction},e.token)).status,409);
 await e.call('workspace_unlist',e.body(),e.token);
 e.repository.ensurePublishedIndex=async()=>{e.rows.get(e.row.id).version++;};
 assert.equal((await e.call('workspace_relist',e.body(),e.token)).status,409);assert.equal(e.rows.get(e.row.id).publication,null);
});
test('withdrawn row offers relist only with server eligibility and explains pending review',async()=>{
 const e=await setup();await e.call('workspace_unlist',e.body(),e.token);
 globalThis.window={};try{
  const row=recordSummary(e.rows.get(e.row.id));assert.match(renderRows([row],{owner:true}),/data-relist=.*Volver a enlistar/);
  row.canRelist=false;const html=renderRows([row],{owner:true});assert.doesNotMatch(html,/data-relist/);assert.match(html,/Requiere revisión/);
 }finally{delete globalThis.window;}
});
