import {consent} from './model.mjs?v=2';
import {esc,agreementPaper,contactURL,agreementDate} from './view.mjs?v=2';
export function mountAgreement({document,window,api}){
  const root=document.querySelector('#agreement-root'),token=window.location.hash.slice(1);
  let row,language='es',busy=false,loading=true,error='',name='',capacity='owner',confirmed=false;
  const t=(es,en)=>language==='en'?en:es;
  function render(){
    document.documentElement.lang=language;
    if(!row){root.innerHTML=`<div class="agreement-empty"><span class="agreement-status-icon" aria-hidden="true">${loading?'…':'!'}</span><h1>${loading?t('Abriendo tu acuerdo','Opening your agreement'):t('No pudimos abrir este acuerdo','We could not open this agreement')}</h1><p role="${loading?'status':'alert'}">${loading?t('Un momento, estamos cargando las condiciones.','One moment while we load the terms.'):esc(error)}</p>${loading?'':`<button class="agreement-primary" data-reload>${t('Intentar de nuevo','Try again')}</button><p>${t('Si el enlace no está completo, volvé a abrirlo desde el correo de tu corredor.','If the link is incomplete, open it again from your broker’s email.')}</p>`}</div>`;return;}
    const accepted=row.state==='accepted';
    const tools=`<div class="agreement-tools"><span>${accepted?t('Tu copia privada','Your private copy'):t('Antes de empezar','Before we begin')}</span><div><button data-language>${t('English','Español')}</button><button data-print>${t('Guardar PDF','Save PDF')}</button></div></div>`;
    const form=`<aside class="agreement-decision"><form id="agreement-accept-form" class="agreement-card"><span class="agreement-step">${t('EL SIGUIENTE PASO','THE NEXT STEP')}</span><h2>${t('¿Empezamos?','Shall we start?')}</h2><p class="agreement-note">${t('Si las condiciones coinciden con lo conversado, confirmá tu autorización.','If the terms match what you discussed, confirm your permission.')}</p>
      <label>${t('Tu nombre completo','Your full name')}<input name="name" autocomplete="name" required minlength="2" maxlength="120" value="${esc(name)}" ${busy?'disabled':''}></label>
      <label>${t('Aceptás como','You are accepting as')}<select name="capacity" ${busy?'disabled':''}><option value="owner" ${capacity==='owner'?'selected':''}>${t('Propietario','Owner')}</option><option value="representative" ${capacity==='representative'?'selected':''}>${t('Representante autorizado','Authorized representative')}</option></select></label>
      <label class="agreement-check"><input type="checkbox" name="confirmed" required ${confirmed?'checked':''} ${busy?'disabled':''}><span>${esc(row.consents?.[language]||consent[language])}</span></label>
      <p role="alert" class="agreement-error">${esc(error)}</p><button class="agreement-primary" type="submit" ${busy?'disabled':''}>${t(busy?'Guardando tu aceptación…':'Aceptar y autorizar la promoción',busy?'Saving your acceptance…':'Accept and authorize marketing')}</button>
      <p class="agreement-copy-note">${t('Te enviamos la confirmación a','Confirmation goes to')} <strong>${esc(row.terms.ownerEmail)}</strong>. ${t('Tu corredor recibe otra con las mismas condiciones.','Your broker gets a separate confirmation with the same terms.')}</p></form>
      <div class="agreement-help"><h3>${t('Primero, resolvamos tus dudas.','Questions come first.')}</h3><p>${t('Podés conversar sobre cualquier condición antes de aceptar.','You can discuss any term before accepting.')}</p><a href="${esc(contactURL(row,language))}">${t('Escribir a ','Write to ')}${esc(row.terms.brokerName)} <span aria-hidden="true">↗</span></a><small>${t('No necesitás crear una cuenta ni usar firma digital.','No account or certified digital signature needed.')}</small></div></aside>`;
    const success=`<section class="agreement-success"><span class="agreement-status-icon" aria-hidden="true">✓</span><p class="agreement-eyebrow">${t('GRACIAS POR TU CONFIANZA','THANK YOU FOR YOUR TRUST')}</p><h1 tabindex="-1">${t('Tu autorización quedó confirmada.','Your authorization is confirmed.')}</h1><p><strong>${esc(row.terms.propertyName)}</strong> · ${esc(agreementDate(row.acceptedAt,language))}</p><p>${row.mail?.owner==='sent'&&row.mail?.broker==='sent'?t('Enviamos la confirmación a tu correo y al de tu corredor. Conservá el enlace para volver a esta copia.','Confirmation emails were submitted to you and your broker. Keep the link to return to this copy.'):t('La aceptación está guardada. Hay correos de confirmación pendientes; tu corredor puede reintentar el envío.','Your acceptance is saved. Confirmation emails are pending; your broker can retry delivery.')}</p><div class="agreement-success-actions"><button class="agreement-primary" data-print>${t('Guardar mi copia en PDF','Save my copy as PDF')}</button><a href="${esc(contactURL(row,language))}">${t('Hablar con mi corredor','Talk to my broker')}</a></div><p class="agreement-note">${t('Tu corredor coordinará con vos la aprobación del anuncio antes de publicarlo.','Your broker will arrange your approval of the listing before it is published.')}</p></section>`;
    const expired=`<section class="agreement-expired"><h1>${t('Necesitás una nueva invitación','You need a new invitation')}</h1><p>${t('Venció el enlace para aceptar esta propuesta. Podés consultar sus condiciones o pedirle otro a tu corredor.','The acceptance invitation has expired. You can still read its terms or ask your broker for a new one.')}</p><a href="${esc(contactURL(row,language))}">${t('Pedir una nueva invitación','Request a new invitation')}</a></section>`;
    const withdrawal=accepted?`<section class="agreement-withdrawal"><h2>${t('Si querés retirar tu propiedad','If you want to withdraw your property')}</h2><p>${t('Avisale por correo a tu corredor. El botón prepara el mensaje; vos decidís cuándo enviarlo.','Let your broker know by email. This button prepares the message; you decide when to send it.')}</p><a data-withdraw href="${esc(contactURL(row,language,true))}">${t('Preparar aviso de retiro','Prepare a withdrawal email')} <span aria-hidden="true">↗</span></a></section>`:'';
    root.innerHTML=tools+(accepted?success:row.expired?expired:'')+`<div class="agreement-layout ${accepted||row.expired?'agreement-copy-layout':''}">${agreementPaper(row,language)}${!accepted&&!row.expired?form:''}</div>`+withdrawal;
  }
  function capture(){const form=root.querySelector('#agreement-accept-form');if(!form)return;name=form.querySelector('[name=name]').value;capacity=form.querySelector('[name=capacity]').value;confirmed=form.querySelector('[name=confirmed]').checked;}
  async function start(){if(busy)return;loading=true;render();try{row=await api('agreement_open',{token});language=row.terms.language;name=row.terms.ownerName;error='';}catch(e){error=e.message;}finally{loading=false;render();}}
  root.addEventListener('input',capture);root.addEventListener('change',capture);
  root.addEventListener('click',e=>{
    if(e.target.closest('[data-language]')&&!busy){capture();language=language==='es'?'en':'es';render();}
    if(e.target.closest('[data-print]')){
      const details=[...root.querySelectorAll('details')],opened=details.map(d=>d.open);for(const d of details)d.open=true;
      const restore=()=>{details.forEach((d,i)=>d.open=opened[i]);window.removeEventListener('afterprint',restore);};window.addEventListener('afterprint',restore);window.print();
    }
    if(e.target.closest('[data-reload]')&&!loading)start();
  });
  root.addEventListener('submit',async e=>{
    e.preventDefault();if(busy||!row||row.state==='accepted'||row.expired)return;capture();
    if(!confirmed||name.trim().length<2){error=t('Confirmá tu nombre y aceptación.','Confirm your name and acceptance.');render();return;}
    busy=true;error='';render();
    try{row=await api('agreement_accept',{token,name,capacity,confirmed,language,termsHash:row.termsHash,termsVersion:row.termsVersion});}
    catch(e){error=e.message;}
    finally{busy=false;render();if(row.state==='accepted'){window.scrollTo?.(0,0);root.querySelector('.agreement-success h1')?.focus();}}
  });
  return {ready:start()};
}
if(typeof window!=='undefined'&&document.querySelector('#agreement-root'))mountAgreement({document,window,api:async(action,body)=>{
  const response=await fetch(new URL('owner',window.ArenalConfig.intakeUrl),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...body}),cache:'no-store',signal:AbortSignal.timeout(60000)});
  const result=await response.json();if(!response.ok)throw Error(document.documentElement.lang==='en'?(result.errorEnglish||'Please try again.'):(result.error||'Intentá de nuevo.'));return result;
}});
