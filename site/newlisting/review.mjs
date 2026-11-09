import * as M from './model.mjs';
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
    photo_exception_accepted:$('#photo-exception').checked,copy_checked:$('#copy-checked').checked
  };
}
function render(){
  const d=record.draft,r=record.review||{},editable=record.status==='ready_for_review';
  const groups=M.photoGroups.filter(g=>!g.building||M.hasBuildings(d.values));
  const gallery=d.files.filter(f=>f.type.startsWith('image/')&&groups.some(g=>g.id===f.category));
  const documents=d.files.filter(f=>!gallery.includes(f));
  $('#review-content').innerHTML='<p class="eyebrow">VERSIÓN '+record.version+'</p><h1>'+esc(M.reference(d))+'</h1><p class="review-status">'+esc(M.STATES[record.status])+'</p><p>La aprobación corresponde a esta versión. Si el vendedor reabre la ficha, deberá enviarla nuevamente.</p>'+
    '<section class="field-section"><h2>Contacto para aclaraciones</h2><p>'+esc(d.values.contact)+' · '+esc(d.values.phone||d.values.email)+'</p><p>'+esc(d.values.email||'')+'</p><p><a target="_blank" rel="noopener noreferrer" href="https://www.openstreetmap.org/?mlat='+encodeURIComponent(d.values.lat)+'&mlon='+encodeURIComponent(d.values.lng)+'#map=17/'+encodeURIComponent(d.values.lat)+'/'+encodeURIComponent(d.values.lng)+'">Ver la entrada en el mapa</a></p></section>'+
    '<section class="field-section"><h2>Anuncio preparado</h2><div class="buyer-preview" id="buyer-copy">'+esc(record.copy)+'</div><p class="map-note">Las afirmaciones se atribuyen al vendedor. La recepción de documentos y esta aprobación editorial no constituyen una verificación profesional.</p></section>'+
    '<section class="field-section"><h2>Condiciones y excepciones</h2>'+(record.concerns.length?'<ul>'+record.concerns.map(n=>'<li>'+esc(n)+'</li>').join('')+'</ul>':'<p>No se agregaron notas de condiciones.</p>')+(d.values.photo_exception?'<p><strong>Fotos pendientes:</strong> '+esc(d.values.photo_exception)+'</p>':'')+'<p>'+esc(d.values.documents_notes||'')+'</p></section>'+
    '<section class="field-section"><h2>Fotografías</h2><div class="review-photo-grid">'+gallery.map(f=>'<figure><a href="'+esc(f.url)+'" target="_blank" rel="noopener noreferrer"><img src="'+esc(f.url)+'" alt="'+esc(f.name)+'" loading="lazy"></a><figcaption>'+esc(M.photoGroups.find(g=>g.id===f.category)?.title)+' · '+esc(f.shot)+(f.id===d.values.cover_id?' · PORTADA':'')+'</figcaption></figure>').join('')+'</div></section>'+
    '<section class="field-section"><h2>Documentos privados</h2><div class="review-files">'+documents.map(f=>'<a href="'+esc(f.url)+'" target="_blank" rel="noopener noreferrer">'+esc(f.name)+' · '+esc(M.documentGroups.find(g=>g.id===f.category)?.title||f.category)+'</a>').join('')+'</div><p class="map-note">Los enlaces a archivos vencen en 10 minutos. Recargá esta página para renovarlos.</p></section>'+
    '<details class="review-detail"><summary>Todas las respuestas</summary>'+M.steps.map(s=>'<h3>'+esc(s.short)+'</h3><dl>'+s.fields.filter(f=>f.id&&M.visible(f,d.values)).map(f=>'<dt>'+esc(f.label)+'</dt><dd>'+esc(M.label(f,d.values[f.id]))+'</dd>').join('')+'</dl>').join('')+'<h3>Construcciones</h3>'+d.buildings.map(b=>'<dl>'+M.buildingFields.map(f=>'<dt>'+esc(f.label)+'</dt><dd>'+esc(M.label(f,b[f.id]))+'</dd>').join('')+'</dl>').join('')+'</details>'+
    '<form id="review-form"><fieldset class="form-shell"'+(!editable?' disabled':'')+'><section class="field-section"><h2>Revisión antes de aprobar</h2><div class="form-grid"><div class="field"><label for="plan-number">Número de plano confirmado</label><input id="plan-number" maxlength="40" value="'+esc(r.plan_number||d.values.plan||'')+'"></div><div class="field"><label for="documented-area">Área documentada (m²)</label><input id="documented-area" type="number" min="1" max="999999999" step="any" value="'+esc(r.documented_area||d.values.documented_area||'')+'"></div></div><p>Área declarada por el vendedor: '+esc(d.values.area)+' m².</p><div class="approval-checks">'+[
      ['plan-matches','Confirmé que el plano corresponde a la propiedad.',r.plan_matches],
      ['discrepancy-resolved','La diferencia de área, si existe, fue resuelta.',r.discrepancy_resolved],
      ['photo-exception','Acepto la excepción de fotografías, si se solicitó.',r.photo_exception_accepted],
      ['copy-checked','Revisé texto, fotos, permisos y condiciones conocidas; se representarán correctamente en la publicación.',r.copy_checked]
    ].map(([id,label,checked])=>'<label><input id="'+id+'" type="checkbox"'+(checked?' checked':'')+'>'+label+'</label>').join('')+'</div><label for="feedback">Comentarios o cambios que debe realizar el vendedor</label><textarea id="feedback" maxlength="3000">'+esc(record.feedback||'')+'</textarea><div id="approval-pending" class="map-note"></div><div class="actions"><button class="primary" type="submit" id="approve">Aprobar para publicar</button><button class="secondary" type="button" id="request-changes">Solicitar cambios</button></div><p class="map-note">Aprobar guarda la versión autorizada para preparar la publicación. La ficha no se agrega automáticamente al catálogo público.</p></section></fieldset></form><p id="review-message" role="status"></p>';
  $('#review-form').oninput=updateChecks;
  $('#review-form').onsubmit=e=>{e.preventDefault();decide('approve');};
  $('#request-changes').onclick=()=>decide('request_changes');
  if(editable)updateChecks();
}
function updateChecks(){
  const review=checks(),issues=M.pending(record.draft,{publication:true,review});
  $('#buyer-copy').textContent=M.buyerCopy(record.draft,review);
  $('#approval-pending').textContent=issues.length?'Pendiente: '+issues.map(i=>i.label).join(' · '):'Lista para tu aprobación.';
  $('#approve').disabled=busy||issues.length>0;
}
async function decide(action){
  if(busy)return;busy=true;$('#approve').disabled=true;$('#request-changes').disabled=true;
  try{
    const result=await request(action,{version:record.version,review:checks(),feedback:$('#feedback').value});
    record={...record,...result,review:checks()};render();$('#review-message').textContent=action==='approve'?'Versión aprobada para publicar.':'Se guardó la solicitud de cambios. El vendedor la verá al actualizar el estado de su ficha.';
  }catch(error){$('#review-message').textContent=error.message;}
  finally{busy=false;if(record.status==='ready_for_review'){updateChecks();$('#request-changes').disabled=false;}}
}
try{
  if(!id||!/^[a-f0-9]{64}$/.test(token||''))throw Error('Abrí el enlace privado que recibiste en el correo de revisión.');
  record=await request('review');render();
}catch(error){$('#review-content').innerHTML='<h1>No se pudo abrir esta revisión.</h1><p>'+esc(error.message)+'</p>';}
