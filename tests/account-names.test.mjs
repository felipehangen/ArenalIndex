import test from 'node:test';
import assert from 'node:assert/strict';
import {portalFixture,hash} from './portal-fixture.mjs';

test('renaming preserves identity, session, rules receipt, and listings; stale edits are rejected',async()=>{
  const e=portalFixture(),admin=await e.adminSession();
  assert.equal((await e.call('create_account',{email:'agent@gmail.com',name:'  Arenal Homes  '},admin,'admin')).status,200);
  const signed=await e.login('agent'),subject=e.auth.get('owner-session/'+hash(signed.body.token)).subject,id=hash(subject);
  e.rows.set('listing-01',{id:'listing-01',owner_subject:subject,payload:{values:{listing_title:'Test property'},files:[]},status:'draft'});
  const before=structuredClone(e.portal.get('accounts/'+id));
  const row=(await e.call('owner_accounts',{},admin,'admin')).body.accounts[0];assert.equal(row.name,'Arenal Homes');
  const edit={id,name:'Arenal Properties',nameVersion:row.nameVersion};
  assert.equal((await e.call('set_owner_name',edit,signed.body.token)).status,400);
  assert.equal((await e.call('set_owner_name',edit,admin,'admin')).status,200);
  const after=e.portal.get('accounts/'+id);assert.equal(after.name,'Arenal Properties');
  for(const key of Object.keys(before).filter(key=>!['name','name_version','updatedBy'].includes(key)))assert.deepEqual(after[key],before[key]);
  assert.equal((await e.call('list',{},signed.body.token)).body.records[0].id,'listing-01');
  assert.equal((await e.call('set_owner_name',{...edit,name:'Stale'},admin,'admin')).status,409);
  assert.equal(e.portal.get('accounts/'+id).name,'Arenal Properties');
});

test('legacy accounts can gain names and invalid names never create accounts',async()=>{
  const e=portalFixture(),admin=await e.adminSession();await e.register('legacy',admin);
  const row=(await e.call('owner_accounts',{},admin,'admin')).body.accounts[0];assert.equal(row.name,'');assert.equal(row.nameVersion,0);
  for(const name of ['', '   ', 'a'.repeat(101), 'bad\nname', 42])assert.equal((await e.call('create_account',{email:'invalid@gmail.com',name},admin,'admin')).status,422);
  assert.equal((await e.repository.ownerAccounts()).length,1);
  assert.equal((await e.call('set_owner_name',{id:row.id,name:'José & Asociados',nameVersion:0},admin,'admin')).status,200);
  await e.register('legacy',admin);assert.equal((await e.call('owner_accounts',{},admin,'admin')).body.accounts[0].name,'José & Asociados');
  assert.equal((await e.call('set_owner_password',{email:'legacy@gmail.com',name:'Agency',password:'Temporary password 123'},admin,'admin')).status,200);
  const updated=(await e.call('owner_accounts',{},admin,'admin')).body.accounts[0];assert.equal(updated.name,'Agency');assert.equal(updated.password,true);
});
