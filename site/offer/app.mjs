import {blankOffer,validateOffer,choices,notice,noticeVersion} from './model.mjs';
import {esc,money,propertyCard,proposalSummary} from './view.mjs';
const hex=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
export function mountOffer({document,window,api,storage}){
  if(!storage)try{storage=window.sessionStorage;}catch{}
  const root=document.querySelector('#offer-root'),token=window.location.hash.slice(1),key='arenalindex.offer-draft:'+token.split('.')[0];
  let record,draft,step=0,receipt=false,busy=false,dirty=false,submissionId=hex(),saved=false,confirmed=false;
  const language=()=>window.ArenalI18n?.language==='en'?'en':'es',t=(es,en)=>language()==='en'?en:es,$=s=>root.querySelector(s);
  const steps=()=>[t('Oferta','Offer'),t('Plan','Plan'),t('Condiciones','Conditions'),t('Tus datos','Your details'),t('Revisión','Review')];
  const fields=[['amount','currency'],['funding','depositMode','deposit','closing'],['conditions','otherConditions','message','validity'],['name','email','phone']];
  function persist(){try{storage.setItem(key,JSON.stringify({draft,step,revision:record.revision,submissionId}));saved=true;}catch{saved=false;}const note=$('.offer-save-note');if(note)note.textContent=t(saved?'Borrador guardado en esta pestaña. Todavía no se envió.':'Borrador en pantalla. No cierres esta pestaña antes de enviar.',saved?'Draft saved in this tab. Nothing has been sent yet.':'Draft on screen. Keep this tab open until you send it.');}
  function collect(){
    const form=$('#offer-form');if(!form)return;
    for(const field of form.querySelectorAll('[name]')){
      const name=field.name;if(name==='confirmed'){confirmed=field.checked;continue;}
      if(field.type==='radio'){if(field.checked)draft[name]=field.value;}
      else if(field.type!=='checkbox')draft[name]=field.value;
    }
    if(form.querySelector('[name=conditions]'))draft.conditions=[...form.querySelectorAll('[name=conditions]:checked')].map(el=>el.value);
  }
  const label=(name,text,control,hint='')=>'<label class="offer-field">'+text+control+(hint?'<small>'+hint+'</small>':'')+'</label>';
  const input=(name,type='text',extra='')=>'<input name="'+name+'" type="'+type+'" value="'+esc(draft[name])+'" '+extra+'>';
  const options=(name,title,checkbox=false)=>'<fieldset class="offer-options"><legend>'+title+'</legend>'+choices[name].map(([value,es,en])=>'<label class="offer-choice"><input name="'+name+'" type="'+(checkbox?'checkbox':'radio')+'" value="'+value+'" '+((checkbox?draft[name].includes(value):draft[name]===value)?'checked':'')+'><span>'+t(es,en)+'</span></label>').join('')+'</fieldset>';
  const textarea=(name,max)=>'<textarea name="'+name+'" maxlength="'+max+'" rows="3">'+esc(draft[name])+'</textarea>';
  function content(){
    if(step===0)return '<h2 tabindex="-1">'+t('¿Qué monto querés proponer?','What would you like to offer?')+'</h2><p class="step-description">'+t('Empezá con un monto que refleje tu intención. Más adelante podrás explicar tus condiciones.','Start with an amount that reflects your intention. You’ll be able to explain your conditions next.')+'</p><div class="offer-amount">'+label('amount',t('Tu oferta','Your offer'),input('amount','number','min="0.01" max="9999999999999" step="0.01" inputmode="decimal" placeholder="0"'))+label('currency',t('Moneda','Currency'),'<select name="currency"><option value="USD" '+(draft.currency==='USD'?'selected':'')+'>USD</option><option value="CRC" '+(draft.currency==='CRC'?'selected':'')+'>CRC</option></select>')+'</div><p class="offer-hint">'+t('Precio solicitado: ','Asking price: ')+esc(money(record.property.price,record.property.currency,language()))+'. '+t('Tu propuesta conserva la moneda que elijás. No hacemos una conversión automática.','Your proposal keeps the currency you choose. We do not convert it automatically.')+'</p>';
    if(step===1)return '<h2 tabindex="-1">'+t('Dale forma a tu plan de compra','Shape your purchase plan')+'</h2><p class="step-description">'+t('No necesitás tener todas las respuestas. Indicá dónde te gustaría recibir orientación.','You don’t need every answer yet. Tell your broker where you’d like guidance.')+'</p><div class="offer-fields">'+options('funding',t('¿Cómo comprarías la propiedad?','How would you fund the purchase?'))+options('depositMode',t('Depósito propuesto','Proposed deposit'))+'<div id="deposit-field" '+(draft.depositMode==='amount'?'':'hidden')+'>'+label('deposit',t('Monto del depósito','Deposit amount')+' ('+esc(draft.currency)+')',input('deposit','number','min="0.01" step="0.01" inputmode="decimal"'),t('Forma parte del precio total. El momento y las condiciones se acordarán después; no se cobra aquí.','Part of the total price. Timing and conditions would be agreed later; no payment is collected here.'))+'</div>'+options('closing',t('¿Cuándo te gustaría cerrar la compra?','When would you like to close?'))+'</div>';
    if(step===2)return '<h2 tabindex="-1">'+t('Lo que importa para avanzar','What matters before moving forward')+'</h2><p class="step-description">'+t('Elegí las condiciones que querés plantear. Podés agregar detalles con tus propias palabras.','Choose the conditions you want to propose. Add details in your own words.')+'</p><div class="offer-fields">'+options('conditions',t('Mi propuesta está sujeta a… · opcional','My proposal is subject to… · optional'),true)+label('otherConditions',t('Otras condiciones o inclusiones · opcional','Other conditions or included items · optional'),textarea('otherConditions',2000),t('Por ejemplo: incluir muebles o revisar el acceso a la propiedad.','For example: include furniture or review access to the property.'))+label('validity',t('¿Por cuánto tiempo mantenés esta propuesta?','How long would you keep this proposal open?'),'<select name="validity">'+choices.validity.map(([v,es,en])=>'<option value="'+v+'" '+(draft.validity===v?'selected':'')+'>'+t(es,en)+'</option>').join('')+'</select>',t('El plazo empieza cuando la enviás. No es una promesa de respuesta del vendedor.','The period starts when you send it. It does not promise a response from the seller.'))+label('message',t('Un mensaje para el propietario · opcional','A message for the owner · optional'),textarea('message',2000))+'</div>';
    if(step===3)return '<h2 tabindex="-1">'+t('Tu propuesta lleva tu nombre','Put your name to your proposal')+'</h2><p class="step-description">'+t('Estos datos permiten que tu corredor se comunique con vos. No necesitás crear una cuenta.','These details let your broker get back to you. No account needed.')+'</p><div class="offer-fields">'+label('name',t('Nombre completo','Full name'),input('name','text','autocomplete="name" maxlength="120"'))+label('email',t('Correo electrónico','Email address'),input('email','email','autocomplete="email" maxlength="254"'))+label('phone',t('Teléfono o WhatsApp · opcional','Phone or WhatsApp · optional'),input('phone','tel','autocomplete="tel" maxlength="40" placeholder="+506 …"'))+'<p class="offer-hint">'+t('Tu corredor recibirá estos datos junto con tu propuesta y podrá presentarla al propietario.','Your broker will receive these details with your proposal and may present it to the owner.')+'</p></div>';
    return '<h2 tabindex="-1">'+t('Tus palabras. Tus condiciones.','Your words. Your terms.')+'</h2><p class="step-description">'+t('Revisá la propuesta completa. Podés volver a cualquier sección antes de enviarla.','Review your complete proposal. You can change any section before sending.')+'</p>'+proposalSummary({property:record.property,broker:record.broker,offer:draft,language:language(),editable:true})+'<label class="offer-confirm"><input type="checkbox" name="confirmed" '+(confirmed?'checked':'')+'><span>'+t('Revisé esta propuesta y quiero enviarla a ','I have reviewed this proposal and want to send it to ')+esc(record.broker)+t(' para conversar sobre la compra. Entiendo el alcance indicado arriba.',' to discuss the purchase. I understand the explanation above.')+'</span></label>';
  }
  function render(focus=false){
    document.querySelector('#offer-header-label').textContent=t('Propuesta de compra','Purchase proposal');
    document.title=t('Tu propuesta de compra','Your purchase proposal')+' · ArenalIndex';
    if(!record)return;
    if(receipt){renderReceipt();return;}
    root.innerHTML='<div class="offer-intro"><p class="eyebrow">'+t('UN PASO MÁS CERCA','ONE STEP CLOSER')+'</p><h1>'+t('Tu oferta, claramente expresada.','Your offer, clearly expressed.')+'</h1><p class="muted">'+t('Prepará tu propuesta para ','Prepare your proposal for ')+esc(record.broker)+t('. A tu ritmo, con tus condiciones.','. At your pace, on your terms.')+'</p></div><div class="offer-layout"><div><ol class="offer-steps" aria-label="'+t('Progreso','Progress')+'">'+steps().map((name,i)=>'<li '+(i===step?'aria-current="step"':i<step?'class="done"':'')+'><span>'+String(i+1).padStart(2,'0')+'</span>'+name+'</li>').join('')+'</ol><form id="offer-form" class="offer-card" novalidate>'+content()+'<p class="offer-error" role="alert"></p><div class="offer-actions">'+(step?'<button type="button" class="quiet" data-back>'+t('← Atrás','← Back')+'</button>':'<span class="offer-hint">'+t('5 pasos cortos','5 short steps')+'</span>')+'<button type="submit" class="primary">'+(step===4?t('Enviar propuesta a ','Send proposal to ')+esc(record.broker):t('Continuar →','Continue →'))+'</button></div><p class="offer-save-note" role="status"></p></form></div><aside class="offer-sidebar">'+propertyCard(record.property,language())+'<p class="offer-aside-note">'+t('Solo se envía cuando vos lo confirmás. No se solicita un pago ni una firma. Conservá este enlace privado.','Sent only when you confirm. No payment or signature is requested. Keep this link private.')+'</p></aside></div>';
    persist();if(focus){$('h2[tabindex]')?.focus();$('h2[tabindex]')?.scrollIntoView?.({block:'start',behavior:'instant'});}
  }
  function renderReceipt(){
    const latest=record.versions.at(-1);
    if(!latest){unavailable(t('El plazo de esta invitación terminó. Pedí un nuevo enlace a tu corredor.','This invitation has expired. Ask your broker for a new link.'));return;}
    root.innerHTML='<div class="offer-success"><span class="offer-success-mark" aria-hidden="true">✓</span><h1 tabindex="-1">'+t('Tu propuesta quedó registrada.','Your proposal is on record.')+'</h1><p>'+t('Está disponible en la cuenta de ','It is available in the account of ')+esc(record.broker)+t('. Tu corredor la revisará y podrá presentarla al propietario. Esto no confirma aceptación ni reserva la propiedad.','. Your broker can review it and present it to the owner. This does not confirm acceptance or reserve the property.')+'</p><p>'+t('Guardá una copia y conservá este enlace privado para volver. No se envía una copia por correo automáticamente.','Save a copy and keep this private link to return. An email copy is not sent automatically.')+'</p></div><div class="offer-toolbar"><button type="button" class="primary" data-print>'+t('Imprimir / guardar PDF','Print / save PDF')+'</button>'+(!record.expired?'<button type="button" class="quiet" data-revise>'+t('Preparar una nueva versión','Prepare a new version')+'</button>':'')+'</div>'+proposalSummary({property:record.property,broker:record.broker,offer:latest.offer,version:latest,language:language()})+(record.versions.length>1?'<details class="offer-history"><summary>'+t('Ver versiones anteriores','View previous versions')+' ('+(record.versions.length-1)+')</summary>'+record.versions.slice(0,-1).reverse().map(v=>proposalSummary({property:record.property,broker:record.broker,offer:v.offer,version:v,language:language()})).join('')+'</details>':'');
  }
  function unavailable(message){root.innerHTML='<section class="offer-unavailable"><p class="eyebrow">ARENAL INDEX</p><h1>'+t('Revisemos este enlace','Let’s check this link')+'</h1><p role="alert">'+esc(message)+'</p><button class="quiet" data-reload>'+t('Volver a intentar','Try again')+'</button></section>';}
  function showErrors(errors){
    const name=Object.keys(errors)[0];const field=$('[name="'+name+'"]');field?.setAttribute('aria-invalid','true');field?.focus();
    $('.offer-error').textContent=t(errors[name]==='deposit'?'El depósito debe ser mayor que cero y no superar el monto de la oferta.':'Revisá los campos de este paso. Indicá un monto válido, completá los datos y elegí las opciones pendientes.',errors[name]==='deposit'?'The deposit must be greater than zero and no more than your offer.':'Review this step. Enter a valid amount, complete your details, and select the remaining options.');
  }
  root.addEventListener('input',event=>{if(busy)return;collect();dirty=true;confirmed=false;event.target.removeAttribute('aria-invalid');if(event.target.name==='confirmed')confirmed=event.target.checked;persist();});
  root.addEventListener('change',event=>{collect();if(event.target.name==='depositMode')$('#deposit-field').hidden=draft.depositMode!=='amount';persist();});
  root.addEventListener('click',event=>{
    if(busy)return;const button=event.target.closest('button');if(!button)return;
    if(button.hasAttribute('data-back')){collect();step--;render(true);}
    if(button.hasAttribute('data-edit-step')){collect();step=Number(button.dataset.editStep);confirmed=false;render(true);}
    if(button.hasAttribute('data-print'))window.print();
    if(button.hasAttribute('data-reload'))window.location.reload();
    if(button.hasAttribute('data-revise')){draft=structuredClone(record.versions.at(-1).offer);step=0;receipt=false;submissionId=hex();confirmed=false;render(true);}
  });
  root.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;collect();const errors=validateOffer(draft),keys=fields[step];
    if(keys){const relevant=Object.fromEntries(Object.entries(errors).filter(([key])=>keys.includes(key)));if(Object.keys(relevant).length){showErrors(relevant);return;}step++;render(true);return;}
    if(Object.keys(errors).length){step=fields.findIndex(keys=>keys.includes(Object.keys(errors)[0]));render(true);showErrors(errors);return;}
    if(!confirmed){$('.offer-error').textContent=t('Confirmá que revisaste tu propuesta antes de enviarla.','Confirm you reviewed your proposal before sending.');$('[name=confirmed]').focus();return;}
    busy=true;for(const b of root.querySelectorAll('button,input'))b.disabled=true;$('.offer-error').textContent=t('Registrando tu propuesta…','Recording your proposal…');
    try{record=await api('offer_submit',{token,offer:draft,revision:record.revision,submissionId,language:language(),noticeVersion,confirmed:true});receipt=true;dirty=false;try{storage.removeItem(key);}catch{}render();$('h1')?.focus();}
    catch(error){$('.offer-error').textContent=error.message;}
    finally{busy=false;for(const b of root.querySelectorAll('button,input'))b.disabled=false;}
  });
  window.addEventListener('arenal-language-change',()=>{if(busy)return;collect();render();});
  window.addEventListener('beforeunload',event=>{if(dirty&&!receipt){event.preventDefault();event.returnValue='';}});
  async function start(){
    if(!/^[a-f0-9]{64}\.[a-f0-9]{64}$/.test(token)){unavailable(t('Abrí el enlace privado que te compartió tu corredor.','Open the private link your broker shared with you.'));return;}
    try{record=await api('offer_open',{token});draft=blankOffer(record.property.currency);receipt=record.revision>0||record.expired;
      if(!record.expired)try{const stored=JSON.parse(storage.getItem(key)||'null');if(stored?.draft&&stored.revision===record.revision&&/^[a-f0-9]{32}$/.test(stored.submissionId)){draft={...blankOffer(record.property.currency),...stored.draft};if(!Array.isArray(draft.conditions))draft.conditions=[];step=Math.max(0,Math.min(4,Number(stored.step)||0));submissionId=stored.submissionId;receipt=false;}}catch{}
      render();
    }catch(error){unavailable(error.message);}
  }
  const ready=start();return {ready};
}
if(typeof window!=='undefined'&&document.querySelector('#offer-root'))mountOffer({document,window,api:async(action,body)=>{
  const response=await fetch(new URL('owner',window.ArenalConfig.intakeUrl),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...body}),cache:'no-store',signal:AbortSignal.timeout(60000)});
  const result=await response.json();if(!response.ok)throw Error(window.ArenalI18n?.language==='en'?(result.errorEnglish||'Could not complete this request. Please try again.'):result.error||'No se pudo completar. Intentá de nuevo.');return result;
}});
