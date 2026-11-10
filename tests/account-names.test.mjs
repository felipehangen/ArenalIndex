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

test('creation and renaming reject equivalent names, including legacy and inactive accounts',async()=>{
  const e=portalFixture(),admin=await e.adminSession();await e.register('legacy',admin);
  const first=(await e.call('owner_accounts',{},admin,'admin')).body.accounts[0];
  Object.assign(e.portal.get('accounts/'+first.id),{name:'José  Realty',active:false});
  for(const name of ['José Realty','JOSE REALTY','  jose   realty  ','Jose\u0301 Realty','ＪＯＳＥ Realty']){
    const result=await e.call('create_account',{email:'other@gmail.com',name},admin,'admin');assert.equal(result.status,409);assert.match(result.body.error,/nombre ya está en uso/);
  }
  assert.equal((await e.repository.ownerAccounts()).length,1);
  await e.register('second',admin);const second=(await e.call('owner_accounts',{},admin,'admin')).body.accounts.find(row=>row.email==='second@gmail.com');
  assert.equal((await e.call('set_owner_name',{id:second.id,name:'jose realty',nameVersion:0},admin,'admin')).status,409);
  assert.equal((await e.call('set_owner_password',{email:'second@gmail.com',name:'jose realty',password:'Temporary password 123'},admin,'admin')).status,409);
  assert.equal(e.portal.get('accounts/'+second.id).password,undefined);
  assert.equal((await e.call('set_owner_name',{id:first.id,name:'José Realty',nameVersion:0},admin,'admin')).status,200);
});

test('simultaneous claims allow exactly one account; renamed names become available again',async()=>{
  const e=portalFixture(),admin=await e.adminSession();
  const results=await Promise.all(['first','second'].map(email=>e.call('create_account',{email:email+'@gmail.com',name:'Shared Name'},admin,'admin')));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  const row=(await e.call('owner_accounts',{},admin,'admin')).body.accounts[0];
  assert.equal((await e.call('set_owner_name',{id:row.id,name:'New Name',nameVersion:row.nameVersion},admin,'admin')).status,200);
  assert.equal((await e.call('create_account',{email:'third@gmail.com',name:'shared name'},admin,'admin')).status,200);
});

test('simultaneous renames reserve one target, and failed version writes release their reservation',async()=>{
  const e=portalFixture(),admin=await e.adminSession();await e.register('first',admin);await e.register('second',admin);
  const rows=(await e.call('owner_accounts',{},admin,'admin')).body.accounts;
  const results=await Promise.all(rows.map(row=>e.call('set_owner_name',{id:row.id,name:'Shared',nameVersion:0},admin,'admin')));assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  const update=e.repository.portalUpdate;e.repository.portalUpdate=async(kind,id,filters,patch)=>kind==='accounts'&&patch.name==='Rejected'?null:update(kind,id,filters,patch);
  const loser=rows[results.findIndex(r=>r.status===409)];assert.equal((await e.call('set_owner_name',{id:loser.id,name:'Rejected',nameVersion:0},admin,'admin')).status,409);
  e.repository.portalUpdate=update;assert.equal((await e.call('create_account',{email:'third@gmail.com',name:'Rejected'},admin,'admin')).status,200);
});
