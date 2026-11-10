import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createCatalog} from '../server/catalog/core.mjs';
import {supplementalDemos} from '../server/catalog/supplemental.mjs';
import {createPublicHandler} from '../server/intake/public.mjs';

function fixture(remote=[]){
  const state={},repository={
    published:async()=>[],catalogState:async()=>structuredClone(state),
    catalogUpdate:async(id,revision,next)=>{if((state[id]?.revision||0)!==revision)return false;state[id]=structuredClone(next);return true;}
  };
  const options={repository,supplemental:supplementalDemos,fetcher:async()=>Response.json(remote)};
  return {state,repository,options,catalog:createCatalog(options)};
}

test('the stock demo is managed in admin and public catalogs, including after redeployment',async()=>{
  const {catalog,repository,options}=fixture(),id=supplementalDemos[0].id,actor={email:'admin@gmail.com'};
  const publicRows=async current=>{
    const response=await createPublicHandler(repository,{catalog:current})(new Request('https://api.example/listings?catalog=1'));
    assert.equal(response.status,200);return response.json();
  };
  assert.equal((await catalog.list())[0].publicId,id);
  assert.equal((await publicRows(catalog))[0].images.length,4);
  await catalog.action('catalog_update',{id,revision:0,listing:{titleEs:'Casa de muestra',titleEn:'Sample home',price:150000000,area:2500,currency:'CRC',place:'La Fortuna'}},actor);
  assert.equal((await publicRows(catalog))[0].currency,'CRC');
  await catalog.action('catalog_unlist',{id,revision:1},actor);
  assert.equal((await publicRows(createCatalog(options))).length,0);
  assert.equal((await catalog.list())[0].withdrawn,true);
  await catalog.action('catalog_publish',{id,revision:2},actor);
  assert.equal((await publicRows(catalog))[0].details.translations.en.title,'Sample home');
  await assert.rejects(catalog.action('catalog_delete',{id,revision:3},actor),{status:422});
  await catalog.action('catalog_delete',{id,revision:3,confirmation:'BORRAR'},actor);
  const redeployed=createCatalog(options);
  assert.equal((await redeployed.list()).length,0);assert.equal((await publicRows(redeployed)).length,0);
  await assert.rejects(redeployed.action('catalog_publish',{id,revision:4},actor),{status:404});
  assert.equal(supplementalDemos[0].price,295000,'admin edits must not mutate the seed');
});

test('a migrated demo occurs once and keeps its management decision',async()=>{
  const remote={...structuredClone(supplementalDemos[0]),name:'Migrated demo'},e=fixture([remote]);
  assert.equal((await e.catalog.published()).length,1);assert.equal((await e.catalog.published())[0].name,'Migrated demo');
  e.state[remote.id]={status:'deleted',revision:1};
  assert.equal((await e.catalog.published()).length,0);
});

test('supplemental photos do not become a fallback when a managed source fails',async()=>{
  const {options}=fixture();
  await assert.rejects(createCatalog({...options,fetcher:async()=>new Response('',{status:503})}).published(),{status:503});
  await assert.rejects(createCatalog({...options,repository:{catalogState:async()=>{throw Error('storage unavailable');}}}).published(),/storage unavailable/);
});

test('the normalized demo gallery has licensed local assets and explicit fictional disclosure',()=>{
  const window={};vm.runInNewContext(fs.readFileSync(new URL('../site/catalog.js',import.meta.url),'utf8'),{window});
  const row=supplementalDemos[0],item=window.ArenalData.normalize(row),credits=fs.readFileSync(new URL('../docs/demo-photo-credits.md',import.meta.url),'utf8');
  assert.equal(item.isDemo,true);assert.equal(item.details.entrance,false);assert.equal(item.details.titlesReviewed,true);
  assert.equal(item.details.contact.whatsapp,'50688542664');
  assert.equal(item.details.buildings.length,1);
  assert.equal(item.details.translations.en.title,'Tropical garden home · demo');
  const photos=item.details.photoGroups.flatMap(group=>group.photos);
  assert.deepEqual([...new Set(photos.map(photo=>photo.src))],[...item.images]);
  for(const photo of photos){
    assert.match(photo.caption,/Imagen ilustrativa/);assert.match(photo.caption,/Orphic Clicks/);
    assert.ok(credits.includes(photo.src.split('/').at(-1)));
    const bytes=fs.readFileSync(new URL('../site'+photo.src,import.meta.url));
    assert.equal(bytes.toString('ascii',8,12),'WEBP');assert.ok(bytes.length<500000);
  }
  for(const section of [...item.details.sections,...item.details.buildings])for(const fact of section.rows)assert.equal(fact.source,'Dato ficticio de demostración');
  assert.doesNotMatch(JSON.stringify(row),/reviewedAt|publishedAt|plano-de-ejemplo/);
});
