import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseHTML} from 'linkedom';
import {ownerSummary} from '../server/portal/owner-summary.mjs';
import {renderRows} from '../site/admin/view.mjs';
import {mountBrokerResources,collectionURL,makeQR} from '../site/cuenta/resources.mjs';
import {renderSheet} from '../site/cuenta/sheet/view.mjs';
import {loadSheet} from '../site/cuenta/sheet/data.mjs';
import {portalFixture} from './portal-fixture.mjs';
import {completeDraft,png} from './intake-fixtures.mjs';
import {sampleListing} from './publication-fixture.mjs';

function browser({clipboard}={}){
  const {document,window}=parseHTML(fs.readFileSync(new URL('../site/cuenta/index.html',import.meta.url),'utf8'));
  globalThis.window=window;
  window.ArenalI18n={language:'en',locale:'en-US',t:s=>s};
  window.ArenalConfig={siteContact:{email:'equipo@arenalindex.com'}};
  const resourceWindow=new Proxy(window,{get:(target,key)=>key==='navigator'?{clipboard}:Reflect.get(target,key)});
  const resources=mountBrokerResources({document,window:resourceWindow});
  resources.setIdentity({publicPage:{name:'Homes <Arenal>',url:'https://go.arenalindex.com/collection/homes/'}});
  return {document,window,resources,$:s=>document.querySelector(s)};
}
test('owner thumbnails prefer the cover, never private document images, and tolerate unavailable files',async()=>{
  const paths=[],repository={downloadURL:async path=>{paths.push(path);return 'https://files.example/'+path;}};
  const row={id:'property-01',status:'approved',version:2,payload:completeDraft(),file_paths:{'land-2':'saved/cover'}};
  row.payload.values.cover_id='land-2';
  assert.equal((await ownerSummary(row,repository)).thumbnail,'https://files.example/saved/cover');
  row.payload.values.cover_id='plan-1';row.payload.files.find(f=>f.id==='plan-1').type='image/png';
  assert.equal((await ownerSummary(row,repository)).thumbnail,'https://files.example/property-01/2/land-1');
  row.payload.files=row.payload.files.filter(f=>f.category==='plan_file');
  assert.equal((await ownerSummary(row,repository)).thumbnail,null);assert.equal(paths.length,2);
  row.payload=completeDraft();repository.downloadURL=async()=>{throw Error('Unavailable');};
  assert.equal((await ownerSummary(row,repository)).thumbnail,null);
  row.status='draft';repository.downloadURL=async()=>{throw Error('Must not sign an unverified upload');};repository.inspectFile=async()=>null;
  assert.equal((await ownerSummary(row,repository)).thumbnail,null);
  repository.inspectFile=async()=>({size:png.length,bytes:png});repository.downloadURL=async()=> 'https://files.example/verified';
  assert.equal((await ownerSummary(row,repository)).thumbnail,'https://files.example/verified');
});
test('owner list only signs photos belonging to the authenticated account',async()=>{
  const e=portalFixture(),admin=await e.adminSession();await e.register('broker',admin);const signed=await e.login('broker');
  const account=(await e.repository.ownerAccounts())[0];
  const owned={id:'property-owned',owner_subject:account.subject,status:'approved',version:1,payload:completeDraft()};
  const foreign={...owned,id:'property-foreign',owner_subject:'another-account'};
  e.repository.ownerRecords=async()=>({records:[owned,foreign,{...owned,id:'deleted',status:'deleted'}],cursor:null});
  const paths=[];e.repository.downloadURL=async path=>{paths.push(path);return 'https://files.example/'+path;};
  const response=await e.call('list',{},signed.body.token);
  assert.equal(response.status,200);assert.deepEqual(response.body.records.map(row=>row.id),['property-owned']);
  assert.deepEqual(paths,['property-owned/1/land-1']);
  assert.equal((await e.call('list')).status,401);
});
test('owner rows show thumbnails, hide internal IDs and offer sheets only for published records',()=>{
  browser();
  const row={id:'private-internal-id',title:'Arenal <House>',currency:'USD',price:100000,status:'draft',thumbnail:'javascript:alert(1)'};
  let {document}=parseHTML(renderRows([row],{owner:true}));
  assert.equal(document.querySelector('.admin-property').textContent,'Sin fotoArenal <House>');
  assert.equal(document.querySelector('img'),null);assert.match(document.querySelector('.admin-record-link').href,/cuenta=private-internal-id/);
  assert.equal(document.querySelector('a[href*="sheet/"]'),null);
  row.thumbnail='/photos/house.jpg';row.publishedVersion=1;row.publicId='ai-public-id';row.collectionSlug='homes';
  ({document}=parseHTML(renderRows([row],{owner:true})));
  assert.equal(document.querySelector('img').src,'https://arenalindex.com/photos/house.jpg');
  assert.equal(document.querySelector('a[href*="sheet/"]').href,'/cuenta/sheet/?id=ai-public-id&collection=homes');
});
test('resources switch panels, preserve literal account names, generate a downloadable QR and clear on logout',()=>{
  const e=browser();
  assert.equal(e.$('#listings-panel').hidden,false);assert.equal(e.$('#resources-panel').hidden,true);
  e.$('[data-owner-panel="resources"]').onclick();assert.equal(e.$('#resources-panel').hidden,false);assert.equal(e.$('#listings-panel').hidden,true);
  assert.match(e.$('#broker-message').value,/Homes <Arenal>/);assert.equal(e.$('arenal'),null);
  const qr=e.$('a[download]');assert.equal(qr.download,'arenalindex-collection-qr.svg');assert.match(decodeURIComponent(qr.href),/<svg/);
  assert.equal(e.$('#account-public-page').href,'https://go.arenalindex.com/collection/homes/');
  assert.ok(e.$('a[href="https://arenalindex.com/publicar/#fotos"]'));
  e.window.ArenalI18n.language='es';e.window.dispatchEvent(new e.window.Event('arenal-language-change'));
  assert.match(e.$('#resources-panel h1').textContent,/Recursos/);assert.match(e.$('#broker-message').value,/Explorá/);
  e.window.dispatchEvent(new e.window.Event('arenal-owner-clear'));
  assert.equal(e.$('#resources-panel').innerHTML,'');assert.equal(e.$('#resources-panel').hidden,true);assert.equal(e.$('#listings-panel').hidden,false);
});
test('accounts without valid collections retain guides and catalog without misleading sharing controls',()=>{
  const e=browser();
  for(const url of ['https://evil.example/collection/homes/','javascript:alert(1)','https://go.arenalindex.com/collection/homes/?token=secret','']){
    assert.equal(collectionURL({url}), '');e.resources.setIdentity({publicPage:{name:'Homes',url}});
    assert.equal(e.$('#account-public-page'),null);assert.equal(e.$('[data-copy="message"]'),null);assert.ok(e.$('[data-copy="catalog"]'));
  }
  assert.match(makeQR('https://go.arenalindex.com/collection/'+'a'.repeat(100)+'/'),/<svg/);
});
test('clipboard failure offers selectable text; delayed copies cannot restore data after logout',async()=>{
  let resolve;const clipboard={writeText:async()=>{throw Error('Permission denied');}};
  const e=browser({clipboard});
  e.$('#broker-copy-fallback').select=()=>{};
  await e.$('#resources-panel').onclick({target:e.$('[data-copy="collection"]')});
  assert.equal(e.$('.copy-fallback').hidden,false);assert.equal(e.$('#broker-copy-fallback').value,'https://go.arenalindex.com/collection/homes/');
  clipboard.writeText=()=>new Promise(done=>resolve=done);
  const copying=e.$('#resources-panel').onclick({target:e.$('[data-copy="message"]')});
  e.window.dispatchEvent(new e.window.Event('arenal-owner-clear'));resolve();await copying;
  assert.equal(e.$('#resources-panel').innerHTML,'');
});
test('printable sheets use current public snapshots and support both catalog response shapes',async()=>{
  const listing=sampleListing();
  for(const slug of [null,'homes']){
    let request;
    const loaded=await loadSheet({id:listing.id,slug,endpoint:'https://api.example/listings',fetcher:async(url,options)=>{request={url,options};return {ok:true,json:async()=>slug?{account:{name:'Homes',slug},listings:[listing]}:[listing]};}});
    assert.equal(loaded.listing,listing);assert.equal(request.options.cache,'no-store');
    assert.equal(request.url.searchParams.get(slug?'account':'catalog'),slug||'1');
    assert.match(loaded.publicURL,new RegExp('#propiedad/'+listing.id+'$'));
  }
  for(const body of [{account:{slug:'other'},listings:[listing]},{account:{slug:'homes'},listings:[]}]){
    await assert.rejects(()=>loadSheet({id:listing.id,slug:'homes',endpoint:'https://api.example/listings',fetcher:async()=>({ok:true,json:async()=>body})}));
  }
});
test('printable sheets escape content, disclose demos and exclude private draft data',()=>{
  const listing=sampleListing();listing.payload={values:{email:'PRIVATE-EMAIL',notes:'PRIVATE-NOTES'}};listing.details.translations.en={title:'Public <title>',description:'Published description'};
  listing.details.contact={name:'Public broker',email:'broker@example.com'};
  const html=renderSheet(listing,{language:'en',collection:{name:'Homes'},url:'https://go.arenalindex.com/collection/homes/#propiedad/'+listing.id});
  assert.match(html,/Public &lt;title&gt;/);assert.match(html,/Published description/);assert.match(html,/broker@example.com/);assert.match(html,/Demonstration property/);
  assert.doesNotMatch(html,/PRIVATE-EMAIL|PRIVATE-NOTES/);assert.match(html,/Land area/);
  assert.match(renderSheet(listing,{language:'es',url:'https://arenalindex.com/'}),/Propiedad de demostración/);
});
