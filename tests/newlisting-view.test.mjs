import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../site/newlisting/model.mjs';
import {renderFields,renderPhotoTour,renderPhotoChecklist,renderPhotoGroupStatus,areaNotice} from '../site/newlisting/view.mjs';
import {completeDraft} from './intake-fixtures.mjs';

test('photo checklist exposes missing classification, completion, and per-building requirements',()=>{
  const d=completeDraft();
  for(const file of d.files.filter(f=>f.category==='access'))file.shot='general';
  assert.match(renderPhotoChecklist(d),/Para completar Fotos/);
  assert.equal((renderPhotoChecklist(d).match(/data-photo-group="access"/g)||[]).length,2);
  assert.match(renderPhotoGroupStatus(d,'land'),/✓ Completo/);
  assert.doesNotMatch(renderPhotoGroupStatus(d,'access'),/✓/);
  d.files.find(f=>f.id==='entry-1').shot='entrance';d.files.find(f=>f.id==='road-1').shot='road';
  assert.match(renderPhotoChecklist(d),/✓ Fotos completas/);
  assert.match(renderPhotoGroupStatus(d,'access'),/✓ Completo/);
  d.values.buildings='yes';d.buildings=[{id:'house',kind:'house',name:'Casa <privada>'}];
  assert.match(renderPhotoChecklist(d),/Foto exterior: Casa &lt;privada&gt;/);
  assert.match(renderPhotoChecklist(d),/data-photo-group="buildings"/);
  d.values.photo_exception='Falta el exterior de la casa.';
  assert.match(renderPhotoChecklist(d),/Para revisión/);
  assert.match(renderPhotoChecklist(d),/deberá aceptar la excepción/);
  assert.doesNotMatch(renderPhotoGroupStatus(d,'buildings'),/✓/);
  d.values.buildings='no';assert.doesNotMatch(renderPhotoChecklist(d),/Foto exterior/);
});

test('the first pass shows necessary questions while optional answers remain accessible',()=>{
  const fields=M.steps.find(s=>s.id==='services').fields;
  const html=renderFields(fields),firstPass=html.replace(/<details\b[^>]*>[\s\S]*?<\/details>/g,'');
  for(const id of ['water','electricity'])assert.match(firstPass,new RegExp('id="field-'+id+'"'));
  for(const id of ['water_provider','internet','mobile','sewage']){
    assert.doesNotMatch(firstPass,new RegExp('id="field-'+id+'"'));
    assert.match(html,new RegExp('id="field-'+id+'"'));
  }
  assert.doesNotMatch(html,/<details[^>]* open/);
  assert.match(html,/aria-required="true"/);
  const resumed=renderFields(fields,{water:'active',water_provider:'ASADA local'});
  assert.match(resumed,/<details class="optional-section" open>[\s\S]*?value="ASADA local"/);
  for(const title of ['Agua de red pública o comunitaria','Pozo o naciente','Electricidad','Internet y señal celular','Saneamiento y lluvia'])assert.match(html,new RegExp('<h2>'+title+'</h2>'));
});

test('the listing title stays separate from the private reference and has a short limit',()=>{
  const d=completeDraft();d.values.name='Terreno de don Carlos';d.values.listing_title='Lote con vista al Arenal';
  const field=M.steps[0].fields.find(f=>f.id==='listing_title');
  assert.equal(field.maxLength,45);
  assert.equal(M.reference(d),'Terreno de don Carlos');
  assert.match(M.buyerCopy(d),/^Lote con vista al Arenal/);
  assert.doesNotMatch(M.buyerCopy(d),/Terreno de don Carlos/);
  d.values.listing_title='x'.repeat(46);
  assert.ok(M.pending(d).some(issue=>issue.label==='Nombre corto sugerido para el anuncio'));
});

test('access details only apply to a private route, and an old construction label is removed',()=>{
  const fields=M.steps.find(s=>s.id==='land').fields;
  const privateRoute=renderFields(fields,{access:'private'});
  assert.match(privateRoute,/data-conditional-group="access" open/);
  assert.match(privateRoute,/Documento sobre el derecho de paso/);
  const d=completeDraft();Object.assign(d.values,{access:'direct',private_length:'100',legal_access:'supplied',residential:'condo'});
  assert.doesNotMatch(M.buyerCopy(d),/Tramo privado indicado|Derecho de acceso:/);
  assert.match(M.buyerCopy(d),/Condominio con áreas comunes privadas/);
  const old=M.normalizeDraft({version:2,values:{buildings:'yes'},files:[]},'legacy-draft-1');
  assert.equal(old.buildings[0].name,'');
  assert.equal(M.buildingName({id:'legacy-building',name:'Construcción de la ficha anterior'},0),'Construcción 1');
});

test('hidden conditional answers do not open extra sections or become public claims',()=>{
  const d=completeDraft();Object.assign(d.values,{mobile:'reported',mobile_operator:'Claro',mobile_network:'5G',water:'none',water_provider:'Old provider'});
  const html=renderFields(M.steps.find(s=>s.id==='services').fields,d.values);
  assert.match(html,/data-visible="mobile_network" hidden/);
  assert.match(html,/data-visible="water_provider" hidden/);
  const copy=M.buyerCopy(d);
  assert.doesNotMatch(copy,/Claro|5G|Old provider/);
});

test('optional text and photo captions are escaped without losing saved answers',()=>{
  const html=renderFields(M.steps[0].fields,{intro:'<script>alert("x")</script>',name:'" onfocus="alert(1)'});
  assert.doesNotMatch(html,/<script>|value="" onfocus=/);
  assert.match(html,/&lt;script&gt;/);
  const d=completeDraft();d.values.buildings='yes';d.buildings=[{id:'cabin',name:'<img src=x>',kind:'cabin'}];
  d.files.push({...d.files[0],id:'exterior',category:'buildings',buildingId:'cabin',shot:'exterior'});
  assert.match(renderPhotoTour(d,f=>'https://storage.example/'+f.id),/Construcciones · &lt;img src=x&gt;/);
});

test('the tour orders subjects and shots, separates buildings, and excludes private documents',()=>{
  const d=completeDraft();d.values.buildings='yes';d.buildings=[{id:'house',name:'Casa principal',kind:'house'},{id:'cabin',kind:'cabin'}];
  const file=(id,category,shot,buildingId='',perspective='ground')=>({...d.files[0],id,category,shot,buildingId,perspective});
  d.files.push(file('inside','buildings','interior','house'),file('outside','buildings','exterior','house'),file('cabin-front','buildings','exterior','cabin'),file('view','surroundings','general'),file('meter','infrastructure','general'),file('drone','land','general','','drone'),file('private-photo','technical','general'));
  const tour=M.photoTour(d);
  assert.deepEqual(tour.map(s=>s.id),['land','access','surroundings','infrastructure','buildings-house','buildings-cabin']);
  assert.deepEqual(tour[0].files.map(f=>f.id),['land-1','land-2','drone']);
  assert.deepEqual(tour[1].files.map(f=>f.id),['road-1','entry-1']);
  assert.deepEqual(tour[4].files.map(f=>f.id),['outside','inside']);
  assert.match(M.photoCaption(d.files.find(f=>f.id==='outside'),d),/Casa principal · Exterior · Desde el suelo/);
  assert.match(M.photoCaption(d.files.find(f=>f.id==='drone'),d),/Dron/);
  const html=renderPhotoTour(d,f=>'https://storage.example/'+f.id);
  assert.match(html,/<strong>Portada<\/strong>/);assert.doesNotMatch(html,/plan-1|private-photo/);
  d.values.buildings='no';assert.doesNotMatch(renderPhotoTour(d,f=>'https://storage.example/'+f.id),/outside|inside|cabin-front/);
});

test('an area discrepancy is visible to the seller but blocks only approval',()=>{
  const d=completeDraft();d.values.documented_area='900';
  assert.match(areaNotice(d.values),/distintas.*Podés enviar/);
  assert.deepEqual(M.pending(d),[]);
  assert.ok(M.pending(d,{publication:true,review:{documented_area:900}}).some(i=>i.label.includes('diferencia')));
  assert.equal(areaNotice({area:'1000',documented_area:'1000.0'}),'');
  assert.equal(areaNotice({area:'bad',documented_area:'900'}),'');
});

test('buyer text covers services and access while preserving seller attribution',()=>{
  const d=completeDraft();Object.assign(d.values,{road:'Asfalto / concreto',access:'private',private_surface:'Lastre',private_length:'100',driveway:'yes',driveway_surface:'Tierra',water:'documented',water_source:'document',water_provider:'ASADA local',water_date:'2026-10-01',well:'yes',water_rights:'document',electricity:'active',electricity_source:'observed',electric_provider:'ICE',internet:'installed',internet_technology:'Fibra',mobile:'tested',mobile_operator:'Claro',mobile_network:'5G',rainwater:'Se acumula en algunas zonas',landuse_status:'available',landuse_activity:'Vivienda',current_use:'Cultivos o ganadería'});
  d.files.push({...d.files[4],id:'landuse',category:'landuse_file'});
  const copy=M.buyerCopy(M.validateDraft(d));
  for(const pattern of [/seguida de acceso privado de lastre/,/Camino interno de tierra/,/documentación indicada por el vendedor/,/observación indicada por el vendedor/,/Vigencia y alcance por confirmar/,/Potabilidad y derechos de uso por confirmar/,/Claro · 5G/,/Internet fijo: instalado · Fibra/,/Se acumula en algunas zonas/,/certificado aportado/,/Alcance pendiente de revisión/,/Los usos permitidos se revisan por separado/])assert.match(copy,pattern);
  assert.doesNotMatch(copy,/observado por ArenalIndex|Área indicada del plano revisado/);
});

test('incomplete currency choices cannot crash the live preview or masquerade as USD',()=>{
  const d=completeDraft();d.values.currency='unknown';
  assert.doesNotThrow(()=>M.buyerCopy(d));assert.doesNotMatch(M.buyerCopy(d),/Precio solicitado/);
  d.values.currency='CRC';d.values.documented_area='1000';
  assert.match(M.buyerCopy(d),/₡/);assert.match(M.buyerCopy(d),/Precio por m²/);
});

test('the optional checklist publishes positive findings with their source, never an unverified all-clear',()=>{
  const d=completeDraft();d.values.land_notes='El paso se estrecha cerca de la entrada.';
  const review=M.normalizeReview({inspection:{erosion:{state:'not_reported',note:'No proof of absence'},standing_water:{state:'reported',note:'En la parte baja'},rain_access:{state:'observed',note:'Durante la visita'},building_repairs:{state:'observed',note:'Dormant building'}}});
  const copy=M.buyerCopy(d,review);
  assert.match(copy,/El paso se estrecha/);assert.match(copy,/Acumulación de agua \(reportado por el vendedor\): En la parte baja/);
  assert.match(copy,/Dificultades de acceso en lluvia \(observado por ArenalIndex\): Durante la visita/);
  assert.doesNotMatch(copy,/No proof of absence|Dormant building|Erosión/);
  const sanitized=M.normalizeReview({documented_area:'Infinity',copy_checked:'true',inspection:{erosion:{state:'verified',note:'x'},boundaries:{state:'reported',note:'x'.repeat(700)},invented:{state:'observed'}}});
  assert.equal(sanitized.documented_area,0);assert.equal(sanitized.copy_checked,false);
  assert.equal(sanitized.inspection.boundaries.note.length,500);assert.equal(sanitized.inspection.erosion,undefined);assert.equal(sanitized.inspection.invented,undefined);
});
