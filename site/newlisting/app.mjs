import * as M from './model.mjs';
import {openStore,createSaver} from './local.mjs';
import {createAPI,randomToken,submitDraft} from './api.mjs';
import {mountMap} from './map.mjs';
import {renderFields,renderPhotoTour,areaNotice} from './view.mjs';
const $=s=>document.querySelector(s);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api=createAPI();
let draft=M.newDraft(),storage,save,ready=false,busy=false,map,urls=new Map(),saveTimer,noticeTimer;
const status=text=>$('#save-status').textContent=text;
const locked=()=>!!draft.submission&&draft.submission.status!=='draft';
function notify(text){$('#notice').textContent=text;$('#notice').hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('#notice').hidden=true,8000);}
function confirm(title,copy){return new Promise(resolve=>{const dialog=$('#confirm-dialog');$('#confirm-title').textContent=title;$('#confirm-copy').textContent=copy;$('#confirm-ok').onclick=()=>{dialog.close();resolve(true);};$('#confirm-cancel').onclick=()=>{dialog.close();resolve(false);};dialog.oncancel=()=>resolve(false);dialog.showModal();});}
try {storage=await openStore();const previous=await storage.read();if(previous)draft=M.normalizeDraft(previous);status(previous?'Retomamos tu borrador':'El borrador se guarda en este navegador');}
catch {status('Sin guardado automático. Descargá una copia antes de salir.');}
save=createSaver(async snapshot=>{if(!storage)throw Error('Sin almacenamiento');await storage.write(snapshot);},()=>structuredClone(draft),status);
function changed(){draft.updated=new Date().toISOString();clearTimeout(saveTimer);saveTimer=setTimeout(()=>save(),300);}
function release(){map?.remove();map=null;urls.forEach(url=>URL.revokeObjectURL(url));urls.clear();}
function objectURL(blob){if(!urls.has(blob))urls.set(blob,URL.createObjectURL(blob));return urls.get(blob);}
const fields=items=>renderFields(items,draft.values);
function buildings(){
  return draft.buildings.map((b,i)=>'<section class="field-section"><h2>Construcción '+(i+1)+'</h2>'+renderFields(M.buildingFields,b,b.id+':')+'<button type="button" class="text-button" data-remove-building="'+b.id+'">Quitar esta construcción</button></section>').join('')+'<button type="button" class="secondary" data-action="add-building">+ Agregar construcción</button>';
}
const imageCaption=file=>M.photoCaption(file,draft);
function attachment(file){
  const image=file.type.startsWith('image/'),url=objectURL(file.blob),groups=M.activeGroups(draft.values);
  const current=groups.find(g=>g.id===file.category);
  const gallery=M.photoGroups.some(g=>g.id===file.category&&(!g.building||M.hasBuildings(draft.values)));
  return '<article class="attachment">'+(image?'<img src="'+url+'" alt="'+esc(imageCaption(file))+'" loading="lazy">':'<span class="file-icon">PDF</span>')+'<div class="attachment-info"><a href="'+url+'" download="'+esc(file.name)+'">'+esc(file.name)+'</a><small>'+esc(imageCaption(file))+' · '+Math.ceil(file.size/1024)+' KB</small><label>Grupo<select data-file="'+file.id+'" data-meta="category">'+(!current?'<option value="'+file.category+'" selected>Archivo conservado: '+esc(file.category)+'</option>':'')+groups.filter(g=>image||!M.photoGroups.some(p=>p.id===g.id)).map(g=>'<option value="'+g.id+'"'+(g.id===file.category?' selected':'')+'>'+esc(g.title)+'</option>').join('')+'</select></label>'+
    (image&&file.category==='access'?'<label>Qué muestra<select data-file="'+file.id+'" data-meta="shot">'+[['general','Elegir toma'],['entrance','Entrada'],['road','Vía de llegada']].map(([v,l])=>'<option value="'+v+'"'+(file.shot===v?' selected':'')+'>'+l+'</option>').join('')+'</select></label>':'')+
    (image&&file.category==='buildings'?'<label>Construcción<select data-file="'+file.id+'" data-meta="buildingId"><option value="">Elegir construcción</option>'+draft.buildings.map((b,i)=>'<option value="'+b.id+'"'+(file.buildingId===b.id?' selected':'')+'>'+esc(b.name||'Construcción '+(i+1))+'</option>').join('')+'</select></label><label>Toma<select data-file="'+file.id+'" data-meta="shot">'+[['general','Elegir toma'],['exterior','Exterior'],['interior','Interior']].map(([v,l])=>'<option value="'+v+'"'+(file.shot===v?' selected':'')+'>'+l+'</option>').join('')+'</select></label>':'')+
    (image&&gallery?'<label>Punto de vista<select data-file="'+file.id+'" data-meta="perspective"><option value="ground"'+(file.perspective!=='drone'?' selected':'')+'>Desde el suelo</option><option value="drone"'+(file.perspective==='drone'?' selected':'')+'>Dron</option></select></label><button type="button" class="cover-button" data-cover="'+file.id+'">'+(draft.values.cover_id===file.id?'✓ Portada elegida':'Usar de portada')+'</button>':'')+
    '</div><button type="button" data-remove-file="'+file.id+'" aria-label="Quitar '+esc(file.name)+'">Quitar</button></article>';
}
function attachments(photo){
  const original=photo?M.photoGroups:M.documentGroups;
  const groups=original.filter(g=>!g.building||M.hasBuildings(draft.values)||draft.files.some(f=>f.category===g.id));
  const cover=draft.files.find(f=>f.id===draft.values.cover_id&&f.type.startsWith('image/'));
  return (photo?'<section class="cover-card"><div><p class="eyebrow">LA PRIMERA IMPRESIÓN</p><h2>Elegí una portada</h2><p>Usá una foto que represente el terreno. La selección no duplica el archivo.</p></div><div id="cover-preview">'+(cover?'<img src="'+objectURL(cover.blob)+'" alt="Portada elegida">':'Todavía no elegiste una portada.')+'</div></section>':'')+
    '<p class="map-note">'+(photo?'JPG, PNG o WebP. Exportá HEIC como JPG.':'JPG, PNG, WebP o PDF.')+' Hasta 12 MB por archivo y 60 MB en total.</p>'+groups.map((g,i)=>{
      const inactive=g.building&&!M.hasBuildings(draft.values),list=draft.files.filter(f=>f.category===g.id);
      return '<details class="photo-section" data-group="'+g.id+'"'+(i===0||list.length?' open':'')+'><summary><span>'+esc(g.title)+(inactive?' · archivos conservados':'')+'</span><span class="photo-count">'+list.length+' archivo(s)</span></summary><div class="upload-content"><p>'+esc(g.help)+'</p>'+(inactive?'<p class="note">Estos archivos se conservan. Podés moverlos o quitarlos; no se incluirán en el recorrido de un terreno sin construcciones.</p>':'<label class="file-picker">Agregar '+(photo?'fotos':'archivos')+'<input type="file" data-upload="'+g.id+'" accept="'+(photo?'image/jpeg,image/png,image/webp':'image/jpeg,image/png,image/webp,application/pdf')+'" multiple></label>')+list.map(attachment).join('')+'</div></details>';
    }).join('');
}
function review(){
  const issues=M.pending(draft),exception=M.photoIssues(draft);
  return '<section id="review-summary"><div class="section-divider"><h2>'+ (issues.length?'Antes de enviar':'Tu propuesta está lista para enviar')+'</h2><p>'+draft.files.length+' archivo(s) · '+issues.length+' dato(s) pendiente(s)</p></div>'+
    '<div class="review-list">'+issues.map(i=>'<div class="review-item"><span>'+esc(i.label)+'</span><button type="button" data-step="'+i.step+'">Completar →</button></div>').join('')+'</div>'+
    (exception.length&&draft.values.photo_exception?'<p class="note">Se enviará una excepción de fotografías para revisión: '+esc(draft.values.photo_exception)+'</p>':'')+
    (areaNotice(draft.values)?'<p class="note area-note">'+esc(areaNotice(draft.values))+'</p>':'')+
    '<h2>Vista previa del anuncio</h2><p class="map-note">Texto preparado con tus respuestas. ArenalIndex lo revisará antes de publicar.</p><div class="buyer-preview">'+esc(M.buyerCopy(draft))+'</div>'+
    (M.knownConcerns(draft).length?'<details class="review-detail" data-review-section="concerns" open><summary>Condiciones que revisaremos contigo</summary><ul>'+M.knownConcerns(draft).map(n=>'<li>'+esc(n)+'</li>').join('')+'</ul></details>':'')+
    (M.photoTour(draft).length?'<details class="review-detail" data-review-section="photos"><summary>Ver el recorrido de fotos</summary>'+renderPhotoTour(draft,file=>objectURL(file.blob))+'</details>':'')+
    '<details class="review-detail" data-review-section="answers"><summary>Revisar todas las respuestas</summary>'+M.steps.map(s=>'<h3>'+esc(s.short)+'</h3><dl>'+s.fields.filter(f=>f.id&&M.visible(f,draft.values)).map(f=>'<dt>'+esc(f.label)+'</dt><dd>'+esc(M.label(f,draft.values[f.id]))+'</dd>').join('')+'</dl>').join('')+'</details>'+
    '<p class="note">Al enviar, tus respuestas y archivos se compartirán de forma privada con ArenalIndex. La ficha quedará como <strong>Lista para revisión de publicación</strong>. Los documentos no aparecerán en el anuncio.</p>'+
    (!ready?'<p class="service-status" role="status">El envío todavía no está habilitado. Podés preparar tu ficha y guardar una copia; tus datos permanecen en este navegador.</p>':'')+
    '<div class="actions"><button class="secondary" type="button" data-action="backup">Guardar copia completa</button><button class="secondary" type="button" data-action="summary">Resumen de texto</button></div></section>';
}
function submissionState(){
  const s=draft.submission;
  if(!s){$('#submission-state').innerHTML='<span class="draft-badge">Borrador</span>';return;}
  $('#submission-state').innerHTML='<section class="submission-banner"><strong>'+esc(M.STATES[s.status]||s.status)+'</strong><p>Versión '+s.version+'. '+(s.status==='approved'?'Aprobada para preparar la publicación.':s.status==='draft'?'La versión anterior se retiró de revisión. Enviá los cambios cuando estén listos.':'La ficha enviada se conserva como una versión para revisión.')+'</p>'+(s.feedback?'<p>'+esc(s.feedback)+'</p>':'')+(s.status==='ready_for_review'&&!s.notificationSent?'<p>Tu ficha está recibida, pero el correo de aviso sigue pendiente.</p><button class="secondary" data-action="retry-email">Reintentar aviso</button>':'')+(locked()?'<button class="secondary" data-action="edit">Editar y volver a enviar</button>':'')+' <button class="quiet" data-action="refresh">Actualizar estado</button></section>';
}
function updateReview(){
  if(draft.step===7&&$('#review-summary')){
    const disclosureState=new Map([...document.querySelectorAll('[data-review-section]')].map(el=>[el.dataset.reviewSection,el.open]));
    $('#review-summary').outerHTML=review();
    for(const el of document.querySelectorAll('[data-review-section]'))if(disclosureState.has(el.dataset.reviewSection))el.open=disclosureState.get(el.dataset.reviewSection);
  }
  const notice=$('#area-notice');if(notice){notice.textContent=areaNotice(draft.values);notice.hidden=!notice.textContent;}
  const issues=M.pending(draft);
  for(const button of document.querySelectorAll('.nav-step')){
    const complete=!issues.some(issue=>issue.step===Number(button.dataset.step));
    button.querySelector('.step-complete').hidden=!complete;
  }
  $('#draft-reference').textContent=M.reference(draft);
  $('#next').disabled=busy||(draft.step===7&&!locked()&&(!ready||issues.length>0));
}
function render(focus=true){
  release();const s=M.steps[draft.step],active=M.activeSteps(draft);
  $('#steps').innerHTML=active.map((i,n)=>'<button class="nav-step" data-step="'+i+'"'+(i===draft.step?' aria-current="step"':'')+'><span class="step-number">'+(n+1)+'</span>'+esc(M.steps[i].short)+'<span class="step-complete" aria-label="Completado" hidden>✓</span></button>').join('');
  $('#step-select').innerHTML=active.map((i,n)=>'<option value="'+i+'"'+(i===draft.step?' selected':'')+'>'+(n+1)+' · '+esc(M.steps[i].short)+'</option>').join('');
  $('#step-count').textContent='PASO '+(active.indexOf(draft.step)+1)+' / '+active.length;$('#progress').max=active.length;$('#progress').value=active.indexOf(draft.step)+1;
  let content=fields(s.fields);
  if(s.id==='location')content='<div id="entry-map" class="map"></div><p id="map-status" class="map-note" role="status"></p><button type="button" class="secondary" data-action="gps">Estoy en la entrada · usar GPS</button><details class="coordinate-entry"><summary>Ingresar coordenadas</summary>'+fields(s.fields.filter(f=>['lat','lng'].includes(f.id)))+'</details>'+fields(s.fields.filter(f=>!['lat','lng'].includes(f.id)))+'<p class="map-note">La ubicación del teléfono no constituye un levantamiento de linderos.</p>';
  if(s.id==='buildings')content=buildings();
  if(s.id==='photos')content=attachments(true)+content;
  if(['land','documents'].includes(s.id))content+='<p id="area-notice" class="note area-note" role="status" hidden></p>';
  if(s.id==='documents')content=content+attachments(false);
  $('#step-body').innerHTML='<p class="eyebrow">'+esc(s.short)+'</p><h1>'+esc(s.title)+'</h1><p class="lead">'+esc(s.lead)+'</p><fieldset class="form-shell"'+(locked()||busy?' disabled':'')+'>'+content+'</fieldset>'+(s.id==='review'?review():'');
  if(s.id==='location')map=mountMap($('#entry-map'),draft.values,(lng,lat,method)=>{
    if(locked()||busy)return;
    draft.values.lng=String(Number(lng.toFixed(6)));draft.values.lat=String(Number(lat.toFixed(6)));draft.values.location_method=method;draft.values.exact=false;
    $('#field-lng').value=draft.values.lng;$('#field-lat').value=draft.values.lat;$('#field-location_method').value=method;$('#field-exact').checked=false;map?.update(draft.values);changed();
  },message=>{if($('#map-status'))$('#map-status').textContent=message;});
  $('#previous').disabled=busy||active.indexOf(draft.step)===0;
  $('#next').textContent=draft.step===7?(locked()?'Actualizar estado':'Enviar para revisión'):'Continuar →';
  for(const id of ['backup','restore','new-draft','step-select'])$('#'+id).disabled=busy;
  submissionState();updateReview();
  if(focus){$('#content').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
}
async function go(step){
  if(busy)return notify('Esperá a que termine la operación.');
  if(step===4&&!M.hasBuildings(draft.values))step=5;
  draft.step=Math.max(0,Math.min(7,step));await save();render();
}
async function verifyFile(file){
  if(!M.TYPES.includes(file.type)||file.size>M.MAX_FILE||file.size<1)throw Error('Usá JPG, PNG, WebP o PDF de hasta 12 MB.');
  const bytes=new Uint8Array(await file.slice(0,32).arrayBuffer());
  if(!M.validSignature(file.type,bytes,file.size))throw Error('No se reconoció el contenido de '+(file.name||'un archivo')+'.');
  if(file.type.startsWith('image/')){
    const bitmap=await createImageBitmap(file).catch(()=>{throw Error('La imagen '+(file.name||'adjunta')+' está dañada.');});
    bitmap.close();
  }
}
async function addFiles(input){
  if(busy||locked())return;
  const selected=[...input.files],category=input.dataset.upload,errors=[];busy=true;render(false);
  try {
    for(const file of selected){
      try {
        if(M.photoGroups.some(g=>g.id===category)&&!file.type.startsWith('image/'))throw Error('El recorrido solo admite fotografías.');
        if(draft.files.reduce((sum,f)=>sum+f.size,0)+file.size>M.MAX_TOTAL)throw Error('La ficha supera 60 MB.');
        if(draft.files.length>=120)throw Error('El máximo es 120 archivos por ficha.');
        await verifyFile(file);
        draft.files.push({id:crypto.randomUUID(),category,name:file.name,type:file.type,size:file.size,blob:file,shot:'general',perspective:'ground',buildingId:''});
      }catch(error){errors.push(file.name+': '+error.message);}
    }
    changed();await save();
  }finally{busy=false;render(false);if(errors.length)notify(errors.join(' '));}
}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
const dataURL=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});
async function backup(){
  if(busy)return;busy=true;render(false);
  try {
    await save();const snapshot=structuredClone(draft);
    const files=await Promise.all(snapshot.files.map(async({blob,...f})=>({...f,data:await dataURL(blob)})));
    const {submission,accessToken,...portable}=snapshot;
    download(new Blob([JSON.stringify({...portable,format:'arenalindex-intake',files},null,2)],{type:'application/json'}),'arenalindex-'+draft.id.slice(0,8)+'.json');
    notify('Copia preparada. Guardá el archivo para restaurar una copia del borrador.');
  }catch{notify('No se pudo preparar la copia. Conservá esta página e intentá de nuevo.');}
  finally{busy=false;render(false);}
}
function summary(){
  let content=M.reference(draft)+'\nBORRADOR · No publicado ni verificado\n\n'+M.buyerCopy(draft)+'\n\n';
  for(const s of M.steps){content+=s.short.toUpperCase()+'\n';for(const f of s.fields.filter(f=>f.id&&M.visible(f,draft.values)))content+=f.label+': '+M.label(f,draft.values[f.id])+'\n';content+='\n';}
  content+='CONSTRUCCIONES\n'+draft.buildings.map(b=>M.buildingFields.map(f=>f.label+': '+M.label(f,b[f.id])).join('\n')).join('\n\n');
  content+='\n\nPENDIENTES\n'+M.pending(draft).map(i=>i.label).join('\n')+'\n\nARCHIVOS\n'+draft.files.map(f=>imageCaption(f)+': '+f.name).join('\n');
  download(new Blob([content],{type:'text/plain;charset=utf-8'}),'arenalindex-'+draft.id.slice(0,8)+'-resumen.txt');
}
async function restore(file){
  if(!file||busy)return;if(file.size>90*1024*1024)return notify('La copia supera 90 MB.');
  busy=true;render(false);
  try {
    const restored=M.importBackup(JSON.parse(await file.text()),crypto.randomUUID());
    for(const f of restored.files)await verifyFile(f.blob);
    if(await confirm('¿Restaurar esta copia?','Reemplazará el borrador de este navegador. La ficha enviada, si existe, se conserva en ArenalIndex.')){draft=restored;await save();}
  }catch(error){notify(error.message||'No se pudo restaurar la copia.');}
  finally{busy=false;$('#restore-file').value='';render();}
}
async function send(){
  if(busy||locked()||!ready)return;
  const issues=M.pending(draft);if(issues.length)return notify('Completá los datos indicados antes de enviar.');
  if(!await confirm('¿Enviar la ficha para revisión?','Compartirás tus respuestas y archivos de forma privada con ArenalIndex. El anuncio se publicará después de su aprobación.'))return;
  busy=true;draft.accessToken ||= randomToken();await save();render(false);
  try {draft.submission=await submitDraft(draft,api,notify);await save();notify('Ficha recibida: lista para revisión de publicación.');}
  catch(error){
    const received=await api.request('status',{id:draft.id},draft.accessToken).catch(()=>null);
    if(received&&received.status!=='draft'){draft.submission=received;await save();notify('La ficha ya está recibida. Actualizamos su estado.');}
    else notify(error.message+' Tu borrador se conserva; podés reintentar.');
  }
  finally{busy=false;render(false);}
}
async function refresh(){
  if(busy||!draft.accessToken)return;busy=true;
  try {draft.submission=await api.request('status',{id:draft.id},draft.accessToken);await save();}
  catch(error){notify(error.message);}finally{busy=false;render(false);}
}
async function retryEmail(){
  if(busy||draft.submission?.status!=='ready_for_review')return;busy=true;
  try{draft.submission=await api.request('submit',{id:draft.id,version:draft.submission.version},draft.accessToken);await save();notify(draft.submission.notificationSent?'Aviso enviado a ArenalIndex.':'La ficha está guardada. No se pudo enviar el aviso; intentá más tarde.');}
  catch(error){notify(error.message);}finally{busy=false;render(false);}
}
async function edit(){
  if(busy||!draft.submission)return;
  if(!await confirm('¿Editar la ficha enviada?','La aprobación anterior quedará invalidada. Tendrás que enviar los cambios para una nueva revisión.'))return;
  busy=true;
  try {draft.submission=await api.request('reopen',{id:draft.id,version:draft.submission.version},draft.accessToken);await save();}
  catch(error){notify(error.message);}finally{busy=false;render(false);}
}
document.addEventListener('input',event=>{
  const el=event.target;if(!el.dataset.key||busy||locked())return;
  const values=el.dataset.building?draft.buildings.find(b=>b.id===el.dataset.building):draft.values;if(!values)return;
  values[el.dataset.key]=el.type==='checkbox'?el.checked:el.value;
  if(['lat','lng'].includes(el.dataset.key)){draft.values.exact=false;draft.values.location_method='coordinates';$('#field-exact').checked=false;$('#field-location_method').value='coordinates';}
  if(['lat','lng','exact'].includes(el.dataset.key))map?.update(draft.values);
  for(const f of M.steps[draft.step].fields.filter(f=>f.id)) {const wrapper=$('[data-visible="'+f.id+'"]');if(wrapper)wrapper.hidden=!M.visible(f,draft.values);}
  if(el.dataset.key==='buildings'){const previousStep=draft.step;render(false);draft.step=previousStep;}
  changed();updateReview();
});
document.addEventListener('change',event=>{
  const el=event.target;if(el.dataset.upload)return addFiles(el);
  if(el.dataset.file&&!busy&&!locked()){
    const file=draft.files.find(f=>f.id===el.dataset.file);if(!file)return;
    file[el.dataset.meta]=el.value;
    if(el.dataset.meta==='category'){file.shot='general';file.buildingId='';if(!M.photoGroups.some(g=>g.id===file.category)&&draft.values.cover_id===file.id)delete draft.values.cover_id;}
    changed();render(false);
  }
  if(['lat','lng'].includes(el.dataset.key))map?.center(draft.values);
});
document.addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button||button.disabled)return;
  if(button.dataset.step)return go(Number(button.dataset.step));
  if(button.dataset.cover&&!locked()){draft.values.cover_id=button.dataset.cover;changed();render(false);}
  if(button.dataset.removeFile&&!locked()&&await confirm('¿Quitar este archivo?','El original en tu dispositivo no cambia.')){draft.files=draft.files.filter(f=>f.id!==button.dataset.removeFile);if(draft.values.cover_id===button.dataset.removeFile)delete draft.values.cover_id;changed();render(false);}
  if(button.dataset.removeBuilding&&!locked()&&await confirm('¿Quitar esta construcción?','Sus fotos se conservan para que podás reasignarlas o quitarlas.')){draft.buildings=draft.buildings.filter(b=>b.id!==button.dataset.removeBuilding);changed();render(false);}
  const action=button.dataset.action;
  if(action==='add-building'&&!locked()){if(draft.buildings.length>=30)return notify('Se admite un máximo de 30 construcciones.');draft.buildings.push({id:crypto.randomUUID(),kind:'',name:''});changed();render(false);}
  if(action==='backup')backup();if(action==='summary')summary();if(action==='refresh')refresh();if(action==='edit')edit();if(action==='retry-email')retryEmail();
  if(action==='gps'&&!locked()){
    if(!navigator.geolocation)return notify('El GPS no está disponible. Usá el mapa o las coordenadas.');
    navigator.geolocation.getCurrentPosition(p=>{if(draft.step!==1||locked())return;draft.values.lng=String(p.coords.longitude);draft.values.lat=String(p.coords.latitude);draft.values.location_method='gps';draft.values.exact=false;changed();render(false);notify('Ubicación aproximada del GPS: '+Math.round(p.coords.accuracy)+' m. Comprobá que corresponde a la entrada.');},()=>notify('No se pudo obtener el GPS. Podés marcar la entrada en el mapa.'),{enableHighAccuracy:true,timeout:15000,maximumAge:0});
  }
});
$('#step-select').onchange=e=>go(Number(e.target.value));
$('#previous').onclick=()=>{const active=M.activeSteps(draft);go(active[active.indexOf(draft.step)-1]);};
$('#next').onclick=()=>draft.step===7?(locked()?refresh():send()):go(M.activeSteps(draft)[M.activeSteps(draft).indexOf(draft.step)+1]);
$('#backup').onclick=backup;$('#restore').onclick=()=>$('#restore-file').click();$('#restore-file').onchange=e=>restore(e.target.files[0]);
$('#new-draft').onclick=async()=>{if(!busy&&await confirm('¿Empezar otra propiedad?','Guardá una copia si querés conservar este borrador en tu dispositivo. Las fichas enviadas se conservan en ArenalIndex.')){draft=M.newDraft();await save();render();}};
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')save();});
render(false);
ready=await api.available();updateReview();
if(draft.accessToken)refresh();
