import * as M from './model.mjs?v=5-pending';
import {renderPhotoTour} from './view.mjs';
const params=new URLSearchParams(location.hash.slice(1)),id=params.get('id'),token=params.get('token');
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let record,busy=false;
async function request(action,body={}){
  const response=await fetch(ArenalConfig.intakeUrl||'/api/intake',{method:'POST',headers:{'Content-Type':'application/json','X-Review-Token':token},body:JSON.stringify({action,id,...body}),signal:AbortSignal.timeout(30000)});
  const result=await response.json();if(!response.ok)throw Error(result.error||'No se pudo completar la revisión.');return result;
}
function checks(){
  return {
    plan_number:$('#plan-number').value,documented_area:$('#documented-area').value,
    plan_matches:$('#plan-matches').checked,discrepancy_resolved:$('#discrepancy-resolved').checked,
    photo_exception_accepted:$('#photo-exception').checked,copy_checked:$('#copy-checked').checked,
    inspection:Object.fromEntries(M.inspectionItems.filter(item=>!item.building||M.hasBuildings(record.draft.values)).map(item=>[item.id,{state:$('#inspection-'+item.id).value,note:$('#inspection-note-'+item.id).value}]))
  };
}
function inspection(review,draft){
  return '<details class="review-detail inspection-panel"'+(Object.values(review.inspection||{}).some(f=>f.state)?' open':'')+'><summary>Lista interna de condiciones · opcional</summary><p class="map-note">Podés registrar lo que ya se sabe sin exigir una visita ni una inspección profesional. Las condiciones reportadas u observadas se incluirán en el texto para el comprador.</p>'+M.inspectionItems.filter(item=>!item.building||M.hasBuildings(draft.values)).map(item=>{
    const finding=review.inspection?.[item.id]||{};
    return '<div class="inspection-item"><label for="inspection-'+item.id+'">'+esc(item.label)+'</label><select id="inspection-'+item.id+'" data-copy-source>'+M.inspectionStates.map(([id,label])=>'<option value="'+id+'"'+(id===(finding.state||'')?' selected':'')+'>'+esc(label)+'</option>').join('')+'</select><div data-inspection-detail="'+item.id+'"'+(!['reported','observed'].includes(finding.state)?' hidden':'')+'><label for="inspection-note-'+item.id+'">Aclaración para el comprador · opcional</label><textarea id="inspection-note-'+item.id+'" maxlength="500" data-copy-source>'+esc(finding.note||'')+'</textarea></div></div>';
  }).join('')+'</details>';
}
function render(){
  const d=record.draft,r=record.review||{},editable=record.status==='ready_for_review';
  const concerns=M.knownConcerns(d,r);
  const gallery=M.photoTour(d).flatMap(section=>section.files);
  const documents=d.files.filter(f=>!gallery.includes(f));
  $('#review-content').innerHTML='<p class="eyebrow">VERSIÓN '+record.version+'</p><h1>'+esc(M.reference(d))+'</h1><p class="review-status">'+esc(M.STATES[record.status])+'</p><p>La aprobación corresponde a esta versión. Si el vendedor reabre la ficha, deberá enviarla nuevamente.</p>'+
    '<section class="field-section"><h2>Contacto para aclaraciones</h2><p>'+esc(d.values.contact)+' · '+esc(d.values.phone||d.values.email)+'</p><p>'+esc(d.values.email||'')+'</p><p><a target="_blank" rel="noopener noreferrer" href="https://www.openstreetmap.org/?mlat='+encodeURIComponent(d.values.lat)+'&mlon='+encodeURIComponent(d.values.lng)+'#map=17/'+encodeURIComponent(d.values.lat)+'/'+encodeURIComponent(d.values.lng)+'">Ver la entrada en el mapa</a></p></section>'+
    '<section class="field-section"><h2>Anuncio preparado</h2><div class="buyer-preview" id="buyer-copy">'+esc(M.buyerCopy(d,r))+'</div><p class="map-note">El nombre corto, si se indicó, es una sugerencia del vendedor. Decidí el título definitivo al preparar la ficha pública. La información se atribuye al vendedor salvo las observaciones que ArenalIndex registre expresamente. Recibir documentos y aprobar la publicación no constituyen una verificación profesional.</p></section>'+
    '<section class="field-section"><h2>Condiciones y excepciones</h2><div id="review-concerns">'+(concerns.length?'<ul>'+concerns.map(n=>'<li>'+esc(n)+'</li>').join('')+'</ul>':'<p>No se agregaron notas de condiciones.</p>')+'</div>'+(d.values.photo_exception?'<p><strong>Fotos pendientes:</strong> '+esc(d.values.photo_exception)+'</p>':'')+'<p>'+esc(d.values.documents_notes||'')+'</p></section>'+
    '<section class="field-section"><h2>Recorrido de fotografías</h2>'+renderPhotoTour(d)+'</section>'+
    '<section class="field-section"><h2>Documentos privados</h2><div class="review-files">'+documents.map(f=>'<a href="'+esc(f.url)+'" target="_blank" rel="noopener noreferrer">'+esc(f.name)+' · '+esc([...M.documentGroups,...M.photoGroups].find(g=>g.id===f.category)?.title||f.category)+'</a>').join('')+'</div><p class="map-note">Los enlaces a archivos vencen en 10 minutos. Recargá esta página para renovarlos.</p></section>'+
    '<details class="review-detail"><summary>Todas las respuestas</summary>'+M.steps.map(s=>'<h3>'+esc(s.short)+'</h3><dl>'+s.fields.filter(f=>f.id&&M.visible(f,d.values)).map(f=>'<dt>'+esc(f.label)+'</dt><dd>'+esc(M.label(f,d.values[f.id]))+'</dd>').join('')+'</dl>').join('')+'<h3>Construcciones</h3>'+d.buildings.map(b=>'<dl>'+M.buildingFields.map(f=>'<dt>'+esc(f.label)+'</dt><dd>'+esc(M.label(f,b[f.id]))+'</dd>').join('')+'</dl>').join('')+'</details>'+
    '<form id="review-form"><fieldset class="form-shell"'+(!editable?' disabled':'')+'><section class="field-section"><h2>Revisión antes de aprobar</h2><div class="form-grid"><div class="field"><label for="plan-number">Número de plano confirmado</label><input id="plan-number" maxlength="40" value="'+esc(r.plan_number||d.values.plan||'')+'"></div><div class="field"><label for="documented-area">Área documentada (m²)</label><input id="documented-area" data-copy-source type="number" min="1" max="999999999" step="any" value="'+esc(r.documented_area||d.values.documented_area||'')+'"></div></div><p>Área declarada por el vendedor: '+esc(d.values.area)+' m².</p><div class="approval-checks">'+[
      ['plan-matches','Confirmé que el plano corresponde a la propiedad.',r.plan_matches],
      ['discrepancy-resolved','La diferencia de área, si existe, fue resuelta.',r.discrepancy_resolved],
      ['photo-exception','Acepto la excepción de fotografías, si se solicitó.',r.photo_exception_accepted]
    ].map(([id,label,checked])=>'<label><input id="'+id+'" type="checkbox"'+(checked?' checked':'')+'>'+label+'</label>').join('')+'</div>'+inspection(r,d)+'<div class="approval-checks copy-confirmation"><label><input id="copy-checked" type="checkbox"'+(r.copy_checked?' checked':'')+'>Revisé texto, fotos, permisos y condiciones conocidas; se representarán correctamente en la publicación.</label></div><label for="feedback">Comentarios o cambios que debe realizar el vendedor</label><textarea id="feedback" maxlength="3000">'+esc(record.feedback||'')+'</textarea><div id="approval-pending" class="map-note"></div><div class="actions"><button class="primary" type="submit" id="approve">Aprobar para publicar</button><button class="secondary" type="button" id="request-changes">Solicitar cambios</button></div><p class="map-note">Aprobar guarda la versión autorizada para preparar la publicación. La ficha no se agrega automáticamente al catálogo público.</p></section></fieldset></form><p id="review-message" role="status"></p>';
  $('#review-form').oninput=updateChecks;
  $('#review-form').onsubmit=e=>{e.preventDefault();decide('approve');};
  $('#request-changes').onclick=()=>decide('request_changes');
  if(editable)updateChecks();
  renderPublishing();
}
function updateChecks(event){
  if(event?.target.matches('[data-copy-source],#plan-matches'))$('#copy-checked').checked=false;
  const review=checks(),issues=M.pending(record.draft,{publication:true,review});
  for(const item of M.inspectionItems){const detail=$('[data-inspection-detail="'+item.id+'"]');if(detail)detail.hidden=!['reported','observed'].includes(review.inspection[item.id]?.state);}
  const concerns=M.knownConcerns(record.draft,review);$('#review-concerns').innerHTML=concerns.length?'<ul>'+concerns.map(note=>'<li>'+esc(note)+'</li>').join('')+'</ul>':'<p>No se agregaron notas de condiciones.</p>';
  $('#buyer-copy').textContent=M.buyerCopy(record.draft,review);
  $('#approval-pending').textContent=issues.length?'Pendiente: '+issues.map(i=>i.label).join(' · '):'Lista para tu aprobación.';
  $('#approve').disabled=busy||issues.length>0;
}
async function decide(action){
  if(busy)return;const review=checks(),feedback=$('#feedback').value;
  busy=true;$('#review-form fieldset').disabled=true;$('#approve').disabled=true;$('#request-changes').disabled=true;
  try{
    const result=await request(action,{version:record.version,review,feedback});
    record={...record,...result,review:M.normalizeReview(review)};render();$('#review-message').textContent=action==='approve'?'Versión aprobada para publicar.':'Se guardó la solicitud de cambios. El vendedor la verá al actualizar el estado de su ficha.';
  }catch(error){$('#review-message').textContent=error.message;}
  finally{busy=false;if(record.status==='ready_for_review'){$('#review-form fieldset').disabled=false;updateChecks();$('#request-changes').disabled=false;}}
}

function editorial(){return {title:$('#public-title').value,place:$('#public-place').value,description:$('#public-description').value,whatsapp:$('#public-whatsapp').value};}
function renderPublishing(){
  if(record.status!=='approved'&&!record.publishedVersion)return;
  const data=record.editorial||{},node=document.createElement('section');node.className='field-section publication-panel';
  node.innerHTML='<h2>'+ (record.publishedVersion?'Publicación del anuncio':'Preparar la ficha pública')+'</h2><p>Elegí el título definitivo y revisá la presentación completa antes de publicarla.</p><div class="form-grid"><div class="field"><label for="public-title">Título público · máximo 45 caracteres</label><input id="public-title" maxlength="45" value="'+esc(data.title||record.draft.values.listing_title||'')+'"><p class="map-note">Un rasgo concreto y comprobable. Sin datos personales, dirección exacta, precio, emojis ni mayúsculas sostenidas.</p></div><div class="field"><label for="public-place">Localidad pública</label><input id="public-place" maxlength="100" placeholder="Por ejemplo, El Castillo · La Fortuna" value="'+esc(data.place||'')+'"></div></div><label for="public-description">Introducción del anuncio · opcional</label><textarea id="public-description" maxlength="1200" placeholder="Describí brevemente lo que hace especial a la propiedad.">'+esc(data.description||'')+'</textarea><label for="public-whatsapp">WhatsApp público de consultas · opcional</label><input id="public-whatsapp" type="tel" maxlength="25" placeholder="506…" value="'+esc(data.whatsapp||'')+'"><p class="map-note">Se mostrará como contacto de venta. El contacto privado del vendedor no se copia automáticamente.</p><div class="approval-checks"><label><input id="public-confirm" type="checkbox">Revisé la vista previa y autorizo este título, la ubicación de entrada, el contacto público y las fotos seleccionadas para el anuncio.</label></div><div class="actions"><button type="button" class="secondary" id="public-preview">Ver como comprador</button><button type="button" class="primary" id="public-publish" disabled>'+ (record.publishedVersion?'Actualizar anuncio público':'Publicar en ArenalIndex')+'</button>'+ (record.publishedVersion?'<button type="button" class="secondary" id="public-unpublish">Retirar del catálogo</button>':'')+'</div><p class="map-note">Los documentos adjuntos, la referencia privada y los comentarios internos no se publican. Una nueva edición de la ficha conserva la última versión publicada hasta que se actualice o retire.</p><p id="public-message" role="status"></p>';
  $('#review-content').append(node);
  node.oninput=e=>{if(e.target.id!=='public-confirm')$('#public-confirm').checked=false;$('#public-publish').disabled=busy||!$('#public-confirm').checked||record.status!=='approved';};
  $('#public-preview').disabled=record.status!=='approved';
  $('#public-preview').onclick=()=>publishAction('preview_publication');$('#public-publish').onclick=()=>publishAction('publish');
  if($('#public-unpublish'))$('#public-unpublish').onclick=()=>publishAction('unpublish');
}
async function publishAction(action){
  if(busy)return;
  const preview=action==='preview_publication'?window.open('about:blank','_blank'):null;
  if(action==='preview_publication'&&!preview){$('#public-message').textContent='Permití abrir la vista previa en una pestaña nueva e intentá de nuevo.';return;}
  busy=true;document.querySelectorAll('.publication-panel button').forEach(b=>b.disabled=true);
  try{
    const result=await request(action,{version:record.version,publicationRevision:record.publicationRevision||0,editorial:editorial(),confirmed:$('#public-confirm').checked});
    if(preview){preview.sessionStorage.setItem('arenalindex.public-preview',JSON.stringify(result.listing));preview.opener=null;preview.location.replace('/newlisting/preview/');$('#public-message').textContent='Vista previa abierta. Volvé aquí para publicar.';}
    else {record={...record,...result};render();$('#public-message').textContent=action==='unpublish'?'El anuncio fue retirado del catálogo.':'El anuncio está publicado.';if(result.url){const a=document.createElement('a');a.href=result.url;a.target='_blank';a.rel='noopener';a.textContent=' Abrir anuncio';$('#public-message').append(a);}}
  }catch(error){preview?.close();$('#public-message').textContent=error.message;}
  finally{busy=false;document.querySelectorAll('.publication-panel button').forEach(b=>b.disabled=false);if($('#public-publish'))$('#public-publish').disabled=!$('#public-confirm').checked||record.status!=='approved';if($('#public-preview'))$('#public-preview').disabled=record.status!=='approved';}
}

try{
  if(!id||!/^[a-f0-9]{64}$/.test(token||''))throw Error('Abrí el enlace privado que recibiste en el correo de revisión.');
  record=await request('review');render();
}catch(error){$('#review-content').innerHTML='<h1>No se pudo abrir esta revisión.</h1><p>'+esc(error.message)+'</p>';}
