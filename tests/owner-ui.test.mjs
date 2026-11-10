import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseHTML} from 'linkedom';
import {mountAdmin} from '../site/admin/controller.mjs';
import {mountAccounts} from '../site/admin/accounts.mjs';
import {currentRules} from '../server/portal/listing-rules.mjs';
const identity={token:'a'.repeat(64),email:'owner@example.com',method:'password',expiresAt:Date.now()+3600000,requiresPasswordChange:true};
const event={preventDefault(){}};
function setup({signedIn=false,hash='',handler,owner=true}={}){
  const html=fs.readFileSync(new URL(owner?'../site/cuenta/index.html':'../site/admin/index.html',import.meta.url),'utf8');
  const {document,window}=parseHTML(html),calls=[],timers=[];let session=signedIn?{...identity}:null,required=true;
  globalThis.window=window;window.location={hash,replace(value){this.destination=value;}};
  document.querySelector('#admin-status option').selected=true;
  const api={session:()=>session,saveSession:value=>session=value,clearSession:()=>{session=null;},async logout(){session=null;},async request(action,body,authenticated){
    calls.push({action,body,authenticated});if(handler){const result=handler(action,body);if(result!==undefined)return result;}
    if(action==='config')return {configured:true,clientId:'google-client'};
    if(action==='challenge')return {nonce:'b'.repeat(64)};
    if(action==='login_password'||action==='session')return {...identity,requiresPasswordChange:required};
    if(action==='change_password'){required=false;return {changed:true};}
    if(action==='list')return {records:[],cursor:null};
    if(action==='owner_accounts')return {accounts:[{id:'c'.repeat(64),email:'owner@example.com',active:true,password:true,temporaryPassword:true}]};
    if(action==='set_owner_password'||action==='create_account')return {email:body.email,active:true};
    throw Error('Unexpected '+action);
  }};
  const google={initialize(options){this.options=options;},renderButton(node){node.textContent='Google';},disableAutoSelect(){}};
  const controller=mountAdmin({document,window,api,owner,googleLoader:async()=>google,schedule:fn=>{const timer={fn};timers.push(timer);return timer;},cancel:timer=>{if(timer)timer.cancelled=true;}});
  return {document,window,api,controller,google,calls,timers,$:selector=>document.querySelector(selector)};
}
test('email login clears credentials from the form and requires changing the temporary password before opening listings',async()=>{
  const e=setup();await e.controller.ready;
  e.$('#owner-email').value='owner@example.com';e.$('#owner-password').value='Temporary password 123';await e.$('#email-login').onsubmit(event);
  assert.equal(e.$('#owner-password').value,'');assert.equal(e.$('#password-panel').hidden,false);assert.equal(e.$('#inbox').hidden,true);
  assert.equal(e.calls.some(c=>c.action==='list'),false);assert.equal(e.$('#password-back').hidden,true);assert.equal(e.$('#current-password-label').hidden,true);
  e.$('#new-password').value='Private password 123';e.$('#confirm-password').value='Different password';await e.$('#password-form').onsubmit(event);
  assert.equal(e.calls.some(c=>c.action==='change_password'),false);assert.match(e.$('#password-status').textContent,/no coinciden/);
  e.$('#confirm-password').value='Private password 123';await e.$('#password-form').onsubmit(event);
  assert.equal(e.$('#inbox').hidden,false);assert.equal(e.$('#password-panel').hidden,true);assert.equal(e.$('#new-password').value,'');
  assert.equal(e.calls.some(c=>c.action==='list'),true);
  e.$('#change-password').onclick();assert.equal(e.$('#current-password-label').hidden,false);assert.equal(e.$('#password-back').hidden,false);
  await e.$('#sign-out').onclick();assert.equal(e.$('#password-panel').hidden,true);assert.equal(e.$('#login-panel').hidden,false);e.controller.destroy();
});
test('direct draft links wait until the temporary password has been replaced',async()=>{
  const e=setup({signedIn:true,hash:'#edit=property-0001'});await e.controller.ready;
  assert.equal(e.window.location.destination,undefined);assert.equal(e.$('#password-panel').hidden,false);
  e.$('#new-password').value=e.$('#confirm-password').value='Private password 123';await e.$('#password-form').onsubmit(event);
  assert.equal(e.window.location.destination,'/newlisting/?cuenta=property-0001');e.controller.destroy();
});
test('password sign-in is usable even when the Google SDK cannot load',async()=>{
  const e=setup({handler:action=>{if(action==='config')return {configured:false};}});await e.controller.ready;
  e.$('#owner-email').value='owner@example.com';e.$('#owner-password').value='Temporary password 123';await e.$('#email-login').onsubmit(event);
  assert.equal(e.$('#password-panel').hidden,false);e.controller.destroy();
});
test('a delayed password response cannot restore a session after the login flow was reset',async()=>{
  let resolve;const e=setup({handler:action=>{if(action==='login_password')return new Promise(done=>resolve=done);}});await e.controller.ready;
  const pending=e.$('#email-login').onsubmit(event);e.controller.destroy();resolve(identity);await pending;
  assert.equal(e.api.session(),null);assert.equal(e.$('#inbox').hidden,true);
});
test('the admin creates a temporary password without storing it in an account list; logout clears the one-time output',async()=>{
  const e=setup({owner:false,signedIn:true});await e.controller.ready;mountAccounts({document:e.document,window:e.window,api:e.api});
  const form=e.$('#create-owner-account');form.querySelector('[name=name]').value='Owner';form.querySelector('[name=email]').value='owner@example.com';form.querySelector('[name=password]').value='Temporary password 123';
  await form.onsubmit(event);
  assert.equal(form.querySelector('[name=password]').value,'');assert.match(e.$('#owner-accounts output').textContent,/Temporary password 123/);
  assert.doesNotMatch(e.$('[data-accounts]').textContent,/Temporary password 123/);assert.match(e.$('[data-accounts]').textContent,/owner@example.com/);
  await e.$('#sign-out').onclick();assert.equal(e.$('#owner-accounts output').textContent,'');assert.equal(e.$('[data-accounts]').textContent,'');e.controller.destroy();
});
test('admin registration accepts an email without a password, and the interface uses neutral account language',async()=>{
  const e=setup({owner:false,signedIn:true});await e.controller.ready;mountAccounts({document:e.document,window:e.window,api:e.api});
  assert.equal(e.$('#invitations'),null);assert.match(e.$('#owner-accounts summary').textContent,/Cuentas y acceso/);
  const form=e.$('#create-owner-account');form.querySelector('[name=name]').value='Arenal Homes';form.querySelector('[name=email]').value='broker@example.com';
  assert.equal(form.querySelector('[name=password]').hasAttribute('required'),false);await form.onsubmit(event);
  assert.deepEqual(e.calls.find(c=>c.action==='create_account').body,{email:'broker@example.com',name:'Arenal Homes'});assert.equal(e.calls.some(c=>c.action==='set_owner_password'),false);
  assert.equal(e.$('#owner-accounts output').hidden,true);assert.match(e.$('#owner-accounts [role=status]').textContent,/entrar con Google/);e.controller.destroy();
});
test('Google sign-in has no invitation field or code payload, and links use the neutral account routes',async()=>{
  const e=setup({handler:action=>action==='login'?{...identity,method:'google',requiresPasswordChange:false}:undefined});await e.controller.ready;
  assert.equal(e.$('#invitation'),null);assert.doesNotMatch(e.document.body.textContent,/propietario|código de invitación/i);
  assert.equal(e.$('a[href="/newlisting/?cuenta=new"]')?.textContent,'Nueva propiedad');
  await e.google.options.callback({credential:'signed-token'});
  assert.deepEqual(e.calls.find(c=>c.action==='login').body,{credential:'signed-token',nonce:'b'.repeat(64)});assert.equal(e.$('#inbox').hidden,false);e.controller.destroy();
});

test('standard rules require an unchecked explicit acceptance before listing access and direct editor redirects',async()=>{
  let accepted=false;
  const e=setup({signedIn:true,hash:'#edit=property-0001',handler:action=>{
    if(action==='session')return {...identity,requiresPasswordChange:false,requiresRulesAcceptance:!accepted,listingRules:currentRules};
    if(action==='accept_listing_rules'){accepted=true;return {accepted:true};}
  }});await e.controller.ready;
  assert.equal(e.$('#rules-panel').hidden,false);assert.equal(e.$('#inbox').hidden,true);assert.equal(e.$('#rules-accept').checked,false);assert.equal(e.$('#rules-submit').disabled,true);assert.equal(e.$('#rules-list').children.length,6);assert.equal(e.window.location.destination,undefined);
  await e.$('#rules-form').onsubmit(event);assert.equal(e.calls.some(c=>c.action==='accept_listing_rules'),false);
  e.$('#rules-accept').checked=true;e.$('#rules-accept').onchange();assert.equal(e.$('#rules-submit').disabled,false);
  await e.$('#rules-form').onsubmit(event);
  assert.deepEqual(e.calls.find(c=>c.action==='accept_listing_rules').body,{accepted:true,version:currentRules.version,contentHash:currentRules.contentHash,language:'es'});
  assert.equal(e.window.location.destination,'/newlisting/?cuenta=property-0001');assert.equal(e.$('#rules-panel').hidden,true);e.controller.destroy();
});

test('acceptance errors keep listings closed and a retry is available; switching language preserves the choice',async()=>{
  const e=setup({signedIn:true,handler:action=>{
    if(action==='session')return {...identity,requiresPasswordChange:false,requiresRulesAcceptance:true,listingRules:currentRules};
    if(action==='accept_listing_rules')throw Error('Could not save acceptance');
  }});await e.controller.ready;
  e.$('#rules-accept').checked=true;e.$('#rules-accept').onchange();
  e.window.ArenalI18n={language:'en',t:s=>s};e.window.dispatchEvent(new e.window.Event('arenal-language-change'));
  assert.match(e.$('#rules-list').textContent,/Authority to list/);assert.equal(e.$('#rules-accept').checked,true);
  await e.$('#rules-form').onsubmit(event);assert.match(e.$('#rules-status').textContent,/Could not save/);assert.equal(e.$('#rules-submit').disabled,false);assert.equal(e.$('#inbox').hidden,true);assert.equal(e.calls.some(c=>c.action==='list'),false);
  await e.$('#sign-out').onclick();assert.equal(e.$('#rules-panel').hidden,true);assert.equal(e.$('#rules-accept').checked,false);e.controller.destroy();
});

test('a delayed acceptance response cannot reopen an account after leaving the session',async()=>{
  let resolve;const e=setup({signedIn:true,handler:action=>{
    if(action==='session')return {...identity,requiresPasswordChange:false,requiresRulesAcceptance:true,listingRules:currentRules};
    if(action==='accept_listing_rules')return new Promise(done=>resolve=done);
  }});await e.controller.ready;e.$('#rules-accept').checked=true;
  const pending=e.$('#rules-form').onsubmit(event);await e.$('#sign-out').onclick();resolve({accepted:true});await pending;
  assert.equal(e.$('#inbox').hidden,true);assert.equal(e.api.session(),null);e.controller.destroy();
});


test('admin edits an escaped account name inline and retains the draft on save error',async()=>{
  let name='Homes <Arenal>',version=1,reject=true;
  const e=setup({owner:false,signedIn:true,handler:(action,body)=>{
    if(action==='owner_accounts')return {accounts:[{id:'c'.repeat(64),email:'owner@example.com',name,nameVersion:version,active:true}]};
    if(action==='set_owner_name'){if(reject)throw Error('Save failed');name=body.name;version++;return {updated:true};}
  }});await e.controller.ready;mountAccounts({document:e.document,window:e.window,api:e.api});
  await e.$('[data-refresh-accounts]').onclick();
  const list=e.$('[data-accounts]');assert.equal(list.querySelector('strong').textContent,'Homes <Arenal>');assert.equal(list.querySelector('arenal'),null);
  await list.onclick({target:e.$('[data-edit-name]')});const editor=e.$('[data-name-form]');assert.equal(editor.hidden,false);editor.querySelector('input').value='New Name';
  await list.onsubmit({...event,target:editor});assert.equal(editor.querySelector('input').value,'New Name');assert.equal(editor.querySelector('[type=submit]').disabled,false);assert.match(e.$('#owner-accounts [role=status]').textContent,/Save failed/);
  reject=false;await list.onsubmit({...event,target:editor});assert.equal(list.querySelector('strong').textContent,'New Name');assert.equal(e.$('[data-name-form]').hidden,true);
  assert.deepEqual(e.calls.find(c=>c.action==='set_owner_name').body,{id:'c'.repeat(64),name:'New Name',nameVersion:1});e.controller.destroy();
});

test('existing unnamed accounts expose the name editor',async()=>{
  const e=setup({owner:false,signedIn:true});await e.controller.ready;mountAccounts({document:e.document,window:e.window,api:e.api});await e.$('[data-refresh-accounts]').onclick();
  assert.equal(e.$('[data-edit-name]').textContent,'Editar nombre');await e.$('[data-accounts]').onclick({target:e.$('[data-edit-name]')});
  assert.equal(e.$('[data-name-form]').hidden,false);assert.equal(e.$('[data-name-form] input').value,'');e.controller.destroy();
});

test('owner relist button confirms the unchanged publication and sends current version guards',async()=>{
  const row={id:'owner-listing-01',title:'Published home',status:'approved',withdrawn:true,canRelist:true,version:2,editRevision:3,publicationRevision:4,currency:'USD',area:1000};
  const e=setup({signedIn:true,handler:action=>{
    if(action==='session')return {...identity,requiresPasswordChange:false};
    if(action==='list')return {records:[row],cursor:null};
    if(action==='workspace_relist'){row.publishedVersion=2;row.withdrawn=false;row.canRelist=false;return {publishedVersion:2};}
  }});await e.controller.ready;
  let confirmed=false;e.window.confirm=()=>confirmed;
  const button=e.$('[data-relist]');assert.ok(button);
  await e.$('#admin-records').onclick({target:button});assert.equal(e.calls.some(c=>c.action==='workspace_relist'),false);
  confirmed=true;await e.$('#admin-records').onclick({target:button});
  assert.deepEqual(e.calls.find(c=>c.action==='workspace_relist').body,{id:row.id,version:2,editRevision:3,publicationRevision:4});
  assert.equal(e.$('[data-relist]'),null);assert.ok(e.$('[data-unlist]'));e.controller.destroy();
});
