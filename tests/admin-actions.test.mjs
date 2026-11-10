import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseHTML} from 'linkedom';
import {mountListingActions} from '../site/admin/actions.mjs';
import {renderRows,selectRecords} from '../site/admin/view.mjs';
const rows=[{id:'real-property-01',title:'Casa',version:2,editRevision:3,publicationRevision:4,publishedVersion:2,publicId:'public-house',status:'approved',price:200000,currency:'USD'}, {id:'review-property-01',title:'Lote',status:'ready_for_review',version:1,publicationRevision:0}, {id:'lot-1',title:'Demo',source:'demo',isDemo:true,status:'published',publishedVersion:1,publicationRevision:0}];
function setup(){
 const {document,window}=parseHTML(fs.readFileSync(new URL('../site/admin/index.html',import.meta.url),'utf8'));globalThis.window=window;window.location={origin:'https://arenalindex.com'};
 const dialog=document.querySelector('dialog');dialog.showModal=()=>dialog.open=true;dialog.close=()=>{dialog.open=false;dialog.dispatchEvent(new window.Event('close'));};
 document.querySelector('#admin-records').innerHTML=renderRows(rows);const calls=[];let refresh=0;
 const api={session:()=>({token:'x'}),request:async(action,body)=>{calls.push({action,body});return {};}};
 mountListingActions({document,window,api,controller:{getRecords:()=>rows,refresh:async()=>refresh++}});
 return {document,window,calls,dialog,get refresh(){return refresh;},$:s=>document.querySelector(s),click:async selector=>document.querySelector('#admin-records').onclick({target:document.querySelector(selector)})};
}
test('published rows group edit, unlist and delete; review rows open a focused review with no implicit approval',async()=>{
 const e=setup();assert.match(e.$('[data-record="real-property-01"]').textContent,/EditarDeslistarBorrar/);assert.equal(e.$('[data-record="real-property-01"] .admin-record-link').getAttribute('href'),'/newlisting/?admin=real-property-01');
 await e.click('[data-id="review-property-01"][data-row-action="approve"]');assert.equal(e.dialog.open,true);assert.match(e.$('iframe').src,/focus=approve&embedded=1/);assert.equal(e.calls.length,0);
 e.$('#listing-dialog-close').onclick();assert.equal(e.$('iframe'),null);
});
test('deletion waits for confirmation and sends the visible record revisions',async()=>{
 const e=setup();await e.click('[data-id="real-property-01"][data-row-action="delete"]');assert.equal(e.calls.length,0);assert.match(e.$('#listing-dialog-body').textContent,/no se puede deshacer/);
 e.$('[data-cancel]').onclick();assert.equal(e.calls.length,0);
 await e.click('[data-id="real-property-01"][data-row-action="delete"]');
 assert.equal(e.$('[data-confirm]').disabled,true);await e.$('[data-confirm]').onclick();assert.equal(e.calls.length,0);
 e.$('[data-delete-confirmation]').value='wrong';e.$('[data-delete-confirmation]').oninput();assert.equal(e.$('[data-confirm]').disabled,true);
 e.$('[data-delete-confirmation]').value=' BORRAR ';e.$('[data-delete-confirmation]').oninput();assert.equal(e.$('[data-confirm]').disabled,false);await e.$('[data-confirm]').onclick();
 assert.deepEqual(e.calls,[{action:'workspace_delete',body:{id:'real-property-01',version:2,editRevision:3,publicationRevision:4,confirmation:'BORRAR'}}]);assert.equal(e.refresh,1);assert.equal(e.dialog.open,false);
});
test('demo actions use the managed catalog and can be selected independently of real submissions',async()=>{
 const e=setup();assert.deepEqual(selectRecords(rows,{status:'all',source:'demo'}).map(r=>r.id),['lot-1']);
 await e.click('[data-id="lot-1"][data-row-action="unlist"]');await e.$('[data-confirm]').onclick();assert.deepEqual(e.calls,[{action:'catalog_unlist',body:{id:'lot-1',revision:0}}]);
 e.$('[data-panel="accounts"]').onclick();assert.equal(e.$('#listings-panel').hidden,true);assert.equal(e.$('#accounts-panel').hidden,false);assert.equal(e.$('#owner-accounts').open,true);
 e.$('[data-panel="listings"]').onclick();assert.equal(e.$('#listings-panel').hidden,false);assert.equal(e.$('#accounts-panel').hidden,true);
});
test('demo deletion also requires the typed confirmation and accepts DELETE',async()=>{
 const e=setup();await e.click('[data-id="lot-1"][data-row-action="delete"]');
 await e.$('[data-confirm]').onclick();assert.equal(e.calls.length,0);
 e.$('[data-delete-confirmation]').value='DELETE';e.$('[data-delete-confirmation]').oninput();await e.$('[data-confirm]').onclick();
 assert.deepEqual(e.calls,[{action:'catalog_delete',body:{id:'lot-1',revision:0,confirmation:'DELETE'}}]);
});
