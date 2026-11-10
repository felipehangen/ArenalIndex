import test from 'node:test';
import assert from 'node:assert/strict';
import {demoWorkspace} from '../scripts/demo-workspace.mjs';
import {supplementalDemos} from '../server/catalog/supplemental.mjs';
import {portalFixture} from './portal-fixture.mjs';
import {recordSummary} from '../server/portal/summary.mjs';
import {renderRows} from '../site/admin/view.mjs';
import {createCatalog} from '../server/catalog/core.mjs';
import {createPublicHandler} from '../server/intake/public.mjs';
import {createPublication} from '../server/intake/publication.mjs';
import {approvedRow,editorial} from './publication-fixture.mjs';
const listing=supplementalDemos.find(row=>row.id==='lot-107');
const assets=Object.fromEntries(listing.details.photoGroups.flatMap(g=>g.photos).map(p=>[p.id,{size:32,path:'import/'+p.id}]));

test('imported demo is an owned workspace with photos, real editing and withdrawal; original cannot reappear',async()=>{
 const e=portalFixture(),admin=await e.adminSession();
 await e.call('create_account',{name:'Asambleaterinde',email:'owner@gmail.com'},admin,'admin');
 const login=await e.login('owner'),token=login.body.token,account=(await e.repository.ownerAccounts())[0];
 const row=demoWorkspace(listing,account,assets);e.rows.set(row.id,row);
 const bytes=Buffer.alloc(32);bytes.write('RIFF');bytes.write('WEBP',8);
 for(const asset of Object.values(assets))e.files.set(asset.path,{size:asset.size,bytes});
 e.repository.catalogState=async()=>({[listing.id]:{status:'migrated',ownerSubject:account.subject,workspaceId:row.id}});
 const catalog=createCatalog({repository:e.repository,supplemental:[listing],fetcher:async()=>Response.json([])});
 assert.equal((await catalog.list()).length,0);assert.equal((await catalog.published()).length,0);
 await assert.rejects(catalog.action('catalog_publish',{id:listing.id,revision:0},{email:'admin@gmail.com'}),{status:404});
 const opened=await e.call('workspace_open',{id:row.id},token);
 assert.equal(opened.status,200);assert.equal(opened.body.draft.files.length,3);assert.equal(opened.body.draft.buildings[0].area,'330');
 assert.equal(opened.body.draft.values.authorization,false);assert.equal(opened.body.draft.values.email,account.email);
 await e.register('other',admin);const other=await e.login('other');
 assert.equal((await e.call('workspace_open',{id:row.id},other.body.token)).status,404);
 assert.equal((await e.call('workspace_unlist',{id:row.id,version:1,publicationRevision:1},other.body.token)).status,404);
 globalThis.window={};try{
  for(const owner of [true,false]){const html=renderRows([recordSummary(row)],{owner});assert.match(html,/newlisting\/\?(cuenta|admin)=workspace-demo-lot-107/);assert.match(html,/Deslistar/);assert.doesNotMatch(html,/Demo de prueba|demo-edit/);assert.match(html,/demo-badge/);}
 }finally{delete globalThis.window;}
 const edited=structuredClone(row.payload);edited.values.price='600000';
 const stage=await e.call('workspace_save_prepare',{id:row.id,draft:edited,version:1,editRevision:0,reuse:edited.files.map(f=>f.id)},token);
 assert.equal(stage.status,200);assert.deepEqual(stage.body.uploads,[]);
 const saved=await e.call('workspace_save_commit',{id:row.id,transaction:stage.body.transaction},token);assert.equal(saved.status,200);
 assert.equal(e.rows.get(row.id).payload.values.price,'600000');assert.deepEqual(e.rows.get(row.id).publication.listing,listing);
 assert.equal((await e.call('workspace_unlist',{id:row.id,version:1,publicationRevision:1},token)).status,409);
 assert.equal((await e.call('workspace_unlist',{id:row.id,version:2,publicationRevision:1},token)).status,200);
 assert.equal(e.rows.get(row.id).publication,null);assert.equal(e.rows.get(row.id).payload.files.length,3);
 e.repository.published=async()=>[...e.rows.values()].flatMap(r=>r.publication?[r.publication.listing]:[]);
 const response=await createPublicHandler(e.repository,{catalog})(new Request('https://api.example/listings?catalog=1'));
 assert.deepEqual(await response.json(),[]);assert.equal(recordSummary(e.rows.get(row.id)).withdrawn,true);
});

test('normal review publication keeps the trusted demo flag, original link and illustrative disclosures',()=>{
 const row=approvedRow();row.is_demo=true;row.demo_source_id='lot-107';
 const {listing:published}=createPublication(row,editorial,{apiURL:'https://example.com/api/listings'});
 assert.equal(published.id,'lot-107');assert.equal(published.is_demo,true);assert.equal(published.approximate,true);
 assert.equal(published.details.reviewedAt,undefined);assert.equal(published.details.entrance,false);
 assert.match(published.details.conditions[0],/ficticio/);
 assert.ok(published.details.sections.flatMap(s=>s.rows).every(f=>f.source==='Dato ficticio de demostración'));
 const real=approvedRow();real.payload.values.is_demo=true;
 assert.equal(createPublication(real,editorial,{apiURL:'https://example.com/api/listings'}).listing.is_demo,false);
});
