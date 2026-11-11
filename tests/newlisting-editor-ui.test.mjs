import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseHTML} from 'linkedom';
import * as admin from '../site/admin/client.mjs';

test('the actual admin editor opens editable fields, keeps actions together and omits draft/text clutter',async t=>{
 const {document,window}=parseHTML(fs.readFileSync(new URL('../site/newlisting/index.html',import.meta.url),'utf8'));
 const globals=['document','window','location','history','sessionStorage','indexedDB','fetch','setTimeout'],old=Object.fromEntries(globals.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 t.after(()=>{admin.clearSession();for(const key of globals){if(old[key])Object.defineProperty(globalThis,key,old[key]);else delete globalThis[key];}});
 const originalTimer=globalThis.setTimeout,storage=new Map(),calls=[];let saved,revision=1,workflowStatus='draft';
 const location={pathname:'/newlisting/',search:'?admin=test-property-01',hash:'',origin:'https://arenalindex.com',replace(url){this.destination=url;}};
 Object.assign(globalThis,{document,window,location,history:{replaceState(){}},sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},setTimeout:(fn,ms)=>{const timer=originalTimer(fn,ms);timer.unref();return timer;}});
 window.location=location;window.scrollTo=()=>{};window.ArenalConfig={intakeUrl:'https://api.example/intake'};
 const identity={token:'a'.repeat(64),email:'admin@gmail.com',expiresAt:Date.now()+3600000};admin.saveSession(identity);
 const state=()=>({version:revision,editRevision:revision-1,status:workflowStatus,publicationRevision:0});
 globalThis.fetch=async(_url,options)=>{
  const body=JSON.parse(options.body);calls.push(body);
  const result=body.action==='session'?identity:body.action==='workspace_status'?state():body.action==='workspace_open'?{...state(),draft:{id:'test-property-01',values:{listing_title_es:'Terreno junto al río',buildings:'no'},buildings:[],files:[]}}:body.action==='health'?{ready:true}:body.action==='workspace_save_prepare'?{transaction:'t'.repeat(64),uploads:[]}:body.action==='workspace_save_commit'?(revision++,state()):{};
  return Response.json(result);
 };
 const database={transaction(){const transaction={objectStore(){return {get(){const request={result:saved};queueMicrotask(()=>request.onsuccess());return request;},put(value){saved=structuredClone(value);queueMicrotask(()=>transaction.oncomplete());}};}};return transaction;}};
 globalThis.indexedDB={open(){const request={result:database};queueMicrotask(()=>request.onsuccess());return request;}};
 await import('../site/newlisting/app.mjs?editor-ui-test=1');
 const $=s=>document.querySelector(s);
 assert.equal($('#account-back').getAttribute('href'),'/admin/');assert.equal($('#field-listing_title_es').value,'Terreno junto al río');assert.equal($('#step-body fieldset').hasAttribute('disabled'),false);
 assert.equal($('#field-listing_title_es').getAttribute('translate'),'no');assert.ok($('#admin-editor-actions [data-admin-action=preview]'));
 assert.ok($('#admin-editor-actions details [data-admin-action=delete]'));assert.equal($('.submission-banner'),null);assert.equal($('#submission-state').textContent,'');
 $('#field-listing_title_es').value='Terreno con vista';$('#field-listing_title_es').dispatchEvent(new window.Event('input',{bubbles:true}));
 await $('#cloud-save').onclick();assert.equal(calls.find(c=>c.action==='workspace_save_prepare').draft.values.listing_title_es,'Terreno con vista');
 const count=calls.filter(c=>c.action==='workspace_save_prepare').length;await $('#cloud-save').onclick();assert.equal(calls.filter(c=>c.action==='workspace_save_prepare').length,count);
 await $('#step-select').onchange({target:{value:'8'}});assert.equal($('[data-review-section=copy]'),null);assert.ok($('[data-action=buyer-preview]'));
 workflowStatus='approved';window.dispatchEvent(new window.Event('focus'));await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));
 assert.equal($('#next').textContent,'Revisar y publicar');
 $('#field-authorization').checked=true;$('#field-authorization').dispatchEvent(new window.Event('input',{bubbles:true}));assert.equal($('#next').textContent,'Enviar para revisión');
});

test('a seller Edit link opens an editable draft once; refreshing after submission does not reopen it',async t=>{
 const owner=await import('../site/cuenta/client.mjs');
 const globals=['document','window','location','history','sessionStorage','indexedDB','fetch','setTimeout'],old=Object.fromEntries(globals.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 t.after(()=>{owner.clearSession();for(const key of globals){if(old[key])Object.defineProperty(globalThis,key,old[key]);else delete globalThis[key];}});
 const timer=globalThis.setTimeout,storage=new Map(),calls=[];let saved,status='approved',editRevision=3,search='?cuenta=test-property-01&edit=1';
 const identity={token:'b'.repeat(64),email:'seller@gmail.com',expiresAt:Date.now()+3600000};
 const state=()=>({version:2,editRevision,status,publishedVersion:1,publicationRevision:1});
 globalThis.sessionStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};owner.saveSession(identity);
 globalThis.setTimeout=(fn,ms)=>{const handle=timer(fn,ms);handle.unref();return handle;};
 globalThis.fetch=async(_url,options)=>{
  const body=JSON.parse(options.body);calls.push(body);
  if(body.action==='workspace_reopen'){assert.equal(body.editRevision,3);status='draft';editRevision++;}
  return Response.json(body.action==='session'?identity:body.action==='health'?{ready:true}:body.action==='workspace_open'?{...state(),draft:{id:'test-property-01',values:{listing_title_es:'Mi propiedad',buildings:'no'},buildings:[],files:[]}}:state());
 };
 const database={transaction(){const transaction={objectStore(){return {get(){const request={result:saved};queueMicrotask(()=>request.onsuccess());return request;},put(value){saved=structuredClone(value);queueMicrotask(()=>transaction.oncomplete());}};}};return transaction;}};
 globalThis.indexedDB={open(){const request={result:database};queueMicrotask(()=>request.onsuccess());return request;}};
 for(const attempt of [1,2]){
  const {document,window}=parseHTML(fs.readFileSync(new URL('../site/newlisting/index.html',import.meta.url),'utf8'));
  const location={pathname:'/newlisting/',search,hash:'',origin:'https://arenalindex.com',replace(){}};
  Object.assign(globalThis,{document,window,location,history:{replaceState(_state,_title,url){search=url;location.search=url;}}});window.location=location;window.scrollTo=()=>{};window.ArenalConfig={intakeUrl:'https://api.example/intake'};
  await import('../site/newlisting/app.mjs?seller-edit-test='+attempt);
  assert.equal(calls.filter(c=>c.action==='workspace_reopen').length,1);assert.doesNotMatch(search,/edit=1/);
  assert.equal(document.querySelector('#step-body fieldset').hasAttribute('disabled'),attempt===2);
  if(attempt===1){assert.match(document.querySelector('#notice').textContent,/Podés editar/);assert.match(document.querySelector('#submission-state').textContent,/publicado sigue visible/);status='ready_for_review';}
 }
});
