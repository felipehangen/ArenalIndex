import {esc,money,date,proposalSummary} from '../offer/view.mjs?v=4';
export function mountOffers({document,window,api,onUnauthorized=()=>{}}){
  const root=document.querySelector('#offers-panel');let identity=null,listings=[],records=[],selected=null,generation=0,busy=false,query='',filter='received',error='',loaded=false,loading=false;
  const language=()=>window.ArenalI18n?.language==='en'?'en':'es',t=(es,en)=>language()==='en'?en:es,$=s=>root.querySelector(s);
  const status=row=>row.revoked?t('Cerrada','Closed'):row.revision>row.reviewedRevision?t('Por revisar','To review'):row.revision?t('Revisada','Reviewed'):t('Enlace anterior','Earlier link');
  function render(){
    if(!identity)return;root.setAttribute('aria-label',t('Ofertas','Offers'));if(selected){renderDetail();return;}
    const found=records.filter(row=>(filter==='received'?row.revision>0:row.revision===0)&&[row.property.name,row.versions.at(-1)?.offer.name,row.versions.at(-1)?.offer.contact,row.versions.at(-1)?.offer.email].join(' ').toLowerCase().includes(query.toLowerCase()));
    root.innerHTML='<div class="workspace-heading offer-inbox-header"><div><h1>'+t('Ofertas','Offers')+'</h1><p class="muted">'+t('Las propuestas de tus compradores, en un solo lugar.','Your buyers’ proposals, all in one place.')+'</p></div></div>'+
      '<div class="offer-inbox-list"><div class="offer-list-tools"><label class="offer-field"><span class="sr-offer">'+t('Buscar ofertas','Search offers')+'</span><input id="offer-search" type="search" value="'+esc(query)+'" placeholder="'+t('Comprador o propiedad','Buyer or property')+'"></label>'+ (records.some(r=>!r.revision)?'<label class="offer-field"><span class="sr-offer">'+t('Ver','Show')+'</span><select id="offer-filter"><option value="received" '+(filter==='received'?'selected':'')+'>'+t('Recibidas','Received')+'</option><option value="previous" '+(filter==='previous'?'selected':'')+'>'+t('Enlaces anteriores','Earlier links')+'</option></select></label>':'')+'<button class="quiet" data-refresh '+(loading?'disabled':'')+'>'+t('Actualizar','Refresh')+'</button></div><div class="offer-list" aria-busy="'+loading+'">'+(loading&&!loaded?'<p class="empty-state">'+t('Cargando…','Loading…')+'</p>':!found.length?'<div class="offer-empty"><h2>'+t(query?'No hay coincidencias':'Todavía no hay ofertas',query?'No matches':'No offers yet')+'</h2><p>'+t(query?'Probá otra búsqueda.':'Los formularios se comparten desde Mis anuncios. Cuando un comprador envíe su oferta, la verás aquí.',query?'Try another search.':'Share offer forms from My listings. When a buyer sends a proposal, it will appear here.')+'</p></div>':found.map(row=>{const v=row.versions.at(-1);return '<button class="offer-inbox-row" data-open="'+row.id+'"><span><strong>'+esc(v?.offer.name||t('Enlace anterior','Earlier link'))+'</strong><small>'+esc(row.property.titles?.[language()]||row.property.name)+(row.property.isDemo?' · DEMO':'')+'</small></span><span class="offer-row-amount">'+(v?esc(money(v.offer.amount,v.offer.currency,language())):'—')+'<small>'+esc(date(v?.submittedAt||row.createdAt,language()))+'</small></span><span class="status-badge" data-state="'+(row.revision>row.reviewedRevision?'ready_for_review':'')+'">'+status(row)+'</span><span aria-hidden="true">→</span></button>';}).join(''))+'</div></div><p class="offer-error" role="alert">'+esc(error)+'</p>';
  }
  function renderDetail(){
    const row=selected,v=row.versions.at(-1);
    root.innerHTML='<button class="text-button offer-detail-back" data-back>← '+t('Ofertas','Offers')+'</button><div class="offer-toolbar">'+(v?'<button class="quiet" data-print>'+t('Guardar PDF / imprimir','Save PDF / print')+'</button>'+(row.reviewedRevision<row.revision?'<button class="quiet" data-reviewed>'+t('Marcar revisada','Mark reviewed')+'</button>':''):'')+(!row.revoked?'<button class="text-button" data-revoke>'+t('Cerrar acceso a esta copia','Close access to this copy')+'</button>':'')+'</div><p class="offer-error" role="alert">'+esc(error)+'</p><div class="offer-detail">'+(v?proposalSummary({property:row.property,broker:row.broker,offer:v.offer,version:v,language:language()}):'<p>'+t('Este enlace anterior todavía no tiene una oferta. Usá el nuevo formulario de la propiedad para compartir.','This earlier link has no proposal yet. Use the new property form to share.')+'</p>')+'</div>'+(row.versions.length>1?'<details class="offer-history"><summary>'+t('Versiones anteriores','Previous versions')+'</summary>'+row.versions.slice(0,-1).reverse().map(version=>proposalSummary({property:row.property,broker:row.broker,offer:version.offer,version,language:language()})).join('')+'</details>':'');
  }
  async function refresh(){
    if(!identity||loading)return;const epoch=generation;loading=true;error='';render();
    try{const all=[],seen=new Set();let cursor;do{const page=await api.request('offers_list',cursor?{cursor}:{});if(epoch!==generation)return;all.push(...page.records);cursor=page.cursor;if(cursor&&seen.has(cursor))throw Error(t('No se pudo cargar la lista completa.','Could not load the complete list.'));seen.add(cursor);}while(cursor);records=all.sort((a,b)=>Date.parse(b.versions.at(-1)?.submittedAt||b.createdAt)-Date.parse(a.versions.at(-1)?.submittedAt||a.createdAt));loaded=true;if(selected)selected=records.find(r=>r.id===selected.id)||null;}
    catch(e){if(epoch!==generation)return;if(e.status===401){onUnauthorized();return;}error=e.message;}
    finally{if(epoch===generation){loading=false;render();}}
  }
  // The sharing dialog belongs to the listing action, never to the inbox state.
  const dialog=document.createElement('dialog');
  dialog.className='offer-share-dialog';dialog.setAttribute('aria-labelledby','offer-share-title');dialog.setAttribute('aria-describedby','offer-share-description');dialog.setAttribute('translate','no');document.body.append(dialog);
  let sharing=null,shareEpoch=0,returnFocus=null;
  const modal=s=>dialog.querySelector(s);
  function renderShare(){
    if(!sharing)return;
    const {propertyId,result,loading,error,copied,fallback}=sharing;
    const row=listings.find(r=>r.id===propertyId),property=result?.property;
    const title=property?.titles?.[language()]||property?.name||row?.title||t('Propiedad','Property');
    dialog.innerHTML='<div class="offer-share-heading"><p class="eyebrow">'+t('COMPARTIR CON UN COMPRADOR','SHARE WITH A BUYER')+'</p><button class="offer-share-close quiet" data-share-close aria-label="'+t('Cerrar','Close')+'" autofocus>×</button></div><h2 id="offer-share-title">'+t('Formulario de oferta','Offer form')+'</h2><p class="offer-share-property">'+esc(title)+(property?.isDemo||row?.isDemo?' · DEMO':'')+'</p><p id="offer-share-description">'+t('Un enlace para esta propiedad. Cada comprador envía su propia oferta.','One link for this property. Each buyer sends their own offer.')+'</p><div class="offer-share-content" aria-busy="'+loading+'">'+(loading?'<p class="offer-share-loading" role="status">'+t('Preparando el enlace…','Preparing your link…')+'</p>':error?'<p class="offer-error" role="alert">'+esc(error)+'</p><button class="quiet" data-share-retry>'+t('Reintentar','Try again')+'</button>':'<div class="offer-share-actions"><button class="primary" data-copy>'+t(copied?'Enlace copiado ✓':'Copiar enlace',copied?'Link copied ✓':'Copy link')+'</button><a class="quiet" data-view-form href="'+esc(result.url)+'" target="_blank" rel="noopener noreferrer">'+t('Ver formulario ↗','View form ↗')+'</a></div>')+'</div><p class="offer-copy-status" role="status">'+(copied?t('Listo para pegar en tu conversación.','Ready to paste into your conversation.'):'')+'</p><div class="offer-copy-area" '+(fallback?'':'hidden')+'><label class="offer-field" for="offer-share-url">'+t('Seleccioná y copiá este enlace','Select and copy this link')+'</label><textarea id="offer-share-url" readonly>'+esc(result?.url||'')+'</textarea></div>';
  }
  function closeShare(restore=true){
    shareEpoch++;sharing=null;
    if(dialog.hasAttribute('open')){if(dialog.close)dialog.close();else dialog.removeAttribute('open');}
    dialog.replaceChildren();
    if(restore&&returnFocus?.isConnected)returnFocus.focus({preventScroll:true});
    returnFocus=null;
  }
  async function getLink(){
    if(!sharing||!identity)return;
    const epoch=++shareEpoch,propertyId=sharing.propertyId;
    Object.assign(sharing,{loading:true,error:'',result:null,copied:false,fallback:false});renderShare();modal('[data-share-close]')?.focus({preventScroll:true});
    try{const result=await api.request('offer_form',{propertyId});if(epoch!==shareEpoch)return;Object.assign(sharing,{result,loading:false});}
    catch(e){if(epoch!==shareEpoch)return;if(e.status===401){closeShare(false);onUnauthorized();return;}Object.assign(sharing,{error:e.message,loading:false});}
    if(epoch===shareEpoch){
      const focus=modal('[data-share-close]')===document.activeElement?'[data-share-close]':'[data-copy], [data-share-retry]';
      renderShare();modal(focus)?.focus({preventScroll:true});
    }
  }
  function openShare(button){
    if(!identity)return;
    if(sharing)closeShare(false);
    returnFocus=button;sharing={propertyId:button.dataset.offerInvite,loading:true};renderShare();
    if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');
    modal('[data-share-close]').focus({preventScroll:true});getLink();
  }
  dialog.addEventListener('cancel',event=>{event.preventDefault();closeShare();});
  dialog.addEventListener('click',async event=>{
    if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)closeShare();return;}
    if(event.target.closest('[data-share-close]')){closeShare();return;}
    if(event.target.closest('[data-share-retry]')){getLink();return;}
    const button=event.target.closest('[data-copy]');if(!button||!sharing?.result)return;
    const epoch=shareEpoch,url=sharing.result.url;button.disabled=true;
    try{await window.navigator.clipboard.writeText(url);if(epoch!==shareEpoch)return;sharing.copied=true;button.textContent=t('Enlace copiado ✓','Link copied ✓');modal('.offer-copy-status').textContent=t('Listo para pegar en tu conversación.','Ready to paste into your conversation.');}
    catch{if(epoch!==shareEpoch)return;sharing.fallback=true;modal('.offer-copy-area').hidden=false;modal('.offer-copy-status').textContent=t('Copiá el enlace de abajo.','Copy the link below.');const field=modal('textarea');field.focus();field.select();}
    finally{if(epoch===shareEpoch)button.disabled=false;}
  });
  document.querySelector('[data-owner-panel="offers"]').addEventListener('click',()=>{if(identity)refresh();});
  document.querySelector('#admin-records').addEventListener('click',event=>{const button=event.target.closest('[data-offer-invite]');if(button)openShare(button);});
  root.addEventListener('input',event=>{if(event.target.id==='offer-search'){query=event.target.value;const pos=event.target.selectionStart;render();const input=$('#offer-search');input.focus();if(pos!==null)input.setSelectionRange?.(pos,pos);}});
  root.addEventListener('change',event=>{if(event.target.id==='offer-filter'){filter=event.target.value;render();}});
  root.addEventListener('click',async event=>{
    const b=event.target.closest('button');if(!b||busy)return;
    if(b.hasAttribute('data-open')){selected=records.find(r=>r.id===b.dataset.open);error='';render();}
    if(b.hasAttribute('data-back')){selected=null;error='';render();}
    if(b.hasAttribute('data-refresh'))await refresh();
    if(b.hasAttribute('data-print'))window.print();
    if(b.hasAttribute('data-revoke')||b.hasAttribute('data-reviewed')){
      const revoke=b.hasAttribute('data-revoke');if(revoke&&!window.confirm(t('¿Cerrar el acceso del comprador a esta copia? La oferta se conserva en tu cuenta.','Close the buyer’s access to this copy? The proposal stays in your account.')))return;
      const epoch=generation;busy=true;b.disabled=true;try{await api.request(revoke?'offer_revoke':'offer_reviewed',{id:selected.id,revision:selected.revision});if(epoch===generation)await refresh();}catch(e){if(epoch!==generation)return;if(e.status===401){onUnauthorized();return;}error=e.message;render();}finally{if(epoch===generation)busy=false;b.disabled=false;}
    }
  });
  window.addEventListener('arenal-language-change',()=>{render();if(sharing){const focused=document.activeElement;const selector=focused?.hasAttribute('data-copy')?'[data-copy]':focused?.hasAttribute('data-view-form')?'[data-view-form]':focused?.tagName==='TEXTAREA'?'textarea':'[data-share-close]';renderShare();modal(selector)?.focus({preventScroll:true});}});
  window.addEventListener('arenal-owner-clear',()=>{generation++;closeShare(false);identity=null;listings=[];records=[];selected=null;loaded=false;loading=false;busy=false;query='';filter='received';error='';root.replaceChildren();root.hidden=true;});
  return {setIdentity(value){identity=value;render();},setListings(value){listings=value;render();}};
}
