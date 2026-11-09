import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {newDraft} from '../site/newlisting/model.mjs';
import {createDraftPreview} from '../site/newlisting/draft-preview.mjs';
import {approvedRow,sampleListing} from './publication-fixture.mjs';

const window={};
for(const name of ['catalog.js','property-content.js'])vm.runInNewContext(fs.readFileSync(new URL('../site/'+name,import.meta.url),'utf8'),{window,URLSearchParams,AbortSignal});
const urlFor=file=>'blob:https://arenalindex.com/'+file.id;

test('draft buyer preview uses the selected cover and grouped photos without private fields or reviewed claims',()=>{
  const draft=approvedRow().payload;
  Object.assign(draft.values,{name:'PRIVATE-REFERENCE',contact:'PRIVATE-CONTACT',email:'PRIVATE-EMAIL',phone:'PRIVATE-PHONE',plan:'PRIVATE-PLAN',documents_notes:'PRIVATE-NOTES',documented_area:'3200'});
  draft.accessToken='PRIVATE-TOKEN';draft.files.push({...draft.files[0],id:'private-photo',category:'technical'});
  const preview=createDraftPreview(draft,urlFor),json=JSON.stringify(preview);
  for(const secret of ['PRIVATE-REFERENCE','PRIVATE-CONTACT','PRIVATE-EMAIL','PRIVATE-PHONE','PRIVATE-PLAN','PRIVATE-NOTES','PRIVATE-TOKEN','private-photo','plan-1'])assert.ok(!json.includes(secret),secret);
  assert.equal(preview.images[0],urlFor({id:'view-1'}));
  assert.equal(preview.details.buildings.length,2);assert.equal(preview.details.contact,null);
  assert.equal(preview.area,3200);assert.equal(preview.details.declaredArea,3250);
  assert.match(preview.details.areaSource,/sin revisar/);
  const html=window.ArenalListing.content(preview);
  for(const label of ['Agua de red','Electricidad','Internet fijo','Cabaña del jardín','Residencial con vías públicas'])assert.ok(html.includes(label),label);
  assert.doesNotMatch(html,/plano revisado|Plano revisado|NaN|Infinity/);
  assert.equal(window.ArenalListing.groups(preview).flatMap(group=>group.images).length,8);
});

test('incomplete draft previews leave price, area, buildings and location pending instead of fabricating values',()=>{
  const preview=createDraftPreview(newDraft(),urlFor);
  assert.equal(preview.price,null);assert.equal(preview.currency,null);assert.equal(preview.area,null);assert.equal(preview.coordinates,null);
  assert.equal(preview.name,'Título por definir');assert.equal(preview.place,'Localidad por definir');assert.deepEqual(preview.images,[]);
  const html=window.ArenalListing.content(preview);
  assert.match(html,/Por completar/);assert.match(html,/Por definir/);assert.match(html,/Por confirmar/);
  assert.doesNotMatch(html,/NaN|Infinity|\$0|Solo terreno/);
});

test('draft preview preserves currency and escapes content while public image validation stays strict',()=>{
  const draft=approvedRow().payload;draft.values.currency='CRC';draft.buildings[0].name='<script>bad()</script>';
  const preview=createDraftPreview(draft,urlFor),html=window.ArenalListing.content(preview);
  assert.match(html,/₡/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
  const publicItem=window.ArenalData.normalize({...sampleListing(),is_demo:false,images:['blob:https://arenalindex.com/private']});
  assert.equal(publicItem.images[0],'/icons/no-photo.svg');
});
