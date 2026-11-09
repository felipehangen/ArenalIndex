import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as M from '../site/newlisting/model.mjs';
import {syncEntranceMarker} from '../site/newlisting/map.mjs';
import {createSaver} from '../site/newlisting/local.mjs';
import {submitDraft} from '../site/newlisting/api.mjs';
import {completeDraft,png} from './intake-fixtures.mjs';

test('unknown basic conditions are valid answers, but an untouched field is pending',()=>{
  const d=completeDraft();assert.deepEqual(M.pending(d),[]);
  delete d.values.water;assert.ok(M.pending(d).some(i=>i.label.includes('suministro')));
});
test('one usable contact method is enough and malformed numbers or email cannot submit',()=>{
  const d=completeDraft();delete d.values.email;d.values.phone='+506 8888 8888';assert.deepEqual(M.pending(d),[]);
  d.values.phone='12';d.values.area='-1';assert.ok(M.pending(d).some(i=>i.label==='Teléfono / WhatsApp'));assert.ok(M.pending(d).some(i=>i.label.includes('Área total')));
});
test('buildings are independent records and absent buildings skip their entire step',()=>{
  const d=completeDraft();assert.ok(!M.activeSteps(d).includes(4));
  d.values.buildings='yes';d.buildings=[{id:'house',kind:'house'},{id:'cabin',kind:'cabin'}];
  assert.ok(M.activeSteps(d).includes(4));assert.equal(M.photoIssues(d).length,2);
  d.values.photo_exception='No se pudo entrar a las construcciones.';assert.deepEqual(M.pending(d),[]);
  assert.ok(!M.pending(d).some(i=>i.label.includes('Área construida')));
});
test('submission and approval have distinct requirements and only documented area drives the price per m²',()=>{
  const d=completeDraft();assert.deepEqual(M.pending(d),[]);assert.equal(M.pricePerArea(d.values),null);
  const review={plan_number:'A-123',documented_area:900,plan_matches:true,copy_checked:true};
  assert.ok(M.pending(d,{publication:true,review}).some(i=>i.label.includes('diferencia')));
  review.discrepancy_resolved=true;assert.deepEqual(M.pending(d,{publication:true,review}),[]);
  assert.match(M.buyerCopy(d,review),/Precio por m²/);
});
test('cover must belong to the active public tour; document groups never satisfy it',()=>{
  const d=completeDraft();d.values.cover_id='plan-1';assert.ok(M.pending(d).some(i=>i.label.includes('portada')));
  assert.ok(!M.activeGroups(d.values).some(g=>g.id==='permits_file'));
});
test('photo completion follows classified shots and cover, independently of final permissions',()=>{
  const d=completeDraft(),photos=M.stepIndex('photos');
  delete d.values.photo_permission;delete d.values.cover_id;
  for(const file of d.files.filter(f=>f.category==='access'))file.shot='general';
  assert.equal(M.stepComplete(d,photos),false);
  assert.deepEqual(M.photoRequirements(d).filter(item=>!item.complete).map(item=>item.label),['Una foto de la entrada','Una foto de la vía de llegada','Elegir una foto de portada']);
  d.files.find(f=>f.id==='entry-1').shot='entrance';
  d.files.find(f=>f.id==='road-1').shot='road';
  d.values.cover_id='land-1';
  assert.equal(M.stepComplete(d,photos),true);
  assert.equal(M.stepComplete(d,M.stepIndex('review')),false);
  d.files=d.files.filter(f=>f.id!=='road-1');
  assert.equal(M.stepComplete(d,photos),false);
});
test('photo exceptions can explain missing shots but never replace a cover or reviewer acceptance',()=>{
  const d=completeDraft(),photos=M.stepIndex('photos');
  d.files=d.files.filter(f=>f.category!=='access');d.values.photo_exception='No pude fotografiar el acceso.';
  assert.equal(M.stepComplete(d,photos),true);
  assert.ok(M.pending(d,{publication:true}).some(issue=>issue.step===photos));
  assert.ok(!M.pending(d,{publication:true,review:{photo_exception_accepted:true}}).some(issue=>issue.step===photos));
  delete d.values.cover_id;assert.equal(M.stepComplete(d,photos),false);
});
test('sale data precedes review, and saved drafts preserve both the previous sale step and new final step',()=>{
  const d=completeDraft(),sale=M.stepIndex('sale'),review=M.stepIndex('review');
  assert.equal(sale,7);assert.equal(review,sale+1);
  const requiredSale=['price','currency','contact','phone','email','role'];
  assert.ok(requiredSale.every(id=>M.steps[sale].fields.some(field=>field.id===id)));
  assert.deepEqual(M.steps[review].fields.filter(field=>field.id).map(field=>field.id),['authorization','location_consent','photo_permission']);
  delete d.values.price;delete d.values.phone;delete d.values.email;delete d.values.authorization;
  const issues=M.pending(d);
  assert.equal(issues.find(issue=>issue.label==='Precio de venta').step,sale);
  assert.equal(issues.find(issue=>issue.label==='Un teléfono o correo de contacto').step,sale);
  assert.equal(issues.find(issue=>issue.label==='Autorización de publicación').step,review);
  d.values.authorization=true;assert.equal(M.stepComplete(d,review),false);
  for(const step of [sale,review])assert.equal(M.normalizeDraft({...d,step}).step,step);
});
test('the entrance marker and status are cleared when either coordinate is removed',()=>{
  let removed=false,message='',marker={setLngLat(){},remove(){removed=true;}};
  const controller={marker};
  syncEntranceMarker(controller,{lat:'',lng:'-84'},M.validPoint,()=>marker,m=>message=m);
  assert.equal(controller.marker,null);assert.equal(removed,true);assert.match(message,/Todavía no/);
});
test('legacy drafts retain answers, attachments and building details without treating the type as exclusive',()=>{
  const old={values:{type:'Terreno con casa',buildings:'yes',built_area:'200',water:'Conexión activa con medidor',province:'Alajuela'},files:[{id:'x',category:'exterior',caption:'Casa principal'}],step:5};
  const migrated=M.normalizeDraft(old,'legacy-draft-1');assert.equal(migrated.buildings[0].area,'200');assert.equal(migrated.values.water,'active');assert.equal(migrated.legacyValues.province,'Alajuela');assert.equal(migrated.files[0].category,'buildings');assert.equal(migrated.files[0].caption,'Casa principal');
});
test('backup restoration validates decoded contents and remaps the selected cover',()=>{
  const d=completeDraft();d.files=d.files.filter(f=>f.id==='land-1').map(f=>({...f,data:'data:image/png;base64,'+Buffer.from(png).toString('base64')}));
  const restored=M.importBackup({...d,format:'arenalindex-intake'},'restored-draft-1');
  assert.equal(restored.values.cover_id,restored.files[0].id);assert.equal(restored.files[0].blob.size,png.length);assert.equal(restored.submission,null);
  d.files[0].data='data:image/png;base64,'+Buffer.from('not an image').toString('base64');
  assert.throws(()=>M.importBackup({...d,format:'arenalindex-intake'},'restored-draft-2'),/contenido/);
});
test('file metadata validation rejects duplicate IDs and PDFs placed in the photo tour',()=>{
  const d=completeDraft();d.files.push({...d.files[0]});assert.throws(()=>M.validateDraft(d),/Archivo/);
  d.files.pop();d.files[4].category='land';assert.throws(()=>M.validateDraft(d),/fotografías/);
});
test('saves coalesce rapid edits and persist the last draft',async()=>{
  let value=1,release;const writes=[];
  const saver=createSaver(async snapshot=>{writes.push(snapshot);if(writes.length===1)await new Promise(resolve=>release=resolve);},()=>value,()=>{});
  const saving=saver();value=2;saver();value=3;saver();release();assert.equal(await saving,true);assert.deepEqual(writes,[1,3]);
});
test('a failed upload never finalizes a submission',async()=>{
  const d=completeDraft(),actions=[];
  const api={request:async(action)=>{actions.push(action);return {version:1,uploads:d.files.map(f=>({id:f.id,url:'https://storage.example/'+f.id}))};}};
  await assert.rejects(()=>submitDraft(d,api,()=>{},async()=>new Response('',{status:500})),/subir/);
  assert.deepEqual(actions,['prepare']);
});
test('new route uses absolute asset paths and old URL redirects without losing local storage',()=>{
  const html=fs.readFileSync(new URL('../site/newlisting/index.html',import.meta.url),'utf8');
  assert.match(html,/src="\/newlisting\/app\.mjs(?:\?[^"\s]*)?"/);
  assert.match(fs.readFileSync(new URL('../site/requisitos.html',import.meta.url),'utf8'),/location.replace\('\/newlisting\/'/);
  assert.match(fs.readFileSync(new URL('../site/requisitos/index.html',import.meta.url),'utf8'),/location.replace\('\/newlisting\/'\+location.search\+location.hash/);
  assert.match(fs.readFileSync(new URL('../site/newlisting/local.mjs',import.meta.url),'utf8'),/arenalindex-intake-v1/);
});

test('a lost submit response is recovered without a duplicate upload or new version',async()=>{
  const d=completeDraft(),actions=[];
  const api={async request(action){actions.push(action);if(action==='prepare')return {version:2,uploads:d.files.map(f=>({id:f.id,url:'https://storage.example/'+f.id}))};if(action==='submit')throw Error('Timeout');return {status:'ready_for_review',version:2,notificationSent:true};}};
  const received=await submitDraft(d,api,()=>{},async()=>new Response(''));
  assert.equal(received.status,'ready_for_review');assert.deepEqual(actions,['prepare','submit','status']);
});
