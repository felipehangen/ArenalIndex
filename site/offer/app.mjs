import './session.js?v=1';
import {simpleNoticeVersion} from './model.mjs?v=3';
import {esc,money,propertyStage,propertyPhotos,proposalSummary} from './view.mjs?v=4';
import {dialCodes,replyDraft,proposedOffer,validateReply} from './reply.mjs?v=1';
import {mountGallery} from './gallery.mjs?v=1';
const hex=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
export function mountOffer({document,window,api,storage}){
  const root=document.querySelector('#offer-root'),token=window.location.hash.slice(1),shared=token.startsWith('listing.'),receiptLink=token.startsWith('receipt.');
  const session=window.ArenalOfferSession.create({storage}),gallery=mountGallery({document,window});
  let record,draft,screen='welcome',resumeScreen='draft',receipt=false,busy=false,hasDraft=false,leaving=false,submissionId=hex(),errors={},messageOpen=false,positions={};
  const language=()=>window.ArenalI18n?.language==='en'?'en':'es',t=(es,en)=>language()==='en'?en:es,$=s=>root.querySelector(s);
  const messages=()=>({amount:t('Indicá un monto mayor que cero.','Enter an amount greater than zero.'),currency:t('Elegí USD o CRC.','Choose USD or CRC.'),name:t('Escribí tu nombre.','Enter your name.'),replyMethod:t('Elegí WhatsApp o correo.','Choose WhatsApp or email.'),phone:t('Revisá tu número y el código de país.','Check your number and country code.'),email:t('Escribí un correo válido.','Enter a valid email address.'),dialCode:t('Indicá el código de país.','Enter your country calling code.'),message:t('Usá un máximo de 2.000 caracteres.','Use no more than 2,000 characters.')});
  function collect(){if(screen!=='draft'||receipt||!draft)return;for(const el of root.querySelectorAll('[name]'))if(el.type!=='radio'||el.checked)draft[el.name]=el.value;messageOpen=!!$('.offer-message')?.open;}
  function rememberPosition(){if(!['draft','review'].includes(screen))return;const focus=document.activeElement?.getAttribute('name');positions[screen]={y:window.scrollY||0,focus:focus||positions[screen]?.focus||''};}
  const snapshot=()=>({draft,submissionId,hasDraft,screen,resumeScreen,positions,messageOpen});
  function persist(capture=true){if(!draft||receipt)return true;if(capture){collect();rememberPosition();}return session.save(token,snapshot());}
  function applySaved(saved){if(saved?.draft?.schema!==2||!/^[a-f0-9]{32}$/.test(saved.submissionId||''))return;draft=replyDraft(record.property.currency,saved.draft);submissionId=saved.submissionId;hasDraft=saved.hasDraft??!!(draft.amount||draft.name||draft.contact||draft.message);screen=['welcome','draft','review'].includes(saved.screen)?saved.screen:'welcome';resumeScreen=saved.resumeScreen==='review'?'review':'draft';positions=saved.positions||{};messageOpen=!!saved.messageOpen;}
  function focusScreen(restore=false){
    const position=positions[screen];
    if(restore&&position){if(position.focus&&/^[a-zA-Z]+$/.test(position.focus))$('[name="'+position.focus+'"]')?.focus({preventScroll:true});window.scrollTo?.({top:Math.max(0,Number(position.y)||0),behavior:'instant'});}
    else {$('h1')?.focus({preventScroll:true});$('.offer-desk')?.scrollIntoView?.({block:'start',behavior:'instant'});}
  }
  function navigate(next,{restore=false,push=true}={}){
    persist();screen=next;if(next==='draft'||next==='review')resumeScreen=next;
    if(push)try{window.history.pushState({arenalOffer:{token,snapshot:snapshot()}},'');}catch{}
    render();persist(false);focusScreen(restore);
  }
  const field=(name,label,control)=>'<div class="simple-field"><label for="offer-'+name+'">'+label+'</label>'+(errors[name]?control.replace('>',' aria-invalid="true" aria-describedby="error-'+name+'">'):control)+(errors[name]?'<span id="error-'+name+'" class="field-error">'+messages()[name]+'</span>':'')+'</div>';
  const input=(name,type='text',extra='')=>'<input id="offer-'+name+'" name="'+name+'" type="'+type+'" value="'+esc(draft[name])+'" '+extra+'>';
  const arrow='<span aria-hidden="true">→</span>';
  const continueLabel=()=>t(hasDraft?'Continuar mi oferta':'Preparar mi oferta',hasDraft?'Continue my offer':'Prepare my offer');
  function brokerCard(){
    const contact=record.property.contact||{},phone=String(contact.whatsapp||'').replace(/\D/g,''),name=contact.name||record.broker;
    const message=t('Hola '+name+', tengo una consulta sobre '+(record.property.titles?.es||record.property.name)+'.','Hi '+name+', I have a question about '+(record.property.titles?.en||record.property.name)+'.');
    return '<div class="offer-broker"><span class="broker-initial" aria-hidden="true">'+esc(record.broker.slice(0,1))+'</span><div><p>'+t('Tu oferta la recibe','Your offer goes to')+' <strong>'+esc(record.broker)+'</strong></p>'+(/^[1-9]\d{7,14}$/.test(phone)?'<a href="https://wa.me/'+phone+'?text='+esc(encodeURIComponent(message))+'" target="_blank" rel="noopener noreferrer">'+t('Consultá a '+esc(name)+' por WhatsApp','Ask '+esc(name)+' on WhatsApp')+' ↗</a>':'')+'</div></div>';
  }
  function welcome(){return '<div class="offer-heading"><p class="eyebrow">'+t('UN LUGAR. TUS POSIBILIDADES.','A PLACE. YOUR POSSIBILITIES.')+'</p><h1 tabindex="-1">'+t('¿Te imaginás aquí?','Can you picture yourself here?')+'</h1><p>'+t('Mirala con calma. Cuando estés listo, poné tu propuesta en palabras.','Take a look around. When you’re ready, put your offer into words.')+'</p></div><div class="welcome-price"><span>'+t('Precio solicitado','Asking price')+'</span><strong>'+esc(money(record.property.price,record.property.currency,language()))+'</strong></div>'+(record.property.id?'<a class="property-full-link" data-full-listing href="/#propiedad/'+esc(record.property.id)+'">'+t('Ver anuncio completo','View full listing')+' ↗</a>':'')+brokerCard()+'<button type="button" class="primary offer-prepare" data-prepare>'+continueLabel()+arrow+'</button><p class="offer-assurance">'+t('Vas a revisar tu oferta antes de enviársela a ','You’ll review your offer before sending it to ')+esc(record.broker)+'.</p><p class="offer-error" role="alert"></p>';}
  function draftFields(){
    const phone=draft.replyMethod==='whatsapp',email=draft.replyMethod==='email';
    return '<div class="offer-amount-block"><div class="simple-amount">'+field('amount',t('Quiero ofrecer','I’d like to offer'),input('amount','number','min="0.01" step="0.01" max="9999999999999" inputmode="decimal" placeholder="0" required'))+field('currency',t('Moneda','Currency'),'<select id="offer-currency" name="currency">'+['USD','CRC'].map(c=>'<option value="'+c+'" '+(draft.currency===c?'selected':'')+'>'+c+'</option>').join('')+'</select>')+'</div></div>'+
      '<details class="offer-message" '+(messageOpen||draft.message||errors.message?'open':'')+'><summary><span aria-hidden="true" class="message-plus">+</span>'+t('Agregar condiciones o una nota','Add conditions or a note')+' <span class="optional">'+t('opcional','optional')+'</span></summary>'+field('message',t('Lo que querés que sepan','What you’d like them to know'),'<textarea id="offer-message" name="message" rows="3" maxlength="2000" placeholder="'+t('Tus condiciones o algo que querás aclarar.','Your terms or anything you’d like to clarify.')+'">'+esc(draft.message)+'</textarea>')+'</details>'+
      '<div class="simple-contact">'+field('name',t('Tu nombre','Your name'),input('name','text','autocomplete="name" maxlength="120" placeholder="'+t('Nombre y apellido','Full name')+'" required'))+
      '<fieldset class="reply-choice" '+(errors.replyMethod?'aria-describedby="error-replyMethod"':'')+'><legend>'+t('¿Cómo preferís que te responda el corredor?','How would you like the broker to reply?')+'</legend><div>'+[['whatsapp','WhatsApp'],['email',t('Correo','Email')]].map(([value,label])=>'<label><input type="radio" name="replyMethod" value="'+value+'" '+(draft.replyMethod===value?'checked':'')+' required><span>'+label+'</span></label>').join('')+'</div>'+(errors.replyMethod?'<span class="field-error" id="error-replyMethod">'+messages().replyMethod+'</span>':'')+'</fieldset>'+
      (phone?'<div class="offer-phone">'+field('country',t('País','Country'),'<select id="offer-country" name="country" autocomplete="tel-country-code">'+dialCodes.map(([code,name])=>'<option value="'+code+'" '+(draft.country===code?'selected':'')+'>'+esc(name)+' +'+code+'</option>').join('')+'<option value="other" '+(draft.country==='other'?'selected':'')+'>'+t('Otro país','Another country')+'</option></select>')+field('phone',t('Tu WhatsApp','Your WhatsApp'),input('phone','tel','inputmode="tel" autocomplete="tel-national" maxlength="40" placeholder="'+t('Tu número','Your number')+'" required'))+'</div>'+(draft.country==='other'?field('dialCode',t('Código de país','Country calling code'),input('dialCode','tel','inputmode="tel" autocomplete="tel-country-code" maxlength="5" placeholder="+" required')):''):'')+
      (email?field('email',t('Tu correo','Your email'),input('email','email','inputmode="email" autocomplete="email" maxlength="254" autocapitalize="none" spellcheck="false" placeholder="'+t('tu@correo.com','you@example.com')+'" required')):'')+'</div>';
  }
  function watchImage(){const img=$('.property-scene img');img?.addEventListener('error',()=>img.remove(),{once:true});}
  function render(){
    if(!record)return;document.title=t('Prepará tu oferta','Prepare your offer')+' · ArenalIndex';document.querySelector('#offer-header-label').textContent=t('Oferta de compra','Purchase offer');root.classList.add('offer-experience');root.dataset.stage=receipt?'sent':screen;
    if(receipt){renderReceipt();return;}
    const review=screen==='review';
    const content=screen==='welcome'?welcome():'<button class="text-button offer-property-back" type="button" data-welcome>← '+t('La propiedad','The property')+'</button><div class="offer-heading"><p class="eyebrow">'+t(review?'CUANDO VOS DECIDÁS':'TU PRÓXIMO PASO',review?'READY WHEN YOU ARE':'YOUR NEXT STEP')+'</p><h1 tabindex="-1">'+t(review?'Esta es tu oferta.':'Tu oferta. Tus palabras.',review?'This is your offer.':'Your offer. Your words.')+'</h1><p>'+t(review?'Un momento para revisar los detalles. Vos decidís cuándo está lista.':'Dale forma a lo que tenés en mente.',review?'A moment to check the details. You decide when it’s ready.':'Put what you have in mind into words.')+'</p></div><form id="offer-form" novalidate>'+ (review?proposalSummary({property:record.property,broker:record.broker,offer:proposedOffer(draft),language:language()}):draftFields())+'<p class="offer-send-status" role="status"></p><p class="offer-error" role="alert"></p><div class="simple-actions">'+(review?'<button class="text-button" type="button" data-edit>← '+t('Editar mi oferta','Edit my offer')+'</button>':'')+'<button class="primary" type="submit">'+(review?t('Enviar a ','Send to ')+esc(record.broker):t('Revisar mi oferta','Review my offer'))+arrow+'</button></div>'+(!review?'<p class="offer-assurance">'+t('Es solo un borrador. ','Just a draft. ')+esc(record.broker)+t(' todavía no lo recibe.',' hasn’t received it yet.')+'</p>':'')+'</form>';
    root.innerHTML='<div class="offer-spread">'+propertyStage(record.property,language(),{gallery:true,listing:screen!=='welcome',showPrice:screen!=='welcome'})+'<section class="offer-desk">'+content+'</section></div>';
    const amount=$('[name=amount]');if(amount)amount.dataset.long=String(amount.value.length>9);watchImage();
    $('.offer-message')?.addEventListener('toggle',event=>{messageOpen=event.target.open;persist(false);});
  }
  function renderReceipt(){
    const latest=record.versions?.at(-1);if(!latest){unavailable(t('Este enlace venció. Pedí el formulario de la propiedad a tu corredor.','This link expired. Ask your broker for the property’s offer form.'));return;}
    root.innerHTML='<div class="offer-spread">'+propertyStage(record.property,language(),{gallery:true})+'<section class="offer-desk"><div class="offer-heading offer-success"><div class="offer-success-mark" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="m8 16 5 5 11-12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div><p class="eyebrow">'+t('OFERTA ENVIADA','OFFER SENT')+'</p><h1 tabindex="-1">'+t('Ya diste el primer paso.','You’ve taken the first step.')+'</h1><p>'+esc(record.broker)+t(' ya puede ver tu oferta y contactarte para conversar.',' can now view your offer and contact you to discuss it.')+'</p>'+(record.alreadySent?'<p class="offer-retry-note">'+t('Un intento anterior ya había sido recibido. Esta es la oferta guardada.','An earlier attempt was already received. This is the saved offer.')+'</p>':'')+'</div><div class="offer-team-note"><p>'+t('Estamos con vos.','We’re rooting for you.')+'</p><small>— '+t('El equipo de ArenalIndex','The ArenalIndex team')+'</small></div>'+proposalSummary({property:record.property,broker:record.broker,offer:latest.offer,version:latest,language:language()})+'<div class="offer-toolbar"><button class="quiet" data-print>'+t('Guardar PDF / imprimir','Save PDF / print')+'</button>'+(record.receiptURL?'<a class="receipt-link" href="'+esc(record.receiptURL)+'">'+t('Tu copia privada ↗','Your private copy ↗')+'</a>':'')+'</div><p class="receipt-note">'+t('Conservá esta página como constancia de tu propuesta.','Keep this page as a record of your proposal.')+'</p>'+(record.versions.length>1?'<details class="offer-history"><summary>'+t('Versiones anteriores','Previous versions')+'</summary>'+record.versions.slice(0,-1).reverse().map(version=>proposalSummary({property:record.property,broker:record.broker,offer:version.offer,version,language:language()})).join('')+'</details>':'')+'</section></div>';watchImage();
  }
  function unavailable(message){root.innerHTML='<section class="offer-unavailable"><h1>'+t('Formulario no disponible','Form unavailable')+'</h1><p role="alert">'+esc(message)+'</p><button class="quiet" data-reload>'+t('Reintentar','Try again')+'</button></section>';}
  root.addEventListener('input',event=>{
    if(busy||screen!=='draft')return;
    // Unchecked radios and the unselected contact channel never replace draft fields.
    if(event.target.type==='radio')return;
    draft[event.target.name]=event.target.value;hasDraft=true;delete errors[event.target.name];event.target.removeAttribute('aria-invalid');event.target.removeAttribute('aria-describedby');$('#error-'+event.target.name)?.remove();const amount=$('[name=amount]');if(amount)amount.dataset.long=String(amount.value.length>9);persist();
  });
  root.addEventListener('change',event=>{
    if(busy||screen!=='draft')return;const name=event.target.name;
    if(name==='replyMethod'){collect();draft.replyMethod=event.target.value;hasDraft=true;delete errors.replyMethod;render();$('[name="'+(draft.replyMethod==='email'?'email':'phone')+'"]')?.focus({preventScroll:true});}
    else if(name==='country'){collect();draft.country=event.target.value;hasDraft=true;delete errors.dialCode;render();$('[name="'+(draft.country==='other'?'dialCode':'phone')+'"]')?.focus({preventScroll:true});}
    persist();
  });
  root.addEventListener('click',event=>{
    if(busy)return;
    const link=event.target.closest('[data-full-listing]');if(link){event.preventDefault();persist();leaving=true;if(!session.visitListing(token,record.property.id,snapshot())){leaving=false;$('.offer-error').textContent=t('No se pudo guardar tu borrador. Mantené esta página abierta e intentá de nuevo.','Your draft could not be saved. Keep this page open and try again.');}return;}
    const button=event.target.closest('button');if(!button)return;
    if(button.hasAttribute('data-prepare'))navigate(hasDraft?resumeScreen:'draft',{restore:hasDraft});
    if(button.hasAttribute('data-welcome'))navigate('welcome');
    if(button.hasAttribute('data-edit'))navigate('draft',{restore:true});
    if(button.hasAttribute('data-photos'))gallery.open(record.property,propertyPhotos(record.property),button);
    if(button.hasAttribute('data-print'))window.print();
    if(button.hasAttribute('data-reload'))window.location.reload();
  });
  root.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||receipt||screen==='welcome')return;collect();errors=validateReply(draft);
    if(Object.keys(errors).length){screen='draft';resumeScreen='draft';render();$('[name="'+Object.keys(errors)[0]+'"]')?.focus();persist(false);return;}
    if(screen!=='review'){navigate('review');return;}
    busy=true;$('#offer-form').setAttribute('aria-busy','true');for(const b of root.querySelectorAll('button'))b.disabled=true;$('.offer-error').textContent='';$('.offer-send-status').textContent=t('Enviando tu oferta…','Sending your offer…');
    try{
      record=await api(shared?'offer_form_submit':'offer_submit',{token,offer:proposedOffer(draft),submissionId,propertyVersion:record.propertyVersion,revision:record.revision,confirmed:true,noticeVersion:simpleNoticeVersion,language:language()});
      receipt=true;hasDraft=false;session.clear(token,record.property.id);if(record.receiptURL)try{window.history.replaceState({},'',new URL(record.receiptURL).hash);}catch{}
      render();focusScreen();
    }catch(error){$('.offer-error').textContent=error.message;}
    finally{busy=false;$('#offer-form')?.removeAttribute('aria-busy');if($('.offer-send-status'))$('.offer-send-status').textContent='';for(const b of root.querySelectorAll('button'))b.disabled=false;}
  });
  window.addEventListener('arenal-language-change',()=>{if(busy)return;persist();render();});
  window.addEventListener('pagehide',()=>{if(!leaving)persist();});
  window.addEventListener('pageshow',event=>{leaving=false;if(event.persisted&&record&&!receipt){applySaved(session.load(token));render();focusScreen(true);}});
  window.addEventListener('popstate',event=>{if(!record||receipt||busy)return;collect();rememberPosition();gallery.close();const saved=event.state?.arenalOffer;screen=saved?.token===token&&['welcome','draft','review'].includes(saved.snapshot?.screen)?saved.snapshot.screen:'welcome';render();persist(false);focusScreen(true);});
  window.addEventListener('beforeunload',event=>{if(hasDraft&&!receipt&&!leaving&&!persist()){event.preventDefault();event.returnValue='';}});
  async function start(){
    if(!/^(?:(?:listing|receipt)\.)?[a-f0-9]{64}\.[a-f0-9]{64}$/.test(token)){unavailable(t('Abrí el enlace de la propiedad que te compartió tu corredor.','Open the property link shared by your broker.'));return;}
    try{record=await api(shared?'offer_form_open':receiptLink?'offer_receipt':'offer_open',{token});receipt=receiptLink||!!record.revision||!!record.expired;draft=replyDraft(record.property.currency);if(!receipt)applySaved(session.load(token));render();if(!receipt){persist(false);if(screen!=='welcome')focusScreen(true);}}
    catch(error){unavailable(error.message);}
  }
  return {ready:start()};
}
if(typeof window!=='undefined'&&document.querySelector('#offer-root'))mountOffer({document,window,api:async(action,body)=>{
  const response=await fetch(new URL('owner',window.ArenalConfig.intakeUrl),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...body}),cache:'no-store',signal:AbortSignal.timeout(60000)});
  const result=await response.json();if(!response.ok)throw Error(window.ArenalI18n?.language==='en'?(result.errorEnglish||'Could not complete this request. Please try again.'):result.error||'No se pudo completar. Intentá de nuevo.');return result;
}});
