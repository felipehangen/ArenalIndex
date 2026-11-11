import {blankSimpleOffer,validateSimpleOffer,simpleNoticeVersion} from './model.mjs?v=2';
import {esc,propertyStage,proposalSummary} from './view.mjs?v=3';
const hex=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
export function mountOffer({document,window,api,storage}){
  if(!storage)try{storage=window.sessionStorage;}catch{}
  const root=document.querySelector('#offer-root'),token=window.location.hash.slice(1),shared=token.startsWith('listing.'),receiptLink=token.startsWith('receipt.'),key='arenalindex.simple-offer:'+token;
  let record,draft,review=false,receipt=false,busy=false,dirty=false,submissionId=hex(),errors={},messageOpen=false;
  const language=()=>window.ArenalI18n?.language==='en'?'en':'es',t=(es,en)=>language()==='en'?en:es,$=s=>root.querySelector(s);
  const messages=()=>({amount:t('Indicá un monto mayor que cero.','Enter an amount greater than zero.'),currency:t('Elegí USD o CRC.','Choose USD or CRC.'),name:t('Escribí tu nombre.','Enter your name.'),contact:t('Usá un correo válido o un teléfono de 8 a 15 dígitos.','Enter a valid email or a phone number with 8 to 15 digits.'),message:t('Usá un máximo de 2.000 caracteres.','Use no more than 2,000 characters.')});
  function persist(){try{storage?.setItem(key,JSON.stringify({draft,submissionId}));}catch{}}
  function collect(){if(review||receipt)return;for(const el of root.querySelectorAll('[name]'))draft[el.name]=el.value;}
  const input=(name,type='text',extra='')=>'<input id="offer-'+name+'" name="'+name+'" type="'+type+'" value="'+esc(draft[name])+'" '+extra+'>';
  const field=(name,label,control)=>'<div class="simple-field"><label for="offer-'+name+'">'+label+'</label>'+(errors[name]?control.replace('>',' aria-invalid="true" aria-describedby="error-'+name+'">'):control)+(errors[name]?'<span id="error-'+name+'" class="field-error">'+messages()[name]+'</span>':'')+'</div>';
  const arrow='<span aria-hidden="true">→</span>';
  function watchImage(){const img=$('.property-scene img');img?.addEventListener('error',()=>img.remove(),{once:true});}
  function sizeAmount(){const amount=$('[name=amount]');if(amount)amount.dataset.long=String(amount.value.length>9);}
  function render(focus=false){
    if(!record)return;
    document.title=t('Hacé una oferta','Make an offer')+' · ArenalIndex';document.querySelector('#offer-header-label').textContent=t('Oferta de compra','Purchase offer');
    root.classList.add('offer-experience');root.dataset.stage=receipt?'sent':review?'review':'write';
    if(receipt){renderReceipt();return;}
    const heading='<div class="offer-heading"><p class="eyebrow">'+t(review?'TU PROPUESTA':'ESTA PROPIEDAD. TU PROPUESTA.',review?'YOUR PROPOSAL':'THIS PLACE. YOUR PROPOSAL.')+'</p><h1 tabindex="-1">'+t(review?'Tu oferta, lista para enviar.':'Hacé una oferta.',review?'Your offer, ready to send.':'Make an offer.')+'</h1><p>'+t(review?'Un momento para revisar. El siguiente paso lo decidís vos.':'El próximo paso, en tus palabras.',review?'Take a moment to review. The next step is yours.':'The next step, in your words.')+'</p></div>';
    const fields='<div class="offer-amount-block"><div class="simple-amount">'+
      field('amount',t('Mi oferta','My offer'),input('amount','number','min="0.01" step="0.01" max="9999999999999" inputmode="decimal" placeholder="0" required'))+
      field('currency',t('Moneda','Currency'),'<select id="offer-currency" name="currency">'+['USD','CRC'].map(c=>'<option value="'+c+'" '+(draft.currency===c?'selected':'')+'>'+c+'</option>').join('')+'</select>')+'</div></div>'+
      '<div class="simple-contact">'+field('name',t('Tu nombre','Your name'),input('name','text','autocomplete="name" maxlength="120" placeholder="'+t('Nombre y apellido','Full name')+'" required'))+
      field('contact',t('Correo o WhatsApp','Email or WhatsApp'),input('contact','text','maxlength="254" autocapitalize="none" spellcheck="false" placeholder="'+t('Para conversar sobre tu oferta','So we can discuss your offer')+'" required'))+'</div>'+
      '<details class="offer-message" '+(messageOpen||draft.message||errors.message?'open':'')+'><summary><span aria-hidden="true" class="message-plus">+</span>'+t('Agregar un mensaje','Add a message')+' <span class="optional">'+t('opcional','optional')+'</span></summary>'+field('message',t('Lo que querés que sepan','What you’d like them to know'),'<textarea id="offer-message" name="message" rows="3" maxlength="2000" placeholder="'+t('Tus condiciones o algo que querás aclarar.','Your terms or anything you’d like to clarify.')+'">'+esc(draft.message)+'</textarea>')+'</details>';
    root.innerHTML='<div class="offer-spread">'+propertyStage(record.property,language())+'<section class="offer-desk">'+heading+'<form id="offer-form" novalidate>'+
      (review?proposalSummary({property:record.property,broker:record.broker,offer:draft,language:language()}):fields)+
      '<div class="offer-delivery"><span class="delivery-dot" aria-hidden="true"></span><p>'+t('La recibe','Your broker')+' <strong>'+esc(record.broker)+'</strong></p></div><p class="offer-send-status" role="status"></p><p class="offer-error" role="alert"></p>'+
      '<div class="simple-actions">'+(review?'<button type="button" class="text-button" data-edit>← '+t('Editar oferta','Edit offer')+'</button>':'<span class="simple-help">'+t('Primero revisás.<br>Después enviás.','Review it first.<br>Then send it.')+'</span>')+
      '<button type="submit" class="primary">'+t(review?'Enviar mi oferta':'Revisar mi oferta',review?'Send my offer':'Review my offer')+arrow+'</button></div>'+
      (!review?'<p class="offer-scope">'+t('Una propuesta inicial para conversar, sin contrato ni reserva.','An initial proposal for discussion, with no contract or reservation.')+'</p>':'')+'</form></section></div>';
    watchImage();sizeAmount();
    $('.offer-message')?.addEventListener('toggle',event=>{messageOpen=event.target.open;});
    if(focus){$('h1')?.focus({preventScroll:true});$('.offer-desk')?.scrollIntoView?.({block:'start',behavior:'instant'});}
  }
  function renderReceipt(){
    const latest=record.versions?.at(-1);
    if(!latest){unavailable(t('Este enlace venció. Pedí el formulario de la propiedad a tu corredor.','This link expired. Ask your broker for the property’s offer form.'));return;}
    root.innerHTML='<div class="offer-spread">'+propertyStage(record.property,language())+'<section class="offer-desk"><div class="offer-heading offer-success"><div class="offer-success-mark" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="m8 16 5 5 11-12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div><p class="eyebrow">'+t('YA DISTE EL PRIMER PASO','YOU MADE YOUR MOVE')+'</p><h1 tabindex="-1">'+t('Oferta enviada.','Offer sent.')+'</h1><p>'+esc(record.broker)+t(' ya puede verla en su cuenta y contactarte para conversar.',' can now view it in their account and contact you to discuss it.')+'</p>'+
      (record.alreadySent?'<p class="offer-retry-note">'+t('Un intento anterior ya había sido recibido. Esta es la oferta guardada.','An earlier attempt was already received. This is the saved offer.')+'</p>':'')+'</div>'+
      proposalSummary({property:record.property,broker:record.broker,offer:latest.offer,version:latest,language:language()})+
      '<div class="offer-toolbar"><button class="quiet" data-print>'+t('Guardar PDF / imprimir','Save PDF / print')+'</button>'+(record.receiptURL?'<a class="receipt-link" href="'+esc(record.receiptURL)+'">'+t('Tu copia privada ↗','Your private copy ↗')+'</a>':'')+'</div><p class="receipt-note">'+t('Conservá esta página como constancia de tu propuesta.','Keep this page as a record of your proposal.')+'</p>'+
      (record.versions.length>1?'<details class="offer-history"><summary>'+t('Versiones anteriores','Previous versions')+'</summary>'+record.versions.slice(0,-1).reverse().map(version=>proposalSummary({property:record.property,broker:record.broker,offer:version.offer,version,language:language()})).join('')+'</details>':'')+'</section></div>';
    watchImage();
  }
  function unavailable(message){root.innerHTML='<section class="offer-unavailable"><h1>'+t('Formulario no disponible','Form unavailable')+'</h1><p role="alert">'+esc(message)+'</p><button class="quiet" data-reload>'+t('Reintentar','Try again')+'</button></section>';}
  root.addEventListener('input',event=>{if(busy)return;collect();dirty=true;persist();delete errors[event.target.name];event.target.removeAttribute('aria-invalid');event.target.removeAttribute('aria-describedby');sizeAmount();const error=$('#error-'+event.target.name);if(error)error.remove();});
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
    busy=true;$('#offer-form').setAttribute('aria-busy','true');for(const b of root.querySelectorAll('button'))b.disabled=true;$('.offer-error').textContent='';$('.offer-send-status').textContent=t('Enviando tu oferta…','Sending your offer…');
    try{
      record=await api(shared?'offer_form_submit':'offer_submit',{token,offer:draft,submissionId,propertyVersion:record.propertyVersion,revision:record.revision,confirmed:true,noticeVersion:simpleNoticeVersion,language:language()});
      receipt=true;dirty=false;try{storage?.removeItem(key);}catch{}
      if(record.receiptURL)try{window.history.replaceState(null,'',new URL(record.receiptURL).hash);}catch{}
      render();$('h1')?.focus({preventScroll:true});$('.offer-desk')?.scrollIntoView?.({block:'start',behavior:'instant'});
    }catch(error){$('.offer-error').textContent=error.message;}
    finally{busy=false;$('#offer-form')?.removeAttribute('aria-busy');if($('.offer-send-status'))$('.offer-send-status').textContent='';for(const b of root.querySelectorAll('button'))b.disabled=false;}
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
