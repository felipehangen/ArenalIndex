import {blankSimpleOffer,validateSimpleOffer,simpleNoticeVersion} from './model.mjs?v=2';
import {esc,propertyCard,proposalSummary} from './view.mjs?v=2';
const hex=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
export function mountOffer({document,window,api,storage}){
  if(!storage)try{storage=window.sessionStorage;}catch{}
  const root=document.querySelector('#offer-root'),token=window.location.hash.slice(1),shared=token.startsWith('listing.'),receiptLink=token.startsWith('receipt.'),key='arenalindex.simple-offer:'+token;
  let record,draft,review=false,receipt=false,busy=false,dirty=false,submissionId=hex(),errors={};
  const language=()=>window.ArenalI18n?.language==='en'?'en':'es',t=(es,en)=>language()==='en'?en:es,$=s=>root.querySelector(s);
  const messages=()=>({amount:t('Indicá un monto mayor que cero.','Enter an amount greater than zero.'),currency:t('Elegí USD o CRC.','Choose USD or CRC.'),name:t('Escribí tu nombre.','Enter your name.'),contact:t('Usá un correo válido o un teléfono de 8 a 15 dígitos.','Enter a valid email or a phone number with 8 to 15 digits.'),message:t('Usá un máximo de 2.000 caracteres.','Use no more than 2,000 characters.')});
  function persist(){try{storage?.setItem(key,JSON.stringify({draft,submissionId}));}catch{}}
  function collect(){if(review||receipt)return;for(const el of root.querySelectorAll('[name]'))draft[el.name]=el.value;}
  const input=(name,type='text',extra='')=>'<input id="offer-'+name+'" name="'+name+'" type="'+type+'" value="'+esc(draft[name])+'" '+extra+(errors[name]?' aria-invalid="true" aria-describedby="error-'+name+'"':'')+'>';
  const field=(name,label,control)=>'<div class="simple-field"><label for="offer-'+name+'">'+label+'</label>'+control+(errors[name]?'<span id="error-'+name+'" class="field-error">'+messages()[name]+'</span>':'')+'</div>';
  function render(focus=false){
    if(!record)return;
    document.title=t('Hacé una oferta','Make an offer')+' · ArenalIndex';document.querySelector('#offer-header-label').textContent=t('Oferta de compra','Purchase offer');
    root.classList.add('minimal-offer');
    if(receipt){renderReceipt();return;}
    root.innerHTML='<div class="simple-heading"><h1 tabindex="-1">'+t(review?'Revisá tu oferta':'Hacé una oferta',review?'Review your offer':'Make an offer')+'</h1><p>'+t(review?'Así la recibirá tu corredor.':'Escribí tu propuesta para ',review?'This is what your broker will receive.':'Write your proposal for ')+(review?'':esc(record.broker)+'.')+'</p></div>'+(!review?propertyCard(record.property,language()):'')+'<form id="offer-form" novalidate>'+(review?proposalSummary({property:record.property,broker:record.broker,offer:draft,language:language()}):'<div class="simple-amount">'+field('amount',t('Tu oferta','Your offer'),input('amount','number','min="0.01" step="0.01" max="9999999999999" inputmode="decimal" placeholder="0"'))+field('currency',t('Moneda','Currency'),'<select id="offer-currency" name="currency">'+['USD','CRC'].map(c=>'<option value="'+c+'" '+(draft.currency===c?'selected':'')+'>'+c+'</option>').join('')+'</select>')+'</div><div class="simple-contact">'+field('name',t('Tu nombre','Your name'),input('name','text','autocomplete="name" maxlength="120"'))+field('contact',t('Correo o WhatsApp','Email or WhatsApp'),input('contact','text','maxlength="254" autocapitalize="none" spellcheck="false"'))+'</div>'+field('message',t('Mensaje','Message')+' <span class="optional">'+t('opcional','optional')+'</span>','<textarea id="offer-message" name="message" rows="3" maxlength="2000" placeholder="'+t('Condiciones, forma de pago o algo que querás aclarar.','Terms, payment plans, or anything you’d like to clarify.')+'">'+esc(draft.message)+'</textarea>'))+'<p class="offer-error" role="alert"></p><div class="simple-actions">'+(review?'<button type="button" class="quiet" data-edit>'+t('Editar','Edit')+'</button>':'<span class="simple-help">'+t('Podés revisar antes de enviar.','You can review before sending.')+'</span>')+'<button type="submit" class="primary">'+t(review?'Enviar oferta':'Revisar oferta',review?'Send offer':'Review offer')+'</button></div></form>';
    if(focus){$('h1')?.focus();$('h1')?.scrollIntoView?.({block:'start',behavior:'instant'});}
  }
  function renderReceipt(){
    const latest=record.versions?.at(-1);
    if(!latest){unavailable(t('Este enlace venció. Pedí el formulario de la propiedad a tu corredor.','This link expired. Ask your broker for the property’s offer form.'));return;}
    root.innerHTML='<div class="simple-heading offer-success"><h1 tabindex="-1">'+t('Oferta enviada','Offer sent')+'</h1><p>'+esc(record.broker)+t(' ya puede verla en su cuenta.',' can now view it in their account.')+'</p>'+(record.alreadySent?'<p>'+t('Un intento anterior ya había sido recibido. Esta es la oferta guardada.','An earlier attempt was already received. This is the saved offer.')+'</p>':'')+'</div>'+proposalSummary({property:record.property,broker:record.broker,offer:latest.offer,version:latest,language:language()})+'<div class="offer-toolbar"><button class="quiet" data-print>'+t('Guardar PDF / imprimir','Save PDF / print')+'</button>'+(record.receiptURL?'<a class="receipt-link" href="'+esc(record.receiptURL)+'">'+t('Enlace a tu copia privada','Link to your private copy')+'</a>':'')+'</div>'+(record.versions.length>1?'<details class="offer-history"><summary>'+t('Versiones anteriores','Previous versions')+'</summary>'+record.versions.slice(0,-1).reverse().map(version=>proposalSummary({property:record.property,broker:record.broker,offer:version.offer,version,language:language()})).join('')+'</details>':'');
  }
  function unavailable(message){root.innerHTML='<section class="offer-unavailable"><h1>'+t('Formulario no disponible','Form unavailable')+'</h1><p role="alert">'+esc(message)+'</p><button class="quiet" data-reload>'+t('Reintentar','Try again')+'</button></section>';}
  root.addEventListener('input',event=>{if(busy)return;collect();dirty=true;persist();event.target.removeAttribute('aria-invalid');const error=$('#error-'+event.target.name);if(error)error.remove();});
  root.addEventListener('change',()=>{collect();persist();});
  root.addEventListener('click',event=>{
    if(busy)return;const button=event.target.closest('button');if(!button)return;
    if(button.hasAttribute('data-edit')){review=false;render(true);}
    if(button.hasAttribute('data-print'))window.print();
    if(button.hasAttribute('data-reload'))window.location.reload();
  });
  root.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;collect();errors=validateSimpleOffer(draft);
    if(Object.keys(errors).length){review=false;render();$('[name="'+Object.keys(errors)[0]+'"]')?.focus();return;}
    if(!review){review=true;persist();render(true);return;}
    busy=true;for(const b of root.querySelectorAll('button'))b.disabled=true;$('.offer-error').textContent=t('Enviando…','Sending…');
    try{
      record=await api(shared?'offer_form_submit':'offer_submit',{token,offer:draft,submissionId,propertyVersion:record.propertyVersion,revision:record.revision,confirmed:true,noticeVersion:simpleNoticeVersion,language:language()});
      receipt=true;dirty=false;try{storage?.removeItem(key);}catch{}
      if(record.receiptURL)try{window.history.replaceState(null,'',new URL(record.receiptURL).hash);}catch{}
      render();$('h1')?.focus();
    }catch(error){$('.offer-error').textContent=error.message;}
    finally{busy=false;for(const b of root.querySelectorAll('button'))b.disabled=false;}
  });
  window.addEventListener('arenal-language-change',()=>{if(busy)return;collect();render();});
  window.addEventListener('beforeunload',event=>{if(dirty&&!receipt){event.preventDefault();event.returnValue='';}});
  async function start(){
    if(!/^(?:(?:listing|receipt)\.)?[a-f0-9]{64}\.[a-f0-9]{64}$/.test(token)){unavailable(t('Abrí el enlace de la propiedad que te compartió tu corredor.','Open the property link shared by your broker.'));return;}
    try{
      record=await api(shared?'offer_form_open':receiptLink?'offer_receipt':'offer_open',{token});receipt=receiptLink||!!record.revision||!!record.expired;draft=blankSimpleOffer(record.property.currency);
      if(!receipt)try{const stored=JSON.parse(storage?.getItem(key)||'null');if(stored?.draft?.schema===2&&/^[a-f0-9]{32}$/.test(stored.submissionId)){draft={...draft,...stored.draft};submissionId=stored.submissionId;}}catch{}
      render();
    }catch(error){unavailable(error.message);}
  }
  return {ready:start()};
}
if(typeof window!=='undefined'&&document.querySelector('#offer-root'))mountOffer({document,window,api:async(action,body)=>{
  const response=await fetch(new URL('owner',window.ArenalConfig.intakeUrl),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...body}),cache:'no-store',signal:AbortSignal.timeout(60000)});
  const result=await response.json();if(!response.ok)throw Error(window.ArenalI18n?.language==='en'?(result.errorEnglish||'Could not complete this request. Please try again.'):result.error||'No se pudo completar. Intentá de nuevo.');return result;
}});
