import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {demoDraft,refreshCatalog,migration} from '../scripts/demo-catalog.mjs';
import {pending,photoRequirements} from '../site/newlisting/model.mjs';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const seed=JSON.parse(read('supabase/demo-properties.json'));
const rows=refreshCatalog(seed);
const window={};
vm.runInNewContext(read('site/catalog.js'),{window});

test('every refreshed demo satisfies current seller, publication and photo requirements',()=>{
 for(const [index,row] of seed.entries()){
  const {draft}=demoDraft(row,index);
  const review={plan_number:'DEMO-SIN-VALIDEZ',documented_area:Number(draft.values.area),plan_matches:true,copy_checked:true};
  assert.equal(pending(draft).length,0,row.id);
  assert.equal(pending(draft,{publication:true,review}).length,0,row.id);
  assert.ok(photoRequirements(draft).every(r=>r.complete),row.id);
 }
});

test('demo refresh preserves identities and locations while covering currencies and property types',()=>{
 assert.equal(rows.length,100);
 assert.equal(rows.filter(r=>r.currency==='CRC').length,40);
 assert.equal(rows.filter(r=>r.currency==='USD').length,60);
 assert.equal(rows.filter(r=>r.house).length,50);
 assert.equal(rows.filter(r=>r.details.buildings.length>1).length,20);
 assert.equal(new Set(rows.map(r=>r.sort_order)).size,100);
 const types=new Set();
 for(const [index,row] of rows.entries()){
  assert.equal(row.id,seed[index].id);assert.equal(row.lat,seed[index].lat);assert.equal(row.lng,seed[index].lng);
  assert.equal(row.status,seed[index].status);assert.equal(row.is_demo,true);
  assert.equal(row.house,row.details.buildings.length>0);
  const item=window.ArenalData.normalize(row);
  assert.equal(item.currency,row.currency);
  assert.equal(item.privateResidential,row.details.residential==='condo');
  types.add(row.details.residential);
  for(const b of row.details.buildings){
   assert.ok(row.details.photoGroups.some(g=>g.photos.some(p=>p.id==='building-'+b.id)));
  }
 }
 assert.equal(rows.filter(r=>window.ArenalData.normalize(r).privateResidential).length,10);
 assert.deepEqual([...types].sort(),['condo','no','residential']);
});

test('public examples contain illustrative photos and no private data or real verification claims',()=>{
 for(const row of rows){
  assert.equal(row.details.contact,null);assert.equal(row.approximate,true);assert.equal(row.details.entrance,false);
  assert.equal(row.details.areaSource,'Área de ejemplo');
  assert.equal(row.details.reviewedAt,undefined);assert.equal(row.details.publishedAt,undefined);
  assert.doesNotMatch(JSON.stringify(row),/example\.invalid|DEMO-SIN-VALIDEZ|plan-1|plano-de-ejemplo|Plano revisado por ArenalIndex/);
  for(const section of [...row.details.sections,...row.details.buildings]){
   for(const fact of section.rows)assert.equal(fact.source,'Dato ficticio de demostración');
  }
  for(const group of row.details.photoGroups)for(const photo of group.photos){
   assert.match(photo.caption,/Imagen ilustrativa/);
   assert.ok(fs.existsSync(new URL('../site/'+photo.src,import.meta.url)));
  }
 }
});

test('checked-in data and scoped SQL match the validated generator',()=>{
 assert.deepEqual(JSON.parse(read('supabase/demo-properties-v2.json')),rows);
 const sql=migration(rows);
 assert.equal(read('supabase/migrations/202611090001_demo_refresh.sql'),sql);
 assert.match(sql,/where p.id=u.id and p.is_demo is true/);
 assert.doesNotMatch(sql,/delete from|truncate|disable row level security|grant /i);
});
