import test from 'node:test';
import assert from 'node:assert/strict';
import {BlobPreconditionFailedError} from '@vercel/blob';
import {createRepository} from '../server/intake/blob.mjs';
function setup(){
  const rows=new Map(),calls=[];let sequence=0;
  const sdk={
    async list({prefix,limit=1000,cursor}){const paths=[...rows.keys()].filter(path=>path.startsWith(prefix)),start=Number(cursor||0);return {blobs:paths.slice(start,start+limit).map(path=>({pathname:path})),hasMore:paths.length>start+limit,cursor:String(start+limit)};},
    async get(path,options){
      assert.equal(options.access,'private');assert.equal(options.useCache,false);
      const data=rows.get(path);if(!data)return null;
      const compressed=data.text.length>1024&&options.headers?.['Accept-Encoding']!=='identity';
      return {stream:new Blob([data.text]).stream(),blob:{etag:compressed?'W/'+data.etag:data.etag,size:compressed?0:Buffer.byteLength(data.text),contentType:data.type}};
    },
    async put(path,text,options){
      assert.equal(options.access,'private');assert.equal(options.addRandomSuffix,false);
      const previous=rows.get(path);
      if(options.ifMatch&&previous?.etag!==options.ifMatch)throw new BlobPreconditionFailedError();
      if(previous&&!options.allowOverwrite)throw Error('Blob already exists');
      rows.set(path,{text,etag:String(++sequence),type:options.contentType});
    },
    async issueSignedToken(options){calls.push(options);return {delegationToken:'private'};},
    async presignUrl(token,options){calls.push(options);return {presignedUrl:'https://files.example/signed'};}
  };
  return {repository:createRepository({sdk,now:()=>100000}),rows,calls};
}
test('simultaneous updates cannot overwrite each other and stale approval filters fail',async()=>{
  const {repository}=setup();await repository.create({id:'submission-1',version:1,status:'ready_for_review'});
  const results=await Promise.all(['approved','draft'].map(status=>repository.update('submission-1',{version:1,status:'ready_for_review'},{status})));
  assert.equal(results.filter(Boolean).length,1);
  assert.equal(await repository.update('submission-1',{version:1,status:'ready_for_review'},{status:'approved'}),null);
  assert.equal(await repository.create({id:'submission-1',status:'draft'}),null);
});
test('parallel rate-limit requests cannot exceed the limit',async()=>{
  const {repository,rows}=setup();
  const results=await Promise.all(Array.from({length:5},()=>repository.allow('private-token-value',2)));
  assert.equal(results.filter(Boolean).length,2);assert.ok([...rows.keys()].every(k=>!k.includes('private-token-value')));
});
test('compressible records retain strong validators and files retain their original size',async()=>{
  const {repository,rows}=setup();
  await repository.create({id:'large-record',version:0,status:'draft',notes:'seller information '.repeat(200)});
  const updated=await repository.update('large-record',{version:0,status:'draft'},{version:1});
  assert.equal(updated?.version,1);
  const text='%PDF-1.4 '+'.'.repeat(4096);
  rows.set('files/large-record/1/plan',{text,etag:'document',type:'application/pdf'});
  const file=await repository.inspectFile('large-record/1/plan',{size:Buffer.byteLength(text),type:'application/pdf'});
  assert.equal(file?.size,Buffer.byteLength(text));assert.equal(file.bytes.length,32);
});
test('upload capabilities are private, immutable and restricted to one path, content type and size',async()=>{
  const {repository,calls}=setup();await repository.uploadURL('submission-1/1/file-1',{size:1200,type:'image/png'});
  assert.equal(calls[0].pathname,'files/submission-1/1/file-1');assert.deepEqual(calls[0].operations,['put']);
  for(const call of calls){assert.equal(call.maximumSizeInBytes,1200);assert.deepEqual(call.allowedContentTypes,['image/png']);}
  assert.equal(calls[1].allowOverwrite,false);assert.equal(calls[1].access,'private');
});
test('file inspection checks actual MIME and size and reads only the needed signature',async()=>{
  const {repository,rows}=setup();rows.set('files/a/1/b',{text:'%PDF-1.4 example',etag:'1',type:'application/pdf'});
  const result=await repository.inspectFile('a/1/b',{size:17,type:'application/pdf'});assert.equal(result,null);
  const valid=await repository.inspectFile('a/1/b',{size:16,type:'application/pdf'});assert.equal(new TextDecoder().decode(valid.bytes),'%PDF-1.4 example');
  assert.equal(await repository.inspectFile('a/1/b',{size:16,type:'image/png'}),null);
});
test('the discovery index exposes only committed public snapshots and withdrawal is immediately reflected',async()=>{
  const {repository}=setup();
  await repository.create({id:'listing-private',status:'approved',version:1,payload:{private:'secret'}});
  await repository.ensurePublishedIndex('listing-private');
  assert.deepEqual(await repository.published(),[]);
  await repository.update('listing-private',{version:1},{publication:{listing:{id:'public-1',name:'Approved title'}}});
  assert.deepEqual(await repository.published(),[{id:'public-1',name:'Approved title'}]);
  await repository.update('listing-private',{version:1},{publication:null});
  assert.deepEqual(await repository.published(),[]);
});
test('auth challenges are consumed atomically, sessions revoke atomically, and invalid auth paths fail',async()=>{
  const {repository}=setup(),id='a'.repeat(64);
  await repository.authCreate('challenge',id,{used:false,expiresAt:200000});
  const results=await Promise.all([1,2].map(()=>repository.authUpdate('challenge',id,{used:false},{used:true})));
  assert.equal(results.filter(Boolean).length,1);assert.equal((await repository.authGet('challenge',id)).used,true);
  await repository.authCreate('session',id,{revoked:false});await repository.authUpdate('session',id,{revoked:false},{revoked:true});
  assert.equal((await repository.authGet('session',id)).revoked,true);
  await assert.rejects(()=>repository.authCreate('session',id,{}));
  for(const method of ['authGet','authCreate','authUpdate'])await assert.rejects(()=>repository[method]('../records','bad',{},{}));
});
test('administrator record pages include only intake records and support more than 50 submissions',async()=>{
  const {repository}=setup();
  for(let i=0;i<53;i++)await repository.create({id:'property-'+String(i).padStart(3,'0'),status:'draft'});
  await repository.authCreate('session','a'.repeat(64),{email:'private@example.com'});
  const first=await repository.records();assert.equal(first.records.length,50);assert.ok(first.cursor);
  const second=await repository.records(first.cursor);assert.equal(second.records.length,3);assert.equal(second.cursor,null);
  assert.equal(new Set([...first.records,...second.records].map(r=>r.id)).size,53);
});
test('owner indexes cannot expose other owners records, and account and invitation records use conditional writes',async()=>{
  const {repository}=setup(),id='a'.repeat(64);
  await repository.create({id:'owned-property-a',owner_subject:'owner-a'});await repository.create({id:'owned-property-b',owner_subject:'owner-b'});
  await repository.ensureOwnerIndex('owner-a','owned-property-a');await repository.ensureOwnerIndex('owner-a','owned-property-b');
  assert.deepEqual((await repository.ownerRecords('owner-a')).records.map(r=>r.id),['owned-property-a']);
  await repository.portalCreate('invites',id,{id,active:true,label:'Test'});
  const changes=await Promise.all([1,2].map(()=>repository.portalUpdate('invites',id,{active:true},{active:false})));
  assert.equal(changes.filter(Boolean).length,1);assert.equal((await repository.invitations())[0].active,false);
  await assert.rejects(()=>repository.portalGet('../records',id));assert.equal(await repository.portalCreate('invites',id,{}),null);
});
