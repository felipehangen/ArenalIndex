import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import * as blob from '@vercel/blob';
import {createRepository} from '../server/intake/blob.mjs';
import {storageRequest} from '../server/intake/storage-request.mjs';
import {createAdminHandler} from '../server/admin/core.mjs';
const silent=()=>{},pending=()=>new Promise(()=>{});
const timedOut=error=>error.status===503&&error.code==='storage_timeout';

test('hanging index requests are bounded, retried once and cancelled with AbortError',{timeout:2000},async()=>{
  const signals=[],events=[];
  const repository=createRepository({timeoutMs:20,diagnostic:event=>events.push(event),sdk:{list:options=>{signals.push(options.abortSignal);return pending();}}});
  await assert.rejects(()=>repository.records(),timedOut);
  assert.equal(signals.length,2);assert.ok(signals.every(signal=>signal.aborted&&signal.reason.name==='AbortError'));
  assert.deepEqual(events.map(event=>[event.collection,event.outcome,event.attempt]),[['records','timeout',1],['records','timeout',2]]);
});
test('a transient read recovers using a fresh signal without exposing a private path',{timeout:2000},async()=>{
  const signals=[],events=[];
  const repository=createRepository({timeoutMs:20,diagnostic:event=>events.push(event),sdk:{get:async(path,options)=>{
    signals.push(options.abortSignal);if(signals.length===1)return pending();
    assert.equal(options.useCache,false);assert.equal(options.headers['Accept-Encoding'],'identity');
    return {stream:new Blob(['{"revoked":true}']).stream(),blob:{etag:'strong'}};
  }}});
  assert.deepEqual(await repository.authGet('session','a'.repeat(64)),{revoked:true});
  assert.equal(signals.length,2);assert.equal(signals[0].aborted,true);assert.equal(signals[1].aborted,false);
  assert.equal(events[0].collection,'admin/session');assert.ok(!JSON.stringify(events).includes('a'.repeat(64)));
});
test('the deadline includes stalled response bodies, not just response headers',{timeout:2000},async()=>{
  let cancellations=0;
  const repository=createRepository({timeoutMs:20,diagnostic:silent,sdk:{get:async(path,{abortSignal})=>({
    stream:new ReadableStream({start(controller){abortSignal.addEventListener('abort',()=>{cancellations++;controller.error(abortSignal.reason);},{once:true});}}),blob:{etag:'1'}
  })}});
  await assert.rejects(()=>repository.get('private-record'),timedOut);assert.equal(cancellations,2);
});
test('ambiguous writes and signed-token requests time out without an application retry',{timeout:2000},async()=>{
  let puts=0,signs=0;
  const repository=createRepository({timeoutMs:20,diagnostic:silent,sdk:{put:()=>{puts++;return pending();},issueSignedToken:()=>{signs++;return pending();}}});
  await assert.rejects(()=>repository.create({id:'private-record'}),timedOut);assert.equal(puts,1);
  await assert.rejects(()=>repository.downloadURL('private-record/photo'),timedOut);assert.equal(signs,1);
});
test('an exhausted request budget prevents further storage calls and mutations',{timeout:2000},async()=>{
  let reads=0,writes=0;
  const repository=createRepository({timeoutMs:100,deadline:Date.now()+25,diagnostic:silent,sdk:{get:()=>{reads++;return pending();},put:()=>{writes++;}}});
  await assert.rejects(()=>repository.allow('private-session',30),timedOut);
  await assert.rejects(()=>repository.authCreate('challenge','a'.repeat(64),{used:false}),timedOut);
  assert.equal(reads,1);assert.equal(writes,0);
});
test('stalled login storage returns a recoverable JSON error without issuing a challenge',{timeout:2000},async()=>{
  let writes=0;
  const repository=createRepository({timeoutMs:20,diagnostic:silent,sdk:{get:pending,put:()=>{writes++;}}});
  const handler=createAdminHandler({repository,config:{googleClientId:'test',adminEmails:['admin@example.com'],rateSalt:'test'}});
  const response=await handler(new Request('https://example.com/admin',{method:'POST',body:JSON.stringify({action:'challenge'})}));
  assert.equal(response.status,503);assert.match((await response.json()).error,/Intentá de nuevo/);assert.equal(writes,0);
});
test('Blob SDK stops on our AbortError instead of retrying an expired TimeoutError',{timeout:2500},async()=>{
  // Use the SDK's own HTTP transport, with all network access disabled.
  const {MockAgent,getGlobalDispatcher,setGlobalDispatcher}=createRequire(import.meta.resolve('@vercel/blob'))('undici');
  const previous=getGlobalDispatcher(),agent=new MockAgent();agent.disableNetConnect();setGlobalDispatcher(agent);
  agent.get('https://vercel.com').intercept({path:/\/api\/blob/,method:'PUT'}).reply(200,{}).delay(150);
  let operation;
  const run=storageRequest({timeoutMs:20,diagnostic:silent});
  try{
    await assert.rejects(()=>run('write','records',signal=>{
      operation=blob.put('records/test.json','{}',{token:'vercel_blob_rw_teststore_test',access:'private',addRandomSuffix:false,abortSignal:signal});
      return operation;
    }),timedOut);
    await assert.rejects(operation,error=>error instanceof blob.BlobRequestAbortedError);
  }finally{setGlobalDispatcher(previous);await agent.close();}
});
