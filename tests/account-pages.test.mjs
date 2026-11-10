import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {publicAccountKey,publicAccountProfile,ensureAccountSlug} from '../server/portal/public-page.mjs';
import {createPublicHandler} from '../server/intake/public.mjs';
import {portalFixture} from './portal-fixture.mjs';
import {sampleListing} from './publication-fixture.mjs';

const account={subject:'private-subject',email:'private@example.com',name:'Arenal Homes',active:true,password:{hash:'PRIVATE-PASSWORD'}};
const key=publicAccountKey(account);
const request=(handler,value=key)=>handler(new Request('https://api.example/api/listings?catalog=1&account='+value));

test('public account key is stable across name and email changes; inactive and unnamed profiles are hidden',()=>{
  assert.equal(publicAccountKey({...account,name:'New name',email:'new@example.com'}),key);
  assert.notEqual(publicAccountKey({...account,subject:'another-subject'}),key);
  assert.equal(publicAccountProfile({...account,active:false}),null);
  assert.equal(publicAccountProfile({...account,name:''}),null);
  assert.deepEqual(Object.keys(publicAccountProfile(account)),['key','slug','name','url']);
});

test('public endpoint scopes all pages by immutable ownership and returns only current published snapshots',async()=>{
  const listing=sampleListing(),calls=[];
  const repository={ownerAccounts:async()=>[account],async ownerRecords(subject,cursor){
    calls.push([subject,cursor]);
    return !cursor?{records:[
      {owner_subject:account.subject,status:'draft',payload:{name:'PRIVATE-DRAFT'},publication:{listing}},
      {owner_subject:'other',publication:{listing:{...listing,id:'wrong-account'}}},
      {owner_subject:account.subject,status:'draft',payload:{name:'NEVER-PUBLISHED'}},
      {owner_subject:account.subject,status:'deleted',publication:{listing:{...listing,id:'deleted-property'}}}
    ],cursor:'next'}:{records:[{owner_subject:account.subject,status:'approved',publication:{listing:{...listing,id:'second-property'}}}],cursor:null};
  },published:async()=>{throw Error('Must not fetch full catalog');}};
  const handler=createPublicHandler(repository,{catalog:{published:async subject=>{assert.equal(subject,account.subject);return [];}}});
  const response=await request(handler),data=await response.json();
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  assert.deepEqual(data.listings.map(row=>row.id),[listing.id,'second-property']);
  assert.deepEqual(calls,[[account.subject,undefined],[account.subject,'next']]);
  const serialized=JSON.stringify(data);
  for(const privateValue of ['private@example.com','private-subject','PRIVATE-PASSWORD','PRIVATE-DRAFT','NEVER-PUBLISHED','wrong-account','deleted-property'])assert.ok(!serialized.includes(privateValue),privateValue);
  assert.deepEqual(data.listings[0].details.contact,listing.details.contact);
});

test('unknown, inactive, invalid and unnamed accounts never fall back to the full catalog; empty accounts succeed',async()=>{
  for(const entry of [null,{...account,active:false},{...account,name:''}]){
    const handler=createPublicHandler({ownerAccounts:async()=>entry?[entry]:[],published:async()=>{throw Error('No fallback');}});
    assert.equal((await request(handler)).status,404);
  }
  const handler=createPublicHandler({ownerAccounts:async()=>[account],ownerRecords:async()=>({records:[],cursor:null})});
  for(const invalid of ['', 'private@example.com', 'a-invalid'])assert.equal((await request(handler,invalid)).status,404);
  const response=await request(handler);assert.equal(response.status,200);assert.deepEqual((await response.json()).listings,[]);
  const unavailable=createPublicHandler({ownerAccounts:async()=>{throw Error('Storage unavailable');}});
  assert.equal((await request(unavailable)).status,503);
});

test('admin and account portal expose the same public URL and renaming keeps it valid',async()=>{
  const e=portalFixture(),admin=await e.adminSession();
  await e.call('create_account',{email:'broker@gmail.com',name:'Broker Homes'},admin,'admin');
  const first=(await e.call('owner_accounts',{},admin,'admin')).body.accounts[0];
  const signed=await e.login('broker');
  assert.equal(signed.body.publicPage.url,first.publicPage.url);
  await e.call('set_owner_name',{id:first.id,name:'Updated Broker',nameVersion:first.nameVersion},admin,'admin');
  const session=(await e.call('session',{},signed.body.token)).body;
  assert.equal(session.publicPage.url,first.publicPage.url);assert.equal(session.publicPage.name,'Updated Broker');
  assert.equal(session.publicPage.url,'https://go.arenalindex.com/collection/broker-homes/');
  const response=await request(createPublicHandler(e.repository),'broker-homes');
  assert.equal(response.status,200);assert.equal((await response.json()).account.name,'Updated Broker');
});

test('slug reservations distinguish punctuation collisions and simultaneous assignments, retaining old URLs',async()=>{
  const e=portalFixture(),admin=await e.adminSession();
  const created=await Promise.all(['A & B','A - B'].map((name,i)=>e.call('create_account',{email:'broker'+i+'@gmail.com',name},admin,'admin')));
  assert.deepEqual(created.map(r=>r.status),[200,200]);
  const accounts=(await e.call('owner_accounts',{},admin,'admin')).body.accounts;
  assert.equal(new Set(accounts.map(a=>a.publicPage.slug)).size,2);
  assert.ok(accounts.some(a=>a.publicPage.slug==='a-b'));
  const [first,second]=accounts;
  await e.call('set_owner_name',{id:first.id,name:'New business',nameVersion:first.nameVersion},admin,'admin');
  const updated=(await e.call('owner_accounts',{},admin,'admin')).body.accounts;
  assert.equal(updated.find(a=>a.id===first.id).publicPage.url,first.publicPage.url);
  assert.equal(updated.find(a=>a.id===second.id).publicPage.url,second.publicPage.url);
  const stored=(await e.repository.ownerAccounts())[0];
  const results=await Promise.all([ensureAccountSlug(e.repository,stored),ensureAccountSlug(e.repository,stored)]);
  assert.equal(results[0].public_slug,results[1].public_slug);
});

function browser({search='?account='+key,pathname='/properties/',status=200,rows=[sampleListing()],name='Arenal <Homes>'}={}){
  const {document}=parseHTML(fs.readFileSync(new URL('../site/index.html',import.meta.url),'utf8'));
  const requests=[],events={};
  const window={location:{search,pathname},ArenalConfig:{listingsUrl:'https://api.example/api/listings',managedCatalog:true},addEventListener:(name,callback)=>events[name]=callback};
  const context={window,document,URL,URLSearchParams,AbortSignal,fetch:async url=>{requests.push(String(url));return Response.json({account:{key,slug:'arenal-homes',name},listings:rows},{status});}};
  for(const file of ['account-page.js','catalog.js','property-content.js'])vm.runInNewContext(fs.readFileSync(new URL('../site/'+file,import.meta.url),'utf8'),context);
  return {window,document,requests,events};
}

test('shared explorer loads the account endpoint and shows escaped identity, scoped sharing and listing contacts',async()=>{
  const f=browser(),rows=await f.window.ArenalData.load();
  assert.equal(f.requests.length,1);assert.equal(new URL(f.requests[0]).searchParams.get('account'),key);
  assert.equal(new URL(f.requests[0]).searchParams.has('catalog'),false);
  assert.equal(f.document.querySelector('#account-identity').hidden,false);
  assert.equal(f.document.querySelector('#account-name').textContent,'Arenal <Homes>');
  assert.equal(f.document.querySelector('#account-name').children.length,0);
  assert.match(f.window.ArenalAccount.attribution(),/Arenal &lt;Homes&gt;/);
  assert.equal(f.window.ArenalListing.publicURL(rows[0]),'https://go.arenalindex.com/collection/arenal-homes/#propiedad/'+rows[0].id);
  assert.equal(f.document.querySelector('.account-explore-all').getAttribute('href'),'https://arenalindex.com/');
  f.events['arenal-language-change']();assert.equal(f.document.querySelector('#account-name').textContent,'Arenal <Homes>');
});

test('empty pages retain identity, failures do not show unrelated properties, main home has no strip',async()=>{
  const empty=browser({rows:[]});assert.equal((await empty.window.ArenalData.load()).length,0);assert.ok(empty.window.ArenalAccount.profile);
  for(const options of [{status:404},{status:503},{search:''},{search:'?account=bad'}]){
    const f=browser(options);await assert.rejects(()=>f.window.ArenalData.load());assert.equal(f.window.ArenalAccount.profile,null);
    assert.ok(f.requests.length<=1);assert.equal(f.document.querySelector('#account-identity').hidden,false);
  }
  const main=browser({search:'',pathname:'/'});assert.equal(main.window.ArenalAccount.active,false);assert.equal(main.document.querySelector('#account-identity').hidden,true);
});

test('clean collection paths load directly and use absolute assets under the Vercel rewrite',async()=>{
  const f=browser({search:'',pathname:'/collection/arenal-homes/'});
  await f.window.ArenalData.load();assert.equal(new URL(f.requests[0]).searchParams.get('account'),'arenal-homes');
  assert.equal(f.window.ArenalAccount.profile.url,'https://go.arenalindex.com/collection/arenal-homes/');
  for(const node of f.document.querySelectorAll('script[src],link[rel="stylesheet"]')){
    const path=node.getAttribute('src')||node.getAttribute('href');assert.match(path,/^(\/|https:)/);
  }
  const config=JSON.parse(fs.readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
  assert.ok(config.rewrites.some(route=>route.source.startsWith('/collection/:slug')&&route.destination==='/index.html'));
  assert.ok(config.rewrites.some(route=>route.source.startsWith('/collection/:slug')&&route.source.endsWith('/')&&route.destination==='/index.html'));
});

test('saving within an account preserves favorites belonging to other accounts',()=>{
  const html=fs.readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
  const initialization=html.match(/try\{const stored=JSON.parse\(localStorage.getItem\('arenalindex.saved'\)[^\n]+/)[0];
  const persistence=html.match(/try\{localStorage.setItem\('arenalindex.saved'[^\n]+?catch\{\}/)[0];
  let stored=JSON.stringify(['other-property']);
  const c={saved:new Set(),items:[{id:'my-property'}],localStorage:{getItem:()=>stored,setItem:(_key,value)=>stored=value}};
  vm.createContext(c);vm.runInContext(initialization,c);c.saved.add('my-property');vm.runInContext(persistence,c);
  assert.deepEqual(JSON.parse(stored),['other-property','my-property']);
});
