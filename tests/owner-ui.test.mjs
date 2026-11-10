import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseHTML} from 'linkedom';
import {mountAdmin} from '../site/admin/controller.mjs';
import {mountAccounts} from '../site/admin/accounts.mjs';
const identity={token:'a'.repeat(64),email:'owner@example.com',method:'password',expiresAt:Date.now()+3600000,requiresPasswordChange:true};
const event={preventDefault(){}};
function setup({signedIn=false,hash='',handler,owner=true}={}){
  const html=fs.readFileSync(new URL(owner?'../site/owner/index.html':'../site/admin/index.html',import.meta.url),'utf8');
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
    if(action==='set_owner_password')return {email:body.email,active:true};
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
  assert.equal(e.window.location.destination,'/newlisting/?owner=property-0001');e.controller.destroy();
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
  const form=e.$('#create-owner-account');form.querySelector('[name=email]').value='owner@example.com';form.querySelector('[name=password]').value='Temporary password 123';
  await form.onsubmit(event);
  assert.equal(form.querySelector('[name=password]').value,'');assert.match(e.$('#owner-accounts output').textContent,/Temporary password 123/);
  assert.doesNotMatch(e.$('[data-accounts]').textContent,/Temporary password 123/);assert.match(e.$('[data-accounts]').textContent,/owner@example.com/);
  await e.$('#sign-out').onclick();assert.equal(e.$('#owner-accounts output').textContent,'');assert.equal(e.$('[data-accounts]').textContent,'');e.controller.destroy();
});
