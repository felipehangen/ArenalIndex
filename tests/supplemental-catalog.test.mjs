import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {createCatalog} from '../server/catalog/core.mjs';
import {supplementalDemos} from '../server/catalog/supplemental.mjs';
import {createPublicHandler} from '../server/intake/public.mjs';

function fixture(remote=[],supplemental=supplementalDemos.slice(0,1)){
  const state={},repository={
    published:async()=>[],catalogState:async()=>structuredClone(state),
    catalogUpdate:async(id,revision,next)=>{if((state[id]?.revision||0)!==revision)return false;state[id]=structuredClone(next);return true;}
  };
  const options={repository,supplemental,fetcher:async()=>Response.json(remote)};
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

test('five additional demos have distinct licensed galleries, landscape covers and working currency filters',()=>{
  const manifest=JSON.parse(fs.readFileSync(new URL('../docs/demo-photos-2026-11-10.json',import.meta.url),'utf8'));
  const window={};for(const file of ['catalog.js','pricing.js'])vm.runInNewContext(fs.readFileSync(new URL('../site/'+file,import.meta.url),'utf8'),{window});
  const items=supplementalDemos.slice(1,6).map(window.ArenalData.normalize),used=new Set();assert.equal(items.length,5);
  const rate=JSON.parse(fs.readFileSync(new URL('../site/exchange-rate.json',import.meta.url),'utf8')),pricing=window.ArenalPricing.create(items,rate);
  for(const item of items){
    assert.ok(item.isDemo&&item.approximate);assert.equal(item.house,item.details.buildings.length>0);
    assert.ok(item.images.length>=3);assert.equal(item.details.contact.whatsapp,'50688542664');
    for(const language of ['es','en'])assert.ok(item.details.translations[language].title.length<=45);
    const photos=item.details.photoGroups.flatMap(group=>group.photos);assert.deepEqual(photos.map(p=>p.src),item.images);
    for(const photo of photos){
      assert.ok(!used.has(photo.src),'no repeated photos across new listings');used.add(photo.src);
      const entry=manifest.photos.find(record=>photo.src==='/photos/'+record.file);assert.ok(entry);
      assert.match(entry.source,/^https:\/\/www\.pexels\.com\//);assert.equal(entry.license,'https://www.pexels.com/license/');
      assert.ok(photo.caption.includes(entry.photographer));assert.equal(photo.perspective,entry.perspective);
      const bytes=fs.readFileSync(new URL('../site'+photo.src,import.meta.url));assert.equal(bytes.toString('ascii',8,12),'WEBP');assert.equal(bytes.length,entry.bytes);
      if(photo.src===item.images[0])assert.equal(entry.width/entry.height,4/3);
    }
    for(const currency of ['USD','CRC']){
      const view=pricing.view(item,currency);assert.equal(view.currency,currency);assert.equal(view.unavailable,false);assert.equal(view.unit,view.price/item.area);
      assert.equal(pricing.matchesPrice(item,{currency,price:[view.price,view.price],unit:[view.unit,view.unit]}),true);
    }
  }
  assert.equal(used.size,manifest.photos.length);
});

test('each new showcase can be independently unlisted and deleted without affecting the first demo',async()=>{
  const e=fixture([],supplementalDemos),actor={email:'admin@gmail.com'};assert.equal((await e.catalog.list()).length,31);
  for(const row of supplementalDemos.slice(1)){
    await e.catalog.action('catalog_unlist',{id:row.id,revision:0},actor);
    assert.ok(!(await e.catalog.published()).some(item=>item.id===row.id));
    await e.catalog.action('catalog_delete',{id:row.id,revision:1,confirmation:'DELETE'},actor);
  }
  assert.deepEqual((await e.catalog.list()).map(row=>row.id),['lot-101']);
});

test('the 25-demo collection has unique covers, credited optimized photos and consistent filters',()=>{
  const manifest=JSON.parse(fs.readFileSync(new URL('../docs/demo-collection-photos-2026-11-10.json',import.meta.url),'utf8'));
  const window={};for(const file of ['catalog.js','pricing.js'])vm.runInNewContext(fs.readFileSync(new URL('../site/'+file,import.meta.url),'utf8'),{window});
  const rows=supplementalDemos.slice(6),items=rows.map(window.ArenalData.normalize),covers=new Set(),uses=new Map();
  assert.deepEqual(rows.map(row=>row.id),Array.from({length:25},(_,i)=>'lot-'+(107+i)));
  assert.equal(items.filter(item=>item.house).length,14);
  assert.ok(items.some(item=>item.well)&&items.some(item=>item.privateResidential));
  assert.equal(new Set(items.map(item=>item.currency)).size,2);
  const pricing=window.ArenalPricing.create(items,JSON.parse(fs.readFileSync(new URL('../site/exchange-rate.json',import.meta.url),'utf8')));
  const priorPhotos=new Set(supplementalDemos.slice(0,6).flatMap(row=>row.images));
  for(const item of items){
    assert.ok(item.isDemo&&item.approximate&&item.details.titlesReviewed);
    assert.equal(item.details.entrance,false);assert.equal(item.house,item.details.buildings.length>0);
    assert.equal(item.details.contact.email,'equipo@arenalindex.com');assert.equal(item.details.contact.whatsapp,'50688542664');
    assert.ok(item.images.length>=2&&item.images.length<=4);
    assert.equal(new Set(item.images).size,item.images.length);
    assert.ok(!covers.has(item.images[0]));covers.add(item.images[0]);
    for(const language of ['es','en'])assert.ok(item.details.translations[language].title.length<=45);
    const photos=item.details.photoGroups.flatMap(group=>group.photos);
    assert.deepEqual(photos.map(photo=>photo.src),item.images);
    const coverCategory=photos[0].caption.split(' · ')[1];
    assert.equal(item.details.photoGroups[0].title,coverCategory+' · imágenes de referencia');
    for(const photo of photos){
      assert.ok(!priorPhotos.has(photo.src),'the new collection uses new photos');
      const entry=manifest.photos.find(record=>photo.src==='/photos/'+record.file);assert.ok(entry);
      assert.match(entry.source,/^https:\/\/www\.pexels\.com\/photo\//);assert.equal(entry.license,'https://www.pexels.com/license/');
      assert.ok(entry.listings.includes(item.id));assert.match(photo.caption,/Imagen ilustrativa/);assert.ok(photo.caption.includes(entry.photographer));
      assert.equal(photo.perspective,entry.perspective);
      const bytes=fs.readFileSync(new URL('../site'+photo.src,import.meta.url));
      assert.equal(bytes.toString('ascii',8,12),'WEBP');assert.equal(bytes.length,entry.bytes);assert.ok(bytes.length<=380000);
      assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);
      if(photo.src===item.images[0]){assert.ok(entry.cover);assert.ok(Math.abs(entry.width/entry.height-4/3)<.002);}
      uses.set(photo.src,(uses.get(photo.src)||0)+1);
    }
    for(const currency of ['USD','CRC']){
      const view=pricing.view(item,currency);
      assert.equal(view.unavailable,false);assert.equal(view.unit,view.price/item.area);
      assert.ok(pricing.matchesPrice(item,{currency,price:[view.price,view.price],unit:[view.unit,view.unit]}));
    }
    const services=item.details.sections.find(section=>section.id==='services').rows;
    assert.equal(item.water,['Conexión activa','Carta de disponibilidad'].includes(services.find(row=>row.label==='Agua de red').value));
    assert.equal(item.electricity,services.find(row=>row.label==='Electricidad').value==='Medidor activo');
    assert.equal(item.well,services.some(row=>row.label==='Pozo'&&row.value==='Sí'));
    for(const section of [...item.details.sections,...item.details.buildings])for(const fact of section.rows)assert.equal(fact.source,'Dato ficticio de demostración');
  }
  assert.equal(uses.size,manifest.photos.length);assert.equal(covers.size,25);
  for(const [src,count]of uses)assert.ok(count<=(covers.has(src)?1:2),'only a few supporting photos may be shared');
});
