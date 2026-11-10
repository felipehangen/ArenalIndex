import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createAdminHandler,recordSummary} from '../server/admin/core.mjs';
import {createHandler} from '../server/intake/core.mjs';
import {approvedRow,editorial} from './publication-fixture.mjs';
const email='felipehangen@gmail.com';
const hash=value=>createHash('sha256').update(value).digest('hex');
function environment({configured=true}={}){
  const auth=new Map(),rows=new Map(),signed=[];let clock=Date.parse('2026-11-09T12:00:00Z'),limited=false;
  const repository={
    async allow(){return !limited;},
    async authCreate(kind,id,row){auth.set(kind+'/'+id,structuredClone(row));},
    async authGet(kind,id){return structuredClone(auth.get(kind+'/'+id)||null);},
    async authUpdate(kind,id,filters,patch){const row=auth.get(kind+'/'+id);if(!row||Object.entries(filters).some(([k,v])=>row[k]!==v))return null;Object.assign(row,patch);return structuredClone(row);},
    async records(cursor){assert.ok(!cursor||cursor==='page-2');return {records:[...rows.values()],cursor:null};},
    async get(id){return structuredClone(rows.get(id)||null);},
    async update(id,filters,patch){const row=rows.get(id);if(!row||Object.entries(filters).some(([k,v])=>row[k]!==v))return null;Object.assign(row,structuredClone(patch));return structuredClone(row);},
    async downloadURL(path){signed.push(path);return 'https://files.example/'+path;},
    async ensurePublishedIndex(){}
  };
  const options={repository,config:{googleClientId:configured?'google-client':'',adminEmails:[email],rateSalt:'test-salt',siteURL:'https://arenalindex.com',publicAPIURL:'https://backend.example/api/listings',reviewEmail:'different-reviewer@example.com'},now:()=>new Date(clock),verifyGoogle:async credential=>{
    if(credential==='invalid')throw Error('Provider failure with private details');
    return {email:credential==='valid'?email:'stranger@example.com',subject:'google-account'};
  }};
  const handler=createAdminHandler(options);
  async function call(action,body={},token,extra={}){
    const response=await handler(new Request('https://backend.example/api/admin',{method:'POST',headers:{Origin:'https://arenalindex.com','Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...extra},body:JSON.stringify({action,...body})}));
    return {status:response.status,headers:response.headers,body:await response.json()};
  }
  async function login(){const challenge=await call('challenge');const result=await call('login',{nonce:challenge.body.nonce,credential:'valid'});assert.equal(result.status,200);return result.body.token;}
  return {auth,rows,signed,repository,options,handler,call,login,advance:ms=>clock+=ms,limit:()=>limited=true};
}

test('anonymous configuration is public but records and every review action require a valid session',async()=>{
  const e=environment();assert.deepEqual((await e.call('config')).body,{configured:true,clientId:'google-client'});
  for(const action of ['list','session','review','approve','request_changes','publish','unpublish','preview_publication']){
    assert.equal((await e.call(action,{email,isAdmin:true},undefined,{'X-Admin-Email':email,'X-Review-Token':'a'.repeat(64)})).status,401);
    assert.equal((await e.call(action,{},'a'.repeat(64))).status,401);
  }
  const disabled=environment({configured:false});assert.deepEqual((await disabled.call('config')).body,{configured:false,clientId:null});assert.equal((await disabled.call('challenge')).status,503);
});
test('Google login binds a single-use challenge and allows only the configured administrator',async()=>{
  const e=environment(),{body:{nonce}}=await e.call('challenge');
  assert.equal((await e.call('login',{nonce,credential:'invalid'})).status,401);
  assert.equal((await e.call('login',{nonce,credential:'stranger',email})).status,403);
  assert.equal((await e.call('login',{nonce:'a'.repeat(64),credential:'valid'})).status,401);
  const results=await Promise.all([e.call('login',{nonce,credential:'valid'}),e.call('login',{nonce,credential:'valid'})]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,401]);
  const identity=results.find(r=>r.status===200).body;
  assert.ok(e.auth.has('session/'+hash(identity.token)));assert.doesNotMatch(JSON.stringify([...e.auth]),new RegExp(identity.token));
  assert.equal((await e.call('session',{},identity.token)).body.email,email);
  assert.equal(identity.expiresAt-Date.parse('2026-11-09T12:00:00Z'),8*3600000);
});
test('expired challenges and sessions, revoked sessions, and removed allowlist entries cannot access records',async()=>{
  const e=environment(),{body:{nonce}}=await e.call('challenge');e.advance(10*60000);
  assert.equal((await e.call('login',{nonce,credential:'valid'})).status,401);
  const token=await e.login();assert.equal((await e.call('logout',{},token)).body.signedOut,true);assert.equal((await e.call('list',{},token)).status,401);
  const next=await e.login();
  const restricted=createAdminHandler({...e.options,config:{...e.options.config,adminEmails:['another@example.com']}});
  assert.equal((await restricted(new Request('https://backend.example/api/admin',{method:'POST',headers:{Authorization:'Bearer '+next},body:JSON.stringify({action:'list'})}))).status,401);
  e.advance(8*3600000);assert.equal((await e.call('list',{},next)).status,401);
});
test('failed server revocation is reported rather than claiming a successful sign-out',async()=>{
  const e=environment(),token=await e.login();e.repository.authUpdate=async()=>null;
  assert.equal((await e.call('logout',{},token)).status,503);
});
test('CORS, HTTP method, body bounds and rate limits are enforced without leaking internals',async()=>{
  const e=environment();
  assert.equal((await e.call('config',{},undefined,{Origin:'https://attacker.example'})).status,403);
  assert.equal((await e.handler(new Request('https://backend.example/api/admin'))).status,405);
  const options=await e.handler(new Request('https://backend.example/api/admin',{method:'OPTIONS',headers:{Origin:'https://arenalindex.com'}}));
  assert.equal(options.status,204);assert.match(options.headers.get('Access-Control-Allow-Headers'),/authorization/);
  assert.equal((await e.call('config',{data:'x'.repeat(250000)})).status,413);
  e.limit();assert.equal((await e.call('challenge')).status,429);
});
test('inbox pages return summaries without tokens, private files or document details',async()=>{
  const e=environment(),row=approvedRow();row.token_hash='SECRET-TOKEN';row.review_token_hash='REVIEW-SECRET';row.editorial=editorial;row.payload.values.email='private-contact@example.com';e.rows.set(row.id,row);
  const result=await e.call('list',{cursor:'page-2'},await e.login());
  assert.equal(result.status,200);assert.equal(result.headers.get('Cache-Control'),'no-store');assert.equal(result.headers.get('X-Robots-Tag'),'noindex, nofollow');
  assert.equal(result.body.records[0].title,editorial.title);assert.equal(result.body.records[0].email,'private-contact@example.com');
  assert.doesNotMatch(JSON.stringify(result.body),/SECRET|PRIVATE-PLAN|plan_file|token_hash|payload|files/);assert.equal(e.signed.length,0);
  assert.deepEqual(result.body.records[0],recordSummary(row));
});
test('an administrator can review expired email links and prepare, publish and withdraw an approved version',async()=>{
  const e=environment(),row=approvedRow();row.status='ready_for_review';row.review_token_hash='expired-link';row.review_token_expires='2020-01-01';e.rows.set(row.id,row);
  const token=await e.login(),body={id:row.id,version:row.version,publicationRevision:0,editorial,confirmed:true};
  const review=await e.call('review',{id:row.id},token);assert.equal(review.status,200);assert.equal(review.headers.get('X-Robots-Tag'),'noindex, nofollow');assert.ok(review.body.draft.files[0].url);
  assert.equal((await e.call('publish',body,token)).status,422);
  assert.equal((await e.call('approve',{...body,review:{}},token)).status,422);
  assert.equal((await e.call('approve',{...body,version:1,review:row.review},token)).status,409);
  assert.equal((await e.call('approve',{...body,review:row.review},token)).body.status,'approved');assert.equal(e.rows.get(row.id).reviewed_by,email);
  const preview=await e.call('preview_publication',body,token);assert.equal(preview.status,200);assert.ok(preview.body.listing.images.length);assert.ok(!e.rows.get(row.id).publication);
  assert.equal((await e.call('publish',{...body,confirmed:false},token)).status,422);
  assert.equal((await e.call('publish',body,token)).status,200);assert.equal(e.rows.get(row.id).published_by,email);
  assert.equal((await e.call('publish',body,token)).status,409);
  assert.equal((await e.call('unpublish',{...body,publicationRevision:1},token)).status,200);assert.equal(e.rows.get(row.id).publication,null);
});
test('change requests preserve feedback, drafts hide unfinished uploads, and forged headers never authorize intake',async()=>{
  const e=environment(),row=approvedRow();row.status='ready_for_review';e.rows.set(row.id,row);const token=await e.login();
  assert.equal((await e.call('request_changes',{id:row.id,version:row.version},token)).status,422);
  const changed=await e.call('request_changes',{id:row.id,version:row.version,feedback:'Revisar entrada.'},token);
  assert.equal(changed.body.status,'changes_requested');assert.equal(e.rows.get(row.id).reviewed_by,email);
  row.status='draft';const review=await e.call('review',{id:row.id},token);assert.deepEqual(review.body.draft.files,[]);assert.equal(e.signed.length,0);
  assert.equal((await e.call('approve',{id:row.id,version:row.version,review:row.review},token)).status,409);
  const intake=createHandler(e.options);
  const forged=await intake(new Request('https://backend.example/api/intake',{method:'POST',headers:{Authorization:'Bearer '+token,'X-Admin-Email':email},body:JSON.stringify({action:'review',id:row.id,isAdmin:true})}));
  assert.equal(forged.status,401);
});
test('a concurrent seller reopen prevents an administrator approving the outdated review',async()=>{
  const e=environment(),row=approvedRow();row.status='ready_for_review';row.review_token_hash='old';e.rows.set(row.id,row);
  const original=e.repository.update;e.repository.update=async(...args)=>{row.review_token_hash='new';return original(...args);};
  const result=await e.call('approve',{id:row.id,version:row.version,review:row.review},await e.login());
  assert.equal(result.status,409);assert.equal(row.status,'ready_for_review');
});
