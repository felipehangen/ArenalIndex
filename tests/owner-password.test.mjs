import test from 'node:test';
import assert from 'node:assert/strict';
import {portalFixture,hash} from './portal-fixture.mjs';
import {createOwnerHandler} from '../server/portal/core.mjs';
const temporary='Temporary password 48',permanent='My private password 72';
async function setup(){const e=portalFixture(),admin=await e.adminSession();return {...e,admin};}
async function create(e,email='owner-a@gmail.com',password=temporary){const result=await e.call('set_owner_password',{email,password},e.admin,'admin');assert.equal(result.status,200,JSON.stringify(result.body));return result;}
const login=(e,email='owner-a@gmail.com',password=temporary)=>e.call('login_password',{email,password});

test('admin-created temporary password requires replacement before any owner data is available',async()=>{
  const e=await setup();await create(e,' Owner-A@Gmail.com ');
  const signed=await login(e);assert.equal(signed.status,200);assert.equal(signed.body.requiresPasswordChange,true);
  const token=signed.body.token;
  for(const action of ['list','workspace_open','workspace_save_prepare','workspace_unlist'])assert.equal((await e.call(action,{},token)).status,403);
  assert.equal((await e.call('session',{},token)).body.requiresPasswordChange,true);
  assert.equal((await e.call('change_password',{password:'short'},token)).status,422);
  assert.equal((await e.call('change_password',{password:temporary},token)).status,422);
  assert.equal((await e.call('change_password',{password:permanent},token)).status,200);
  assert.equal((await e.call('session',{},token)).body.requiresPasswordChange,false);
  assert.equal((await e.call('list',{},token)).status,200);
  assert.equal((await login(e)).status,401);
  assert.equal((await login(e,'owner-a@gmail.com',permanent)).status,200);
  assert.doesNotMatch(JSON.stringify([...e.portal,...e.auth]),/Temporary password|My private password/);
});
test('both sign-in methods preserve the canonical owner and listings in either creation order',async()=>{
  const e=await setup();await create(e);
  const password=await login(e),google=await e.login('owner-a');assert.equal(google.status,200);assert.equal(google.body.requiresPasswordChange,false);
  const session=e.auth.get('owner-session/'+hash(google.body.token));
  assert.equal(session.subject,e.auth.get('owner-session/'+hash(password.body.token)).subject);
  e.rows.set('shared-listing-01',{id:'shared-listing-01',owner_subject:session.subject,payload:{values:{listing_title:'Shared draft'},files:[]},status:'draft'});
  assert.equal((await e.call('list',{},google.body.token)).body.records.length,1);
  await e.call('change_password',{password:permanent},password.body.token);
  assert.equal((await e.call('list',{},password.body.token)).body.records.length,1);
  await e.register('owner-b',e.admin);const firstGoogle=await e.login('owner-b');await create(e,'owner-b@gmail.com');
  const laterPassword=await login(e,'owner-b@gmail.com');
  assert.equal(e.auth.get('owner-session/'+hash(laterPassword.body.token)).subject,e.auth.get('owner-session/'+hash(firstGoogle.body.token)).subject);
  assert.equal((await e.call('session',{},firstGoogle.body.token)).status,200);
});
test('password reset and account suspension revoke existing sessions, including after reactivation',async()=>{
  const e=await setup();await create(e);let signed=await login(e);await e.call('change_password',{password:permanent},signed.body.token);
  const google=await e.login('owner-a');await create(e);
  assert.equal((await e.call('list',{},signed.body.token)).status,401);
  assert.equal((await e.call('list',{},google.body.token)).status,200);
  signed=await login(e);const accountId=hash(e.auth.get('owner-session/'+hash(signed.body.token)).subject);
  await e.call('set_owner_active',{id:accountId,active:false},e.admin,'admin');
  assert.equal((await login(e)).status,401);assert.equal((await e.login('owner-a')).status,403);
  await e.call('set_owner_active',{id:accountId,active:true},e.admin,'admin');
  assert.equal((await e.call('session',{},signed.body.token)).status,401);assert.equal((await e.call('session',{},google.body.token)).status,401);
  assert.equal((await login(e)).status,200);
});
test('temporary passwords expire after seven days; errors do not expose account existence',async()=>{
  const e=await setup();await create(e);const wrong=await login(e,'owner-a@gmail.com','wrong'),unknown=await login(e,'missing@example.com','wrong');
  assert.deepEqual(wrong,unknown);e.advance(7*86400000);assert.deepEqual(await login(e),wrong);
});
test('normal password changes require the current password and invalidate other password sessions',async()=>{
  const e=await setup();await create(e);const initial=await login(e);await e.call('change_password',{password:permanent},initial.body.token);
  const second=await login(e,'owner-a@gmail.com',permanent),replacement='Another strong password 16';
  assert.equal((await e.call('change_password',{password:replacement,currentPassword:'incorrect'},second.body.token)).status,403);
  assert.equal((await e.call('change_password',{password:replacement,currentPassword:permanent},second.body.token)).status,200);
  assert.equal((await e.call('list',{},initial.body.token)).status,401);assert.equal((await e.call('list',{},second.body.token)).status,200);
  for(const action of ['create_account','owner_accounts','set_owner_password','set_owner_active','publish','create_invitation'])assert.equal((await e.call(action,{},second.body.token)).status,400);
  assert.equal((await e.call('list',{},second.body.token,'admin')).status,401);
  const result=await e.call('owner_accounts',{},e.admin,'admin');assert.equal(result.status,200);assert.equal(result.body.accounts[0].temporaryPassword,false);
  assert.doesNotMatch(JSON.stringify(result.body),/salt|password_version|passwordSetBy|Another strong/);
});
test('password login rate limits apply to both IP and email before verifying credentials',async()=>{
  const e=await setup();await create(e);const keys=[];e.repository.allow=async(key,limit)=>{keys.push({key,limit});return !key.startsWith('owner-password:');};
  assert.equal((await login(e)).status,429);assert.deepEqual(keys.map(k=>k.limit),[40,12]);assert.doesNotMatch(JSON.stringify(keys),/owner-a@gmail/);
});
test('password login remains available without configuring Google',async()=>{
  const e=await setup();await create(e);const handler=createOwnerHandler({...e.options,config:{...e.options.config,googleClientId:''}});
  const response=await handler(new Request('https://backend.example/api/owner',{method:'POST',body:JSON.stringify({action:'login_password',email:'owner-a@gmail.com',password:temporary})}));assert.equal(response.status,200);
});
test('registering an email enables Google without creating or replacing a password, or reactivating access',async()=>{
  const e=await setup();const results=await Promise.all([e.register('new-person',e.admin),e.register('new-person',e.admin)]);
  assert.ok(results.every(r=>r.status===200));assert.equal((await e.repository.ownerAccounts()).length,1);
  let signed=await e.login('new-person');assert.equal(signed.status,200);
  assert.equal((await login(e,'new-person@gmail.com')).status,401);
  await create(e,'new-person@gmail.com');signed=await login(e,'new-person@gmail.com');
  const subject=e.auth.get('owner-session/'+hash(signed.body.token)).subject,id=hash(subject),before=structuredClone(e.portal.get('accounts/'+id));
  await e.register('new-person',e.admin);assert.deepEqual(e.portal.get('accounts/'+id),before);
  await e.call('set_owner_active',{id,active:false},e.admin,'admin');
  assert.equal((await e.register('new-person',e.admin)).body.active,false);assert.equal((await e.login('new-person')).status,403);
  assert.equal(e.emails.length,0);
});
