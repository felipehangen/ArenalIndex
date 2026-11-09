import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../server/intake/core.mjs';
import {completeDraft,png,pdf} from './intake-fixtures.mjs';
const seller='a'.repeat(64),other='b'.repeat(64);
function environment({emailFails=false,invalidFile=false}={}){
  const rows=new Map(),emails=[];
  const repository={
    async health(){return true;},async allow(){return true;},
    async get(id){return structuredClone(rows.get(id)||null);},
    async create(row){if(rows.has(row.id))return null;rows.set(row.id,structuredClone(row));return structuredClone(row);},
    async update(id,filters,patch){
      const row=rows.get(id);if(!row||Object.entries(filters).some(([k,v])=>row[k]!==v))return null;
      Object.assign(row,structuredClone(patch));return structuredClone(row);
    },
    async uploadURL(path){return 'https://storage.example/upload/'+path;},
    async downloadURL(path){return 'https://storage.example/private/'+path;},
    async inspectFile(path,file){return {size:file.size,bytes:invalidFile?new Uint8Array([0,0]):file.type==='application/pdf'?pdf:png};}
  };
  const mailer={async send(message){emails.push(message);if(emailFails)throw Error('Email unavailable');}};
  const handler=createHandler({repository,mailer,config:{emailReady:true,reviewEmail:'reviewer@example.com',reviewSecret:'server-secret-with-enough-randomness',rateSalt:'salt',siteURL:'https://arenalindex.com'},now:()=>new Date('2026-11-09T12:00:00Z')});
  async function call(action,body={},token=seller,review=false){
    const response=await handler(new Request('https://backend.example/intake',{method:'POST',headers:{Origin:'https://arenalindex.com','Content-Type':'application/json',[review?'X-Review-Token':'X-Intake-Token']:token},body:JSON.stringify({action,...body})}));
    return {status:response.status,body:await response.json()};
  }
  return {rows,emails,call,handler};
}
const clean=d=>({...d,files:d.files.map(({blob,...f})=>f)});
async function submit(e){
  const d=clean(completeDraft()),prepared=await e.call('prepare',{draft:d});
  assert.equal(prepared.status,200);
  const result=await e.call('submit',{id:d.id,version:prepared.body.version});
  return {d,version:prepared.body.version,result,reviewToken:e.emails[0]?new URLSearchParams(new URL(e.emails[0].url).hash.slice(1)).get('token'):null};
}
test('the complete private workflow stores, emails, previews and approves one specific version',async()=>{
  const e=environment(),{d,version,result,reviewToken}=await submit(e);
  assert.equal(result.body.status,'ready_for_review');assert.equal(e.emails.length,1);
  const preview=await e.call('review',{id:d.id},reviewToken,true);
  assert.equal(preview.status,200);assert.equal(preview.body.draft.files.length,5);assert.ok(!('token_hash' in preview.body));
  const decision=await e.call('approve',{id:d.id,version,review:{plan_number:'A-123',documented_area:1000,plan_matches:true,copy_checked:true}},reviewToken,true);
  assert.equal(decision.body.status,'approved');assert.equal(e.rows.get(d.id).reviewed_by,'reviewer@example.com');
});
test('another seller or an invented review link cannot access private files or approve',async()=>{
  const e=environment(),{d,version}=await submit(e);
  assert.equal((await e.call('status',{id:d.id},other)).status,403);
  assert.equal((await e.call('review',{id:d.id},other,true)).status,403);
  assert.equal((await e.call('approve',{id:d.id,version},seller,true)).status,403);
});
test('reopening invalidates approval and the earlier review link before edits are allowed',async()=>{
  const e=environment(),{d,version,reviewToken}=await submit(e);
  assert.equal((await e.call('reopen',{id:d.id,version})).body.status,'draft');
  assert.equal((await e.call('review',{id:d.id},reviewToken,true)).status,403);
  const next=await e.call('prepare',{draft:d});assert.equal(next.body.version,version+1);
  assert.equal((await e.call('submit',{id:d.id,version})).status,409);
});
test('approval enforces documented area and permits a photo exception only when explicitly accepted',async()=>{
  const e=environment(),d=clean(completeDraft());d.files=d.files.filter(f=>f.id!=='road-1');d.values.photo_exception='No se pudo fotografiar la vía.';
  const prepared=await e.call('prepare',{draft:d});await e.call('submit',{id:d.id,version:prepared.body.version});
  const token=new URLSearchParams(new URL(e.emails[0].url).hash.slice(1)).get('token');
  const review={plan_number:'A-123',documented_area:900,plan_matches:true,copy_checked:true};
  assert.equal((await e.call('approve',{id:d.id,version:1,review},token,true)).status,422);
  review.discrepancy_resolved=true;review.photo_exception_accepted=true;
  assert.equal((await e.call('approve',{id:d.id,version:1,review},token,true)).body.status,'approved');
});
test('damaged or incomplete storage objects never become ready for review',async()=>{
  const e=environment({invalidFile:true}),{d,result}=await submit(e);
  assert.equal(result.status,422);assert.equal(e.rows.get(d.id).status,'draft');assert.equal(e.emails.length,0);
});
test('an email failure preserves the received submission and retries use the same message key',async()=>{
  const e=environment({emailFails:true}),{d,version,result}=await submit(e);
  assert.equal(result.body.status,'ready_for_review');assert.equal(result.body.notificationSent,false);
  await e.call('submit',{id:d.id,version});assert.equal(e.emails.length,2);
  assert.equal(e.emails[0].idempotencyKey,e.emails[1].idempotencyKey);assert.equal(e.emails[0].url,e.emails[1].url);
});
test('GET links and unapproved origins cannot change workflow state',async()=>{
  const e=environment();
  assert.equal((await e.handler(new Request('https://backend.example/intake'))).status,405);
  assert.equal((await e.handler(new Request('https://backend.example/intake',{method:'POST',headers:{Origin:'https://attacker.example'},body:'{}'}))).status,403);
});
