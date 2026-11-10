import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import sharp from 'sharp';
import {parseHTML} from 'linkedom';
import {shareCode,legacyShareCode,shareURL,propertyURL} from '../server/sharing/links.mjs';
import {createShareHandler,renderSharePage} from '../server/sharing/core.mjs';
import {fetchCover,publicCoverURL,renderShareImage} from '../server/sharing/image.mjs';
import {createPublicHandler} from '../server/intake/public.mjs';

const origin='https://go.arenalindex.com';
const row={id:'ai-c7bcad95a170344b232982f7',name:'Un jardín frente al Arenal',price:98000,currency:'USD',area:3200,place:'La Fortuna',lat:10.4,lng:-84.6,is_demo:false,images:['/photos/demo-tropical-garden.webp'],details:{schemaVersion:1,language:'es',contact:{name:'Owner',whatsapp:'50688889999'}}};
const request=(suffix='',method='GET')=>new Request(shareURL(row.id,origin)+suffix,{method});

test('stable compact aliases depend only on public IDs; invalid IDs and collisions never misroute',async()=>{
  assert.equal(shareURL(row.id,origin).length,33);
  assert.match(shareCode(row.id),/^[A-Z][A-Za-z0-9]{5}$/);
  assert.equal(legacyShareCode(row.id),'y-b96PDJKq');
  assert.equal(shareCode(row.id),shareCode({...row,name:'Updated',price:1}.id));
  assert.notEqual(shareCode(row.id),shareCode('lot-101'));
  for(const id of ['',null,'../secret','A'.repeat(81)])assert.throws(()=>shareCode(id));
  const handler=createShareHandler({origin,published:async()=>[row,{...row,id:'lot-101'}],codeFor:()=>shareCode(row.id)});
  assert.equal((await handler(request())).status,409);
});

test('previous ten-character links and images still open the same listing with the shorter canonical URL',async()=>{
  const bytes=Buffer.from('jpeg');
  const handler=createShareHandler({origin,published:async()=>[row],fetchImage:async()=>bytes,renderImage:async()=>bytes});
  const old=origin+'/p/y-b96PDJKq';
  const response=await handler(new Request(old));assert.equal(response.status,200);
  const {document}=parseHTML(await response.text());
  assert.equal(document.querySelector('[property="og:url"]').getAttribute('content'),shareURL(row.id,origin));
  assert.equal(document.querySelector('[property="og:title"]').getAttribute('content'),row.name);
  assert.equal((await handler(new Request(old+'/image.jpg?v=old'))).status,200);
  for(const path of ['/cuenta','/admin','/photos','/ABCDEF7','/Abc_d1','/p/ABCDEF'])assert.equal((await handler(new Request(origin+path))).status,404);
});

test('crawler receives photo, title, original price and locality without JavaScript or private data',async()=>{
  const privateRow={...row,token:'SECRET',email:'PRIVATE',file_paths:{plan:'DOCUMENT'}};
  const response=await createShareHandler({origin,published:async()=>[privateRow]})(request());
  assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/text\/html/);
  assert.equal(response.headers.get('location'),null);
  const html=await response.text(),{document}=parseHTML(html);
  const meta=name=>document.querySelector(`[property="${name}"]`)?.getAttribute('content');
  assert.equal(meta('og:title'),row.name);assert.equal(meta('og:site_name'),'Arenal Index');
  assert.equal(meta('og:url'),shareURL(row.id,origin));
  assert.match(meta('og:description'),/98,000 USD · La Fortuna · 3,200 m²/);
  assert.equal(meta('og:image:width'),'1200');assert.equal(meta('og:image:height'),'630');
  assert.match(meta('og:image'),/\/image.jpg\?v=[a-f0-9]{12}$/);
  assert.doesNotMatch(html,/SECRET|PRIVATE|DOCUMENT|50688889999/);
  const location={replace(value){this.destination=value;}};
  vm.runInNewContext(document.querySelector('script').textContent,{location});
  assert.equal(location.destination,propertyURL(row.id));
  assert.match(response.headers.get('content-security-policy'),/script-src 'sha256-/);
  const escaped=renderSharePage({...row,name:'</script><img src=x onerror=alert(1)>',place:'" onload="alert(1)'},origin).html;
  assert.doesNotMatch(escaped,/<img src=x|<\/script><img/);
});

test('edits refresh previews, while withdrawn, missing and failed catalog reads expose no old listing',async()=>{
  let rows=[row];const handler=createShareHandler({origin,published:async()=>rows});
  const first=await (await handler(request())).text();
  rows=[{...row,name:'Updated title',price:123000,images:['/photos/new-cover.jpg']}];
  const updated=await (await handler(request())).text();
  assert.match(updated,/Updated title/);assert.match(updated,/123,000 USD/);
  assert.notEqual(first.match(/image.jpg\?v=([a-f0-9]+)/)[1],updated.match(/image.jpg\?v=([a-f0-9]+)/)[1]);
  rows=[];
  for(const suffix of ['', '/image.jpg']){
    const response=await handler(request(suffix));assert.equal(response.status,404);
    assert.equal(response.headers.get('cache-control'),'no-store');assert.doesNotMatch(await response.text(),/Updated title/);
  }
  assert.equal((await handler(new Request(origin+'/p/../../secrets'))).status,404);
  assert.equal((await handler(request('', 'POST'))).status,405);
  assert.equal((await createShareHandler({published:async()=>{throw Error('Offline');}})(request())).status,503);
});

test('preview JPEG uses the selected first photo; HEAD is cheap and unavailable photos remain retryable',async()=>{
  const calls=[];const bytes=Buffer.from('jpeg');
  const handler=createShareHandler({origin,published:async()=>[row],fetchImage:async url=>{calls.push(url);return bytes;},renderImage:async input=>{assert.equal(input,bytes);return bytes;}});
  const response=await handler(request('/image.jpg'));
  assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/jpeg');
  assert.deepEqual(calls,[row.images[0]]);
  const head=await handler(request('/image.jpg','HEAD'));assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal(calls.length,1);
  const failed=createShareHandler({origin,published:async()=>[row],fetchImage:async()=>{throw Error('Offline');}});
  assert.equal((await failed(request('/image.jpg'))).status,503);
});

test('image renderer supplies a small 1200×630 JPEG with honest demo and missing-photo variants',async()=>{
  const source=await sharp({create:{width:800,height:1000,channels:3,background:'#8db58b'}}).jpeg().toBuffer();
  const image=await renderShareImage(source),demo=await renderShareImage(source,{demo:true}),empty=await renderShareImage(null);
  for(const bytes of [image,demo,empty]){
    const meta=await sharp(bytes).metadata();assert.equal(meta.format,'jpeg');assert.equal(meta.width,1200);assert.equal(meta.height,630);assert.ok(bytes.length<300000);
  }
  assert.notDeepEqual(image,demo);assert.notDeepEqual(image,empty);
  await assert.rejects(()=>renderShareImage(Buffer.from('corrupt')));
});

test('cover downloads allow only published media paths and bounded trusted storage redirects',async()=>{
  for(const value of ['http://127.0.0.1/a','https://evil.example/a.jpg','//evil.example/a.jpg','https://arenalindex.com@evil.example/photos/a.jpg','/admin/private.jpg','https://arenalindex-intake.vercel.app/api/listings?id=record-01&photo=photo&version=1&token=secret'])assert.equal(publicCoverURL(value),null);
  const api='https://arenalindex-intake.vercel.app/api/listings?id=record-01&photo=photo&version=1';
  assert.ok(publicCoverURL(api));
  const calls=[];const result=await fetchCover(api,{fetcher:async(url,options)=>{
    calls.push(String(url));assert.equal(options.redirect,'manual');
    return calls.length===1?new Response(null,{status:307,headers:{location:'https://store.private.blob.vercel-storage.com/files/cover?signature=allowed'}}):new Response('image',{headers:{'content-type':'image/jpeg'}});
  }});
  assert.equal(result.toString(),'image');assert.equal(calls.length,2);
  for(const location of ['http://127.0.0.1/secret','https://evil.example/file','https://store.private.blob.vercel-storage.com.evil.example/file'])await assert.rejects(()=>fetchCover(api,{fetcher:async()=>new Response(null,{status:307,headers:{location}})}));
  await assert.rejects(()=>fetchCover(api,{fetcher:async()=>new Response('html',{headers:{'content-type':'text/html'}})}));
  await assert.rejects(()=>fetchCover(api,{fetcher:async()=>new Response('image',{headers:{'content-type':'image/jpeg','content-length':String(13*1024*1024)}})}));
});

test('public catalog and contact/share UI use the canonical URL, preserving legacy links and private preview guards',async()=>{
  const response=await createPublicHandler({published:async()=>[row]})(new Request('https://example.com/api/listings'));
  const published=(await response.json())[0];assert.equal(published.shareUrl,shareURL(row.id));
  const window={};
  for(const file of ['catalog.js','property-content.js'])vm.runInNewContext(await readFile(new URL('../site/'+file,import.meta.url),'utf8'),{window});
  const item=window.ArenalData.normalize({...published,shareUrl:shareURL(row.id,origin)});
  assert.equal(window.ArenalListing.publicURL(item),shareURL(row.id,origin));
  assert.ok(new URL(window.ArenalListing.contactLinks(item).whatsapp).searchParams.get('text').endsWith(shareURL(row.id,origin)));
  assert.equal(window.ArenalListing.contactLinks({...item,draftPreview:true}),null);
  const old=origin+'/p/'+legacyShareCode(row.id);
  assert.equal(window.ArenalListing.publicURL(window.ArenalData.normalize({...published,shareUrl:old})),old);
  for(const invalid of ['https://evil.example/p/1234567890',shareURL(row.id,origin)+'?token=secret','javascript:alert(1)']){
    const legacy=window.ArenalData.normalize({...published,shareUrl:invalid});assert.equal(window.ArenalListing.publicURL(legacy),propertyURL(row.id));
  }
});
