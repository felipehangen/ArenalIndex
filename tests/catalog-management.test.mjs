import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatalog} from '../server/catalog/core.mjs';
import {createAdminHandler} from '../server/admin/core.mjs';
import {createPublicHandler} from '../server/intake/public.mjs';
import {portalFixture} from './portal-fixture.mjs';
import {approvedRow,editorial} from './publication-fixture.mjs';
import {createPublication} from '../server/intake/publication.mjs';
const demo={id:'lot-1',is_demo:true,name:'Terreno de prueba',place:'La Fortuna',price:10000,currency:'USD',area:1000,details:{schemaVersion:1,language:'es',translations:{en:{title:'Test land'}}}};
function catalogFixture(){
 const e=portalFixture(),state={},calls=[];
 e.repository.catalogState=async()=>structuredClone(state);
 e.repository.catalogUpdate=async(id,revision,value)=>{if((state[id]?.revision||0)!==revision)return null;state[id]=structuredClone(value);return true;};
 const catalog=createCatalog({repository:e.repository,fetcher:async(url,options)=>{calls.push({url,options});return Response.json([demo]);}});
 return {...e,state,catalog,calls};
}
test('demo unlisting, editing, republication and deletion govern both the admin and public catalog',async()=>{
 const e=catalogFixture(),actor={email:'admin@gmail.com'};
 assert.equal((await e.catalog.list())[0].isDemo,true);assert.equal((await e.catalog.published()).length,1);
 await e.catalog.action('catalog_unlist',{id:demo.id,revision:0},actor);
 assert.equal((await e.catalog.published()).length,0);assert.equal((await e.catalog.list())[0].withdrawn,true);
 await assert.rejects(e.catalog.action('catalog_publish',{id:demo.id,revision:0},actor),{status:409});
 await e.catalog.action('catalog_update',{id:demo.id,revision:1,listing:{titleEs:'Vista al lago',titleEn:'Lake views',price:190000,area:1300,currency:'CRC',place:'El Castillo'}},actor);
 await e.catalog.action('catalog_publish',{id:demo.id,revision:2},actor);
 const published=(await e.catalog.published())[0];assert.equal(published.name,'Vista al lago');assert.equal(published.details.translations.en.title,'Lake views');assert.equal(published.currency,'CRC');
 assert.equal(published.updatedBy,undefined);assert.equal(published.revision,undefined);
 const response=await createPublicHandler({...e.repository,published:async()=>[]},{catalog:e.catalog})(new Request('https://api.example/listings?catalog=1'));
 assert.equal((await response.json())[0].price,190000);
 await e.catalog.action('catalog_delete',{id:demo.id,revision:3},actor);
 assert.equal((await e.catalog.list()).length,0);assert.equal((await e.catalog.published()).length,0);
 await assert.rejects(e.catalog.action('catalog_publish',{id:demo.id,revision:4},actor),{status:404});
 assert.ok(e.calls.every(c=>c.options.headers.apikey.startsWith('sb_publishable_')));
});
test('catalog mutations require admin authentication and bounded values with a current revision',async()=>{
 const e=catalogFixture(),handler=createAdminHandler({...e.options,catalog:e.catalog});
 const send=async(action,token,body={})=>handler(new Request('https://api.example/admin',{method:'POST',headers:token?{Authorization:'Bearer '+token}:{},body:JSON.stringify({action,...body})}));
 for(const action of ['catalog_open','catalog_delete','catalog_update','catalog_unlist','catalog_publish'])assert.equal((await send(action,null,{id:demo.id,revision:0})).status,401);
 const token=await e.adminSession();assert.equal((await(await send('list',token)).json()).records[0].isDemo,true);
 assert.equal((await send('catalog_delete',token,{id:'real-property',revision:0})).status,400);
 assert.equal((await send('catalog_update',token,{id:demo.id,revision:0,listing:{}})).status,422);
 assert.deepEqual(e.state,{});
});
test('deletion guards the current version and removes access, list rows, publication, and delayed draft commits',async()=>{
 const e=portalFixture(),admin=await e.adminSession();await e.register('alice',admin);const login=await e.login('alice'),token=login.body.token;
 const ownerAccount=[...e.portal.values()].find(r=>r.email==='alice@gmail.com'&&r.subject),row=approvedRow();
 // The owner login returns a canonical subject stored in the account record.
 const session=[...e.auth.values()].find(r=>r.email==='alice@gmail.com'&&r.subject);row.owner_subject=session.subject;row.owner_email='alice@gmail.com';
 row.publication=createPublication(row,editorial,{apiURL:e.options.config.publicAPIURL});e.rows.set(row.id,row);
 const stage=await e.call('workspace_save_prepare',{draft:{...row.payload,files:[]},version:row.version,editRevision:0},admin,'admin');assert.equal(stage.status,200);
 const body={id:row.id,version:row.version,editRevision:0,publicationRevision:0};
 assert.equal((await e.call('workspace_delete',body,token)).status,400);
 assert.equal((await e.call('workspace_delete',{...body,version:0},admin,'admin')).status,409);
 assert.equal((await e.call('workspace_delete',body,admin,'admin')).status,200);
 assert.equal(e.rows.get(row.id).publication,null);assert.equal(e.rows.get(row.id).payload.files.length,0);
 assert.equal((await e.call('workspace_open',{id:row.id},token)).status,404);
 assert.equal((await e.call('review',{id:row.id},admin,'admin')).status,404);
 assert.equal((await e.call('list',{},admin,'admin')).body.records.length,0);
 assert.equal((await e.call('list',{},token)).body.records.length,0);
 assert.equal((await e.call('workspace_save_commit',{id:row.id,transaction:stage.body.transaction},admin,'admin')).status,404);
});
test('the production intake endpoint requires an account for new submissions before touching storage',async()=>{
 const {application}=await import('../api/intake.mjs');
 const response=await application({})(new Request('https://api.example/intake',{method:'POST',headers:{'X-Intake-Token':'b'.repeat(64)},body:JSON.stringify({action:'prepare',draft:{id:'anonymous-property',values:{},files:[],buildings:[]}})}));
 assert.equal(response.status,401);assert.match((await response.json()).error,/Iniciá sesión/);
});
