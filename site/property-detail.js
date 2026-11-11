(async () => {
  await window.arenalReady;
  'use strict';
  const app = window.arenalDemo;
  if (!app) return;
  const root = document.getElementById('arenal-index-dos');
  const home = document.getElementById('index-home');
  const page = document.createElement('dialog');
  page.className = 'pd-page'; page.hidden = true; page.setAttribute('aria-label', 'Detalle de propiedad');
  root.append(page);
  const {number} = window.ArenalFormat;
  const content = window.ArenalListing;
  const offerSession=window.ArenalOfferSession?.create();
  const offerContext=id=>window.ArenalPreview?null:offerSession?.returnFor(id);
  const offerLabel=context=>window.ArenalI18n?.language==='en'?(context.hasDraft?'Continue my offer':'Back to offer'):(context.hasDraft?'Continuar mi oferta':'Volver a la oferta');
  const offerLink=(context,css='pd-primary')=>context?'<a translate="no" class="'+css+'" data-offer-return href="'+context.href+'">'+offerLabel(context)+' →</a>':'';
  const photoCount=count=>count+(count===1?' foto':' fotos');
  const money = value => value===null||!Number.isFinite(value)||!current?.currency?'Por definir':content.price(value,current.currency);
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const paths = {
    back:'<path d="m14 6-6 6 6 6"/>', next:'<path d="m10 6 6 6-6 6"/>', close:'<path d="m6 6 12 12M6 18 18 6"/>',
    heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
    share:'<path d="M12 16V3m-4 4 4-4 4 4M5 12v8h14v-8"/>',
    water:'<path d="M12 3c-2 4-7 8-7 12a7 7 0 0 0 14 0c0-4-5-8-7-12Z"/>',
    electricity:'<path d="m13 2-9 12h7l-1 8 10-13h-8l1-7Z"/>',
    well:'<path d="M5 10h14v11H5zM3 10l9-8 9 8M12 10v6"/><path d="M9 16h6v5H9z"/>',
    fence:'<path d="M4 21V5l2-3 2 3v16M16 21V5l2-3 2 3v16M8 8h8M8 16h8"/>',
    land:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="m8 16 8-8M8 11v5h5"/>',
    house:'<path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8"/>',
    mountain:'<path d="m2 20 8-15 5 8 3-4 4 11H2Zm5-9 3 2 3-2"/>',
    river:'<path d="M2 6c4-4 6 4 10 0s6 4 10 0M2 12c4-4 6 4 10 0s6 4 10 0M2 18c4-4 6 4 10 0s6 4 10 0"/>',
    pin:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.land}</svg>`;
  const iconButton = (action, label, name) => `<button class="pd-icon" data-action="${action}" aria-label="${label}">${icon(name)}</button>`;
  let current = null, detailMap = null, returnFocus = null, openDialog = null, photos = [], pendingMap = null;
  const originalTitle = document.title;
  function attr(label, value) { return `<div><dt>${label}</dt><dd${value === 'Por confirmar' ? ' class="pd-unknown"' : ''}>${value}</dd></div>`; }
  function syncSave() {
    const saved = app.state.saved.includes(current.id), button = page.querySelector('[data-action="save"]');
    button.setAttribute('aria-pressed', String(saved)); button.setAttribute('aria-label', saved ? 'Quitar de guardados' : 'Guardar propiedad');
  }
  function render(d) {
    detailMap?.remove(); detailMap = null;
    current = d;
    const title = window.ArenalI18n?.listingText(d)||d.name;
    const offer=offerContext(d.id);
    const place=d.draftPreview&&d.place==='Localidad por definir'?window.ArenalI18n?.t(d.place)||d.place:d.place;
    const tour=content.groups(d),allPhotos=tour.flatMap(group=>group.images);
    photos=d.images.filter((src,i,array)=>array.indexOf(src)===i).slice(0,5).map(src=>allPhotos.find(p=>p.src===src)||{src,label:d.name});
    const count=allPhotos.length,contactLinks=content.contactLinks(d),hasContact=!!contactLinks;
    const contactAction=label=>contactLinks?.whatsapp?'<a class="pd-primary" href="'+escape(contactLinks.whatsapp)+'" target="_blank" rel="noopener noreferrer">'+label+'</a>':'<button class="pd-primary" data-action="contact">'+label+'</button>';
    const pricing=app.pricing||window.ArenalPricing?.create([d]);
    const display=pricing?.view(d,app.state.filters?.currency||'USD')||{price:d.price,unit:d.price!==null&&d.area>0?d.price/d.area:null,currency:d.currency};
    const currency=display.currency||'',unitPrice=display.unit;
    const displayedMoney=value=>content.price(value,currency);
    const other=pricing?.view(d,d.currency==='CRC'?'USD':'CRC');
    const originalPrice=money(d.price)+' '+(d.currency||'');
    const priceDetails='<section class="pd-section pd-sale-price"><h2>El precio</h2><p><strong>Precio solicitado: '+escape(originalPrice)+'</strong></p>'+(other?.approximate?'<p>Equivalente estimado: '+escape(content.price(other.price,other.currency)+' '+other.currency)+'</p>':'')+'<p class="pd-muted">'+escape(pricing?.note()||'')+'</p><p class="pd-muted">El precio y la moneda de pago se acuerdan con el propietario.</p></section>';
    const areaBasis=d.isDemo?'área de ejemplo':d.draftPreview?(d.details.documentedArea?'área indicada del plano':'área declarada'):d.details?'área del plano':'área indicada';
    page.innerHTML = `<div class="pd-bar">${iconButton('back',offer?offerLabel(offer):window.ArenalPreview?'Cerrar vista previa':'Cerrar propiedad y volver a los resultados','back')}<a class="pd-brand" href="#" aria-label="Arenal Index">arenal <small>INDEX</small></a><div class="pd-bar-actions">${window.ArenalI18n?.toggle()||''}${iconButton('share','Compartir propiedad','share')}${iconButton('save','Guardar propiedad','heart')}</div></div>
      <div class="pd-scroll">${offer?'<div class="pd-offer-return" translate="no">'+offerLink(offer)+'</div>':''}<header class="pd-heading"><p class="pd-kicker">${d.draftPreview?'Vista previa privada · borrador sin publicar':window.ArenalPreview?'Vista previa privada':d.isDemo?'Un ejemplo de lo que podés encontrar':'Propiedad en venta'}</p>${window.ArenalAccount?.attribution()||''}<h1 tabindex="-1" translate="no">${escape(title)}</h1><p class="pd-location"><a href="#pd-location" translate="no">${icon('pin')}${escape(place)} · Costa Rica</a>${d.isDemo?'<span class="pd-sample">Demostración</span>':''}</p></header>
      <button class="pd-hero" data-action="photos" aria-label="Ver ${count} ${count===1?'fotografía':'fotografías'}" ${!count?'disabled':''}><div class="pd-photo-grid pd-grid-${photos.length}">${photos.map(p=>`<img translate="no" src="${escape(p.src)}" alt="${escape(content.photoAlt(p,current))}">`).join('')}</div>${d.isDemo?'<span class="pd-photo-label">Fotos ilustrativas</span>':''}<span class="pd-photo-count">${icon('grid')} ${count?(count===1?'Ver la foto':'Ver las '+count+' fotos'):'Fotos por incorporar'}</span></button>
      <div class="pd-content"><main>${content.content(d,display)}${priceDetails}${content.contactContent(d)}
      <section class="pd-section" id="pd-location"><h2>La ubicación</h2><p translate="no">${escape(place)} · Costa Rica</p><div class="pd-map" aria-label="Mapa de ubicación"></div><p class="pd-muted">${!d.coordinates?'Entrada por ubicar':d.isDemo?'Ubicación de demostración':d.details?.entrance?'El pin señala la entrada de la propiedad':d.approximate?'Ubicación aproximada':'Ubicación indicada en el anuncio'}. El punto no representa los linderos.</p><button class="pd-outline" data-action="map"${!d.coordinates?' disabled':''}>Explorar esta zona en el mapa</button></section>
      </main><aside class="pd-aside"><p class="pd-price-label">Precio en ${currency}</p><strong>${displayedMoney(display.price)} <small>${currency}</small></strong><p>${displayedMoney(unitPrice)} ${currency}/m² · ${areaBasis}</p><p class="pd-original-price">Solicitado: ${escape(originalPrice)}</p><div class="pd-price-rule"></div><p>¿Te imaginás aquí?<br>Consultá los detalles y coordiná una visita.</p>${contactAction(contactLinks?.whatsapp?'Consultar por WhatsApp':hasContact?'Ver contacto':'Preparar una consulta')}${hasContact?'<a class="pd-contact-more" href="#pd-contact">Ver contacto y otras opciones</a>':''}<small class="pd-contact-caption" ${contactLinks?.name!=='Contacto del anuncio'&&hasContact?'translate="no"':''}>${hasContact?escape(contactLinks.name):'El contacto de venta está por asignar'}</small></aside></div></div>
      <div class="pd-footer"><div><strong>${displayedMoney(display.price)} <small>${currency}</small></strong><span class="pd-unit">${displayedMoney(unitPrice)} ${currency}/m²</span></div>${offer?offerLink(offer):contactAction(contactLinks?.whatsapp?'WhatsApp':hasContact?'Ver contacto':'Preparar consulta')}</div>`;
    syncSave();
    if(offer)page.querySelectorAll('[data-offer-return]').forEach(link=>link.onclick=e=>{e.preventDefault();if(!offerSession.returnToOffer(offerContext(d.id)))render(current);});
    const contactMore=page.querySelector('.pd-contact-more');if(contactMore)contactMore.onclick=e=>{e.preventDefault();page.querySelector('#pd-contact').scrollIntoView({block:'start',behavior:'smooth'});};
    page.querySelector('.pd-brand').onclick=e=>{e.preventDefault();back();};
    page.querySelector('.pd-location a').onclick = e => { e.preventDefault(); page.querySelector('#pd-location').scrollIntoView({block:'start',behavior:'smooth'}); };
    const mapNode = page.querySelector('.pd-map');
    if(!d.coordinates){mapNode.innerHTML='<p style="padding:20px">Marcá la entrada en la ficha para ver el mapa aquí.</p>';return;}
    mapNode.innerHTML='<span style="display:block;padding:20px;font-size:12px">Mapa de ubicación</span>';
    // Load only when the location section enters the detail viewport.
    const observer = new IntersectionObserver(entries => { if(!entries.some(e=>e.isIntersecting)) return; observer.disconnect(); if(!window.maplibregl || page.hidden || current !== d) return; mapNode.replaceChildren(); detailMap = new maplibregl.Map({container:mapNode,center:d.coordinates,zoom:13,interactive:false,attributionControl:false,style:{version:8,sources:{osm:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,maxzoom:19,attribution:'© OpenStreetMap contributors'}},layers:[{id:'osm',type:'raster',source:'osm'}]}}); detailMap.addControl(new maplibregl.AttributionControl({compact:false}));const marker=document.createElement('div');marker.className='pd-map-pin';marker.innerHTML=icon(d.house?'house':'land');new maplibregl.Marker({element:marker}).setLngLat(d.coordinates).addTo(detailMap); },{root:page.querySelector('.pd-scroll')});
    observer.observe(mapNode); page._observer?.disconnect(); page._observer=observer;
  }
  function show(d) {
    window.ArenalAnalytics?.track('listing_view',d);
    ArenalMotion.cancel(page);
    if(page.hidden) returnFocus=document.activeElement;
    home.inert=true;home.setAttribute('aria-hidden','true');
    page.hidden=false;render(d);if(!page.open)page.showModal(); document.title=`${window.ArenalI18n?.listingText(d)||d.name} · Arenal Index`;
    page.querySelector('h1').focus({preventScroll:true});
  }
  function hide() {
    ArenalMotion.leave(page, () => {
    const closingId=current?.id;openDialog?.close();page._observer?.disconnect();detailMap?.remove();detailMap=null;page.close();page.hidden=true;current=null;
    home.inert=false;home.removeAttribute('aria-hidden');document.title=originalTitle;
    if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});else if(closingId)home.querySelector('[href="#propiedad/'+closingId+'"]')?.focus({preventScroll:true});
    if(pendingMap){const id=pendingMap;pendingMap=null;app.focusProperty(id);}
    });
  }
  page.addEventListener('cancel',e=>{if(e.target!==page)return;e.preventDefault();back();});
  page.addEventListener('click',e=>{if(e.target!==page)return;const r=page.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)back();});
  function route() {const match=location.hash.match(/^#propiedad\/([a-z0-9][a-z0-9-]{0,79})$/); const d=match&&app.items.find(item=>item.id===match[1]); if(d){ArenalMotion.cancel(page);if(current?.id!==d.id||page.hidden)show(d);}else if(!page.hidden)hide();}
  function open(id){if(current?.id===id)return;window.history.pushState({arenalDetail:true},'', '#propiedad/'+id);route();}
  function back(toOffer=true){const offer=toOffer&&current&&offerContext(current.id);if(offer&&offerSession.returnToOffer(offer))return;if(window.ArenalPreview){window.close();return;}if(window.history.state?.arenalDetail)window.history.back();else{window.history.replaceState(null,'',location.pathname+location.search);hide();}}
  function dialog(title,content,extra='') {
    openDialog?.close(); const node=document.createElement('dialog');node.className='pd-dialog '+extra;node.setAttribute('aria-label',title);
    node.innerHTML=`<div class="pd-dialog-head"><h2>${title}</h2>${iconButton('close-dialog','Cerrar','close')}</div>${content}`;
    const nativeClose=node.close.bind(node);node.close=value=>ArenalMotion.leave(node,()=>nativeClose(value));
    node.addEventListener('cancel',e=>{if(node.classList.contains('is-photo'))return;e.preventDefault();node.close();});
    root.append(node);openDialog=node;node.querySelector('[data-action="close-dialog"]').onclick=()=>node.close();
    node.addEventListener('close',()=>{node.remove();if(openDialog===node)openDialog=null;});node.addEventListener('click',e=>{if(e.target===node){const r=node.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)node.close();}});node.showModal();return node;
  }
  async function copy(text,status,field) {try{await navigator.clipboard.writeText(text);status.textContent='Copiado. Podés pegarlo donde prefirás.';}catch{field.focus();field.select();status.textContent='Seleccioná y copiá el texto con el teclado.';}}
  function contact() {
    if(current.draftPreview){dialog('Consultas del comprador','<div class="pd-dialog-body"><p>Así verá el comprador el botón de consulta. El contacto público se asignará durante la revisión del anuncio.</p><p>Esta vista previa no envía mensajes.</p></div>');return;}
    if(content.contactLinks(current)){page.querySelector('#pd-contact').scrollIntoView({block:'start',behavior:'smooth'});return;}
    const title=window.ArenalI18n?.listingText(current)||current.name;
    const inquiry=window.ArenalI18n?.language==='en'?'Hello, I am interested in '+title+' ('+money(current.price)+' '+(current.currency||'USD')+'). Is it still available? I would like more information and to arrange a visit.':'Hola, me interesa '+title+' ('+money(current.price)+' '+(current.currency||'USD')+'). ¿Sigue disponible? Me gustaría recibir más información y coordinar una visita.';
    const node=dialog('Consultá sobre la propiedad',`<div class="pd-dialog-body"><p><strong translate="no">${escape(title)}</strong><br>${money(current.price)} ${current.currency||'USD'} · ${number(current.area)} m²</p><p>${current.isDemo?'Este anuncio es de demostración y todavía no tiene un contacto asignado.':'Este anuncio todavía no tiene un contacto asignado.'} Podés preparar tu consulta; no se enviará ningún mensaje.</p><label for="pd-message">Tu consulta</label><textarea id="pd-message" rows="5">${escape(inquiry)}</textarea><button class="pd-primary" id="pd-copy-message">Copiar consulta</button><p class="pd-dialog-status" role="status"></p></div>`);
    node.querySelector('#pd-copy-message').onclick=()=>copy(node.querySelector('textarea').value,node.querySelector('[role="status"]'),node.querySelector('textarea'));
  }
  function share(){if(window.ArenalPreview){dialog('Vista previa privada','<div class="pd-dialog-body"><p>Esta vista solo abre en este navegador. Podrás compartir el enlace público cuando el anuncio esté publicado.</p></div>');return;}const node=dialog('Compartir propiedad',`<div class="pd-dialog-body"><p translate="no">${escape(window.ArenalI18n?.listingText(current)||current.name)}</p><p>Compartí este enlace para abrir la propiedad en Arenal Index.</p><label for="pd-url">Enlace de la propiedad</label><input id="pd-url" readonly value="${escape(content.publicURL(current))}"><button class="pd-primary">Copiar enlace</button><p class="pd-dialog-status" role="status"></p></div>`);node.querySelector('.pd-primary').onclick=()=>copy(content.publicURL(current),node.querySelector('[role="status"]'),node.querySelector('input'));}
  function gallery() {
    return window.ArenalPhotoTour.open({listing:current,content,dialog,icon,iconButton,escape,photoCount});
  }
  function specs(){dialog('Ficha de la propiedad',`<div class="pd-dialog-body">${content.content(current)}</div>`);}
  page.addEventListener('click',e=>{const action=e.target.closest('[data-action]')?.dataset.action;if(!action)return;if(action==='back')back();if(action==='photos')gallery();if(action==='contact'){window.ArenalAnalytics?.track('contact',current,{channel:'options'});contact();}if(action==='share'){window.ArenalAnalytics?.track('share',current);share();}if(action==='specs')specs();if(action==='save'){app.toggleSaved(current.id);syncSave();}if(action==='map'){window.ArenalAnalytics?.track('map_open',current);if(window.ArenalPreview)app.focusProperty(current.id);else{pendingMap=current.id;back(false);}}});
  page.addEventListener('keydown',e=>{if(e.key==='Escape'&&!openDialog){e.preventDefault();back();}});
  // Native scrolling and carousel swipes must never activate a listing.
  const list=document.getElementById('index-list');
  if(list)window.ArenalListingActivation(document.getElementById('results-scroll'));
  list?.addEventListener('click',e=>{
    const link=e.target.closest('.listing-title-link,.listing-total');
    if(link){if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();open(link.closest('[data-id]').dataset.id);return;}
    const track=e.target.closest('.gallery-track');
    if(track&&e.target.tagName==='IMG')open(track.closest('[data-id]').dataset.id);
  });
  window.addEventListener('arenal-language-change',()=>{
    if(!current||page.hidden)return;
    const scroll=page.querySelector('.pd-scroll').scrollTop,opened=[...page.querySelectorAll('details')].map(d=>d.open);
    render(current);page.querySelectorAll('details').forEach((d,i)=>d.open=!!opened[i]);page.querySelector('.pd-scroll').scrollTop=scroll;
    document.title=(window.ArenalI18n?.listingText(current)||current.name)+' · Arenal Index';
    if(!openDialog)page.querySelector('[data-language-toggle]')?.focus({preventScroll:true});
  });
  window.addEventListener('pageshow',event=>{if(event.persisted&&current&&!page.hidden){const scroll=page.querySelector('.pd-scroll').scrollTop;render(current);page.querySelector('.pd-scroll').scrollTop=scroll;}});
  window.addEventListener('popstate',route);window.addEventListener('hashchange',route);
  window.arenalDetail={open};route();
})();
