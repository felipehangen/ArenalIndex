import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseHTML} from 'linkedom';
import {mountAdmin} from '../site/admin/controller.mjs';
import {selectRecords,renderRows} from '../site/admin/view.mjs';
const html=fs.readFileSync(new URL('../site/admin/index.html',import.meta.url),'utf8');
const sample={id:'test-property-01',title:'Terreno El Jardín',contact:'Felipe',email:'felipe@example.com',price:100000,currency:'USD',area:1000,status:'ready_for_review',version:1,updatedAt:'2026-11-09'};
const identity={token:'a'.repeat(64),email:'felipehangen@gmail.com',expiresAt:Date.now()+3600000};
function setup({signedIn=false,handler}={}){
  const {window,document}=parseHTML(html),calls=[],timers=[];let current=signedIn?identity:null;
  globalThis.window=window;window.location={hash:'',replace(url){this.destination=url;}};
  document.querySelector('#admin-status option').selected=true;
  const api={session:()=>current,saveSession:value=>current=value,clearSession:()=>{current=null;},async logout(){current=null;},async request(action,body,authenticated){
    calls.push({action,body,authenticated});
    if(handler){const result=handler(action,body);if(result!==undefined)return result;}
    if(action==='config')return {configured:true,clientId:'google-client'};
    if(action==='challenge')return {nonce:'b'.repeat(64)};
    if(action==='login'||action==='session')return identity;
    if(action==='list')return {records:[sample],cursor:null};
    throw Error('Unexpected action '+action);
  }};
  const google={initialize(options){this.options=options;},renderButton(node,options){node.textContent='Google sign-in';this.button=options;},disableAutoSelect(){}};
  const controller=mountAdmin({document,window,api,googleLoader:async()=>google,schedule:fn=>{const timer={fn};timers.push(timer);return timer;},cancel:timer=>{if(timer)timer.cancelled=true;}});
  return {window,document,api,google,controller,calls,timers,$:selector=>document.querySelector(selector)};
}
test('the login screen loads no private records until Google credentials are exchanged by the server',async()=>{
  const e=setup();await e.controller.ready;
  assert.ok(e.$('#inbox').hidden);assert.equal(e.calls.some(call=>call.action==='list'),false);
  assert.equal(e.google.options.nonce,'b'.repeat(64));assert.equal(e.google.options.client_id,'google-client');
  await e.google.options.callback({credential:'signed-google-token'});
  const login=e.calls.find(call=>call.action==='login');assert.deepEqual(login.body,{credential:'signed-google-token',nonce:'b'.repeat(64)});
  assert.equal(login.authenticated,false);assert.equal(e.$('#inbox').hidden,false);assert.match(e.$('#admin-records').textContent,/Terreno El Jardín/);
  e.controller.destroy();
});
test('denied Google accounts remain outside the inbox with a retry option',async()=>{
  const e=setup({handler:action=>{if(action==='login')throw Object.assign(Error('Esta cuenta no tiene acceso de administrador.'),{status:403});}});
  await e.controller.ready;await e.google.options.callback({credential:'not-allowed'});
  assert.equal(e.$('#inbox').hidden,true);assert.match(e.$('#login-status').textContent,/no tiene acceso/);assert.equal(e.$('#retry-login').hidden,false);
  assert.equal(e.calls.some(call=>call.action==='list'),false);e.controller.destroy();
});
test('all inbox pages must succeed before displaying searchable results',async()=>{
  let fail=true;const e=setup({signedIn:true,handler:(action,body)=>{
    if(action!=='list')return;
    if(!body.cursor)return {records:[sample],cursor:'page2'};
    if(fail)throw Error('network failed');return {records:[{...sample,id:'second-property',title:'Otra propiedad'}],cursor:null};
  }});
  await e.controller.ready;assert.equal(e.$('#admin-records').children.length,0);assert.equal(e.$('#inbox-error').hidden,false);
  fail=false;await e.controller.refresh();assert.equal(e.$('#admin-records').children.length,2);assert.match(e.$('#admin-count').textContent,/2 de 2/);
  e.$('#admin-search').value='jardin';e.$('#admin-search').oninput();assert.equal(e.$('#admin-records').children.length,1);e.controller.destroy();
});
test('session expiry clears private records and a delayed response cannot restore them',async()=>{
  let resolve;const e=setup({signedIn:true});await e.controller.ready;
  e.api.request=()=>new Promise(done=>{resolve=done;});const pending=e.controller.refresh();
  const timer=e.timers.find(timer=>!timer.cancelled);timer.fn();
  assert.equal(e.$('#inbox').hidden,true);assert.equal(e.$('#admin-records').textContent,'');assert.equal(e.$('#admin-account').textContent,'');
  resolve({records:[sample],cursor:null});await pending;assert.equal(e.$('#admin-records').textContent,'');assert.equal(e.api.session(),null);e.controller.destroy();
});
test('a server-rejected saved session is cleared without requesting records',async()=>{
  const e=setup({signedIn:true,handler:action=>{if(action==='session')throw Object.assign(Error('Expired'),{status:401});}});
  await e.controller.ready;assert.equal(e.api.session(),null);assert.ok(e.$('#inbox').hidden);assert.equal(e.calls.some(c=>c.action==='list'),false);e.controller.destroy();
});
test('inbox text is escaped and search and status filters preserve published snapshots during edits',()=>{
  globalThis.window={};
  const malicious={...sample,title:'<img src=x onerror=alert(1)>',contact:'<script>bad</script>'};
  const {document}=parseHTML('<main>'+renderRows([malicious])+'</main>');assert.equal(document.querySelector('img,script'),null);
  assert.equal(document.querySelector('a').textContent,malicious.title);
  const rows=[sample,{...sample,id:'other-property',status:'draft',publishedVersion:1},{...sample,id:'third-property',status:'approved'}];
  assert.deepEqual(selectRecords(rows,{status:'published'}).map(r=>r.id),['other-property']);
  assert.equal(selectRecords(rows,{status:'all',query:'jardin'}).length,3);
  assert.equal(selectRecords(rows).length,1);
});
