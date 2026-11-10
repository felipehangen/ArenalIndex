import test from 'node:test';
import assert from 'node:assert/strict';
import {saveToAccount,accountKey} from '../site/newlisting/account.mjs';
import {completeDraft} from './intake-fixtures.mjs';
test('saving to an account reuses existing files, uploads new bytes and recovers a lost commit response',async()=>{
  const draft=completeDraft();draft.cloud={version:3,editRevision:4,dirty:true};draft.files.forEach((file,i)=>file.remote=i>0);
  const calls=[];let commitCalls=0,uploads=0;
  const account={async request(action,body){calls.push({action,body});if(action==='save_prepare')return {transaction:'a'.repeat(64),uploads:[{id:draft.files[0].id,url:'https://files.example/upload'}]};
    if(commitCalls++===0)throw Error('Lost response');return {version:4,editRevision:5,status:'draft'};}};
  await saveToAccount(draft,account,()=>{},async(url,options)=>{uploads++;assert.equal(options.body,draft.files[0].blob);return new Response('',{status:200});});
  assert.equal(uploads,1);assert.equal(commitCalls,2);assert.equal(calls[0].body.reuse.length,4);assert.ok(!('blob' in calls[0].body.draft.files[0]));
  assert.deepEqual(draft.cloud,{version:4,editRevision:5,dirty:false});assert.ok(draft.files.every(f=>f.remote));
});
test('a failed upload never commits or clears unsaved changes, and local account drafts use separate keys',async()=>{
  const draft=completeDraft();draft.cloud={version:1,editRevision:1,dirty:true};const calls=[];
  await assert.rejects(()=>saveToAccount(draft,{async request(action){calls.push(action);return {transaction:'a'.repeat(64),uploads:[{id:draft.files[0].id,url:'https://files.example/upload'}]};}},()=>{},async()=>new Response('',{status:500})));
  assert.deepEqual(calls,['save_prepare']);assert.equal(draft.cloud.dirty,true);assert.notEqual(accountKey('owner','a@gmail.com',draft.id),accountKey('owner','b@gmail.com',draft.id));assert.notEqual(accountKey('admin','a@gmail.com',draft.id),accountKey('owner','a@gmail.com',draft.id));
});
