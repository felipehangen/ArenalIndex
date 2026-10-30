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
  const {number, money} = window.ArenalFormat;
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
    const title = d.name;
    photos = [0,1,2].map((i)=>({src:d.images[i]||d.images[0],label:['Vista general','Terreno y vegetación','Paisaje'][i]}));
    const reference = 'AI-' + d.id.replace('lot-', '').padStart(3, '0');
    page.innerHTML = `<div class="pd-bar">${iconButton('back','Cerrar propiedad y volver a los resultados','close')}<div class="pd-brand">arenal <small>INDEX</small></div><div class="pd-bar-actions">${iconButton('share','Compartir propiedad','share')}${iconButton('save','Guardar propiedad','heart')}</div></div>
      <div class="pd-scroll"><button class="pd-hero" data-action="photos" aria-label="Ver recorrido fotográfico"><div class="pd-photo-grid">${photos.map(p=>`<img src="${escape(p.src)}" alt="${p.label}${current.isDemo?' · imagen ilustrativa IA':''}">`).join('')}</div>${d.isDemo?'<span class="pd-photo-label">Demo · Fotos ilustrativas IA</span>':''}<span class="pd-photo-count">${icon('grid')} Ver fotos</span></button>
      <div class="pd-content"><main><p class="pd-kicker">Propiedad en venta · ${reference}</p><h1 tabindex="-1">${escape(title)}</h1><p class="pd-location"><a href="#pd-location">${escape(d.place)}, La Fortuna</a> · San Carlos, Costa Rica</p>
      <div class="pd-facts"><span>${icon('land')}<strong>${number(d.area)} m²</strong> de terreno</span><span>${icon(d.house?'house':'land')}${d.house?'Incluye casa':'Solo terreno'}</span>${d.river&&d.volcano?`<span>${icon('river')}Colinda con río</span>`:''}</div>
      ${(d.water||d.electricity||d.well||d.privateResidential)?`<section class="pd-section"><h2>Características</h2><ul class="pd-service-list">${d.water?'<li>'+icon('water')+'Disponibilidad de agua</li>':''}${d.electricity?'<li>'+icon('electricity')+'Electricidad</li>':''}${d.well?'<li>'+icon('well')+'Pozo</li>':''}${d.privateResidential?'<li>'+icon('fence')+'En residencial privado</li>':''}</ul></section>`:''}
      <section class="pd-section pd-information"><h2>Detalles de la propiedad</h2>
      ${d.house?'<details class="pd-disclosure"><summary><span>La casa<small>Área construida y distribución</small></span><span class="pd-disclosure-status">Por confirmar</span></summary><p>Falta indicar el área construida, las habitaciones, los baños y el estado de la casa.</p></details>':''}
      <details class="pd-disclosure"><summary><span>Acceso y servicios<small>Entrada y detalles de las conexiones</small></span><span class="pd-disclosure-status">Por confirmar</span></summary><p>Falta detallar el tipo de acceso, el frente a calle y las condiciones de las conexiones. Las características indicadas arriba corresponden al anuncio.</p></details>
      <details class="pd-disclosure"><summary><span>Documentación<small>Plano catastrado y uso de suelo</small></span><span class="pd-disclosure-status">Por confirmar</span></summary><p>El propietario todavía no ha aportado el plano catastrado, el uso de suelo ni las condiciones de venta.</p></details>
      <button class="pd-text" data-action="specs">Ver ficha técnica ${icon('next')}</button></section>
      <section class="pd-section" id="pd-location"><h2>Ubicación</h2><div class="pd-map" aria-label="Mapa de ubicación"></div><p class="pd-muted">${d.isDemo?'Ubicación de demostración':d.approximate?'Ubicación aproximada':'Ubicación indicada en el anuncio'}. El punto no representa los linderos de la propiedad.</p><button class="pd-outline" data-action="map">Ver en el mapa de terrenos</button></section>
      <div class="pd-contact-note">Contacto del anuncio <span>Por asignar</span></div>
      ${d.isDemo?'<p class="pd-demo">Anuncio ficticio. Las imágenes son ilustrativas y no documentan esta propiedad.</p>':''}</main>
      <aside class="pd-aside"><p>Precio de venta</p><strong>${money(d.price)} <small>USD</small></strong><p>${money(d.price/d.area)} USD/m²</p><button class="pd-primary" data-action="contact">Consultar propiedad</button><p>Información y visitas · contacto por asignar</p></aside></div></div>
      <div class="pd-footer"><div><strong>${money(d.price)} <small>USD</small></strong><span class="pd-unit">${money(d.price/d.area)} USD/m²</span></div><button class="pd-primary" data-action="contact">Consultar propiedad</button></div>`;
    syncSave();
    page.querySelector('.pd-location a').onclick = e => { e.preventDefault(); page.querySelector('#pd-location').scrollIntoView({block:'start',behavior:'smooth'}); };
    const mapNode = page.querySelector('.pd-map');
    mapNode.innerHTML='<span style="display:block;padding:20px;font-size:12px">Mapa de ubicación</span>';
    // Load only when the location section enters the detail viewport.
    const observer = new IntersectionObserver(entries => { if(!entries.some(e=>e.isIntersecting)) return; observer.disconnect(); if(!window.maplibregl || page.hidden || current !== d) return; mapNode.replaceChildren(); detailMap = new maplibregl.Map({container:mapNode,center:d.coordinates,zoom:13,interactive:false,attributionControl:false,style:{version:8,sources:{osm:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,maxzoom:19,attribution:'© OpenStreetMap contributors'}},layers:[{id:'osm',type:'raster',source:'osm'}]}}); detailMap.addControl(new maplibregl.AttributionControl({compact:false}));const marker=document.createElement('div');marker.className='pd-map-pin';marker.innerHTML=icon(d.house?'house':'land');new maplibregl.Marker({element:marker}).setLngLat(d.coordinates).addTo(detailMap); },{root:page.querySelector('.pd-scroll')});
    observer.observe(mapNode); page._observer?.disconnect(); page._observer=observer;
  }
  function show(d) {
    ArenalMotion.cancel(page);
    if(page.hidden) returnFocus=document.activeElement;
    home.inert=true;home.setAttribute('aria-hidden','true');
    page.hidden=false;render(d);if(!page.open)page.showModal(); document.title=`${d.name} · Arenal Index`;
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
  function back(){if(window.history.state?.arenalDetail)window.history.back();else{window.history.replaceState(null,'',location.pathname+location.search);hide();}}
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
    const node=dialog('Consultá sobre la propiedad',`<div class="pd-dialog-body"><p><strong>${escape(current.name)}</strong><br>${money(current.price)} USD · ${number(current.area)} m²</p><p>${current.isDemo?'Este anuncio es de demostración y todavía no tiene un contacto asignado.':'Este anuncio todavía no tiene un contacto asignado.'} Podés preparar tu consulta; no se enviará ningún mensaje.</p><label for="pd-message">Tu consulta</label><textarea id="pd-message" rows="5">${escape('Hola, me interesa '+current.name+' ('+money(current.price)+' USD). ¿Sigue disponible? Me gustaría recibir más información y coordinar una visita.')}</textarea><button class="pd-primary" id="pd-copy-message">Copiar consulta</button><p class="pd-dialog-status" role="status"></p></div>`);
    node.querySelector('#pd-copy-message').onclick=()=>copy(node.querySelector('textarea').value,node.querySelector('[role="status"]'),node.querySelector('textarea'));
  }
  function share(){const node=dialog('Compartir propiedad',`<div class="pd-dialog-body"><p>${escape(current.name)}</p><p>Compartí este enlace para abrir la propiedad en Arenal Index.</p><label for="pd-url">Enlace de la propiedad</label><input id="pd-url" readonly value="${escape(location.href)}"><button class="pd-primary">Copiar enlace</button><p class="pd-dialog-status" role="status"></p></div>`);node.querySelector('.pd-primary').onclick=()=>copy(location.href,node.querySelector('[role="status"]'),node.querySelector('input'));}
  function gallery() {
    // Reuse the illustrative assets to preview sections containing multiple photos.
    const groups = current.isDemo ? [
      {label:photos[0].label, images:[photos[0],photos[1],photos[2]]},
      {label:photos[1].label, images:[photos[1],photos[0]]},
      {label:photos[2].label, images:[photos[2],photos[1]]}
    ] : [{label:'Fotografías de la propiedad',images:current.images.map((src,i)=>({src,label:'Foto '+(i+1)}))}];
    let offset=0;
    groups.forEach(group=>{group.start=offset;offset+=group.images.length;});
    const tourPhotos=groups.flatMap(group=>group.images.map((photo,i)=>({...photo,caption:group.label+' · Foto '+(i+1)+' de '+group.images.length})));
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const node = dialog('Recorrido fotográfico', `
      <div class="pd-tour-overview">
        <nav class="pd-tour-nav" aria-label="Bloques de fotos">${groups.map((p,i)=>`<button class="pd-tour-link" data-block="${i}" aria-controls="pd-photo-block-${i}" ${i===0?'aria-current="true"':''}><img src="${escape(p.images[0].src)}" alt=""><span>${p.label}<small>${p.images.length} fotos</small></span></button>`).join('')}</nav>
        <div class="pd-tour-scroll" tabindex="0" aria-label="Recorrido por las fotos">
          <p class="pd-tour-note">${tourPhotos.length} fotos${current.isDemo?' de muestra · imágenes IA reutilizadas':''}</p>
          ${groups.map((group,i)=>`<section class="pd-tour-block" id="pd-photo-block-${i}" aria-labelledby="pd-photo-title-${i}"><div class="pd-tour-heading"><h3 id="pd-photo-title-${i}">${group.label}</h3><span>${group.images.length} fotos</span></div><div class="pd-tour-grid ${group.images.length%2?'has-lead':''}">${group.images.map((p,j)=>`<button class="pd-tour-photo" data-photo="${group.start+j}" aria-label="Ampliar: ${group.label}, foto ${j+1}"><img src="${escape(p.src)}" alt="${p.label}${current.isDemo?' · imagen ilustrativa IA':''}" loading="lazy"><span>${icon('grid')}<span class="pd-enlarge-label"> Ampliar</span></span></button>`).join('')}</div></section>`).join('')}
          <p class="pd-tour-end">Fin del recorrido</p>
        </div>
      </div>
      <div class="pd-photo-view" hidden>
        <div class="pd-photo-toolbar"><button class="pd-tour-return">${icon('back')} Volver al recorrido</button><span class="pd-photo-position" role="status" aria-live="polite"></span></div>
        <div class="pd-photo-track" tabindex="0" aria-label="Fotos ampliadas. Deslizá o usá las flechas">${tourPhotos.map(p=>`<div class="pd-photo-slide"><img src="${escape(p.src)}" alt="${p.label}${current.isDemo?' · imagen ilustrativa IA':''}" draggable="false"></div>`).join('')}</div>
        <div class="pd-photo-controls">${iconButton('previous','Foto anterior','back')}<span class="pd-photo-caption"></span>${iconButton('next','Foto siguiente','next')}</div>
      </div>`, 'pd-tour');
    const overview=node.querySelector('.pd-tour-overview'), scroller=node.querySelector('.pd-tour-scroll');
    const blocks=[...node.querySelectorAll('.pd-tour-block')], links=[...node.querySelectorAll('.pd-tour-link')];
    const viewer=node.querySelector('.pd-photo-view'),track=node.querySelector('.pd-photo-track');
    const previous=node.querySelector('[data-action="previous"]'),next=node.querySelector('[data-action="next"]');
    let photoIndex=0, photoTrigger=null, scrollFrame=0;
    function markBlock(index) {links.forEach((link,i)=>{if(i===index)link.setAttribute('aria-current','true');else link.removeAttribute('aria-current');}); }
    function jump(index) { markBlock(index);const top=blocks[index].getBoundingClientRect().top-scroller.getBoundingClientRect().top+scroller.scrollTop-20;scroller.scrollTo({top,behavior:reduced?'auto':'smooth'}); }
    links.forEach((link,i)=>link.onclick=()=>jump(i));
    scroller.addEventListener('scroll',()=>{if(scrollFrame)return;scrollFrame=requestAnimationFrame(()=>{scrollFrame=0;const threshold=scroller.getBoundingClientRect().top+scroller.clientHeight*.35;let index=0;blocks.forEach((block,i)=>{if(block.getBoundingClientRect().top<=threshold)index=i;});markBlock(index);});},{passive:true});
    function updatePhoto() {Array.from(track.children).forEach((slide,i)=>slide.setAttribute('aria-hidden',String(i!==photoIndex)));node.querySelector('.pd-photo-position').textContent=(photoIndex+1)+' / '+tourPhotos.length;node.querySelector('.pd-photo-caption').textContent=tourPhotos[photoIndex].caption;previous.disabled=photoIndex===0;next.disabled=photoIndex===tourPhotos.length-1;}
    function move(delta) {const target=Math.max(0,Math.min(tourPhotos.length-1,photoIndex+delta));track.scrollTo({left:target*track.clientWidth,behavior:reduced?'auto':'smooth'});}
    function expand(index,trigger) {photoTrigger=trigger;photoIndex=index;overview.hidden=true;viewer.hidden=false;node.classList.add('is-photo');updatePhoto();track.scrollTo({left:index*track.clientWidth,behavior:'instant'});node.querySelector('.pd-tour-return').focus({preventScroll:true});}
    function returnToTour() {ArenalMotion.leave(viewer,()=>{viewer.hidden=true;overview.hidden=false;node.classList.remove('is-photo');photoTrigger?.focus({preventScroll:true});});}
    node.querySelectorAll('[data-photo]').forEach(button=>button.onclick=()=>expand(Number(button.dataset.photo),button));
    node.querySelector('.pd-tour-return').onclick=returnToTour;
    previous.onclick=()=>move(-1);next.onclick=()=>move(1);
    track.addEventListener('scroll',()=>{if(viewer.hidden||!track.clientWidth)return;photoIndex=Math.max(0,Math.min(tourPhotos.length-1,Math.round(track.scrollLeft/track.clientWidth)));updatePhoto();},{passive:true});
    node.addEventListener('keydown',e=>{if(e.altKey||e.metaKey||e.ctrlKey)return;if(!viewer.hidden&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();move(e.key==='ArrowRight'?1:-1);}else if(viewer.hidden&&e.target.closest('.pd-tour-nav')&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const focused=links.indexOf(e.target.closest('.pd-tour-link'));const target=e.key==='Home'?0:e.key==='End'?links.length-1:Math.max(0,Math.min(links.length-1,focused+(e.key==='ArrowRight'?1:-1)));links[target].focus();jump(target);}});
    node.addEventListener('cancel',e=>{if(!viewer.hidden){e.preventDefault();returnToTour();}});
    const resize=new ResizeObserver(()=>{if(!viewer.hidden)track.scrollTo({left:photoIndex*track.clientWidth,behavior:'instant'});});resize.observe(track);
    node.addEventListener('close',()=>{resize.disconnect();cancelAnimationFrame(scrollFrame);},{once:true});
  }
  function specs(){const d=current;dialog('Ficha de la propiedad',`<div class="pd-dialog-body"><dl class="pd-attributes">${attr('Referencia',escape(d.name))}${attr('Precio de venta',money(d.price)+' USD')}${attr('Área del terreno',number(d.area)+' m²')}${attr('Precio por m²',money(d.price/d.area)+' USD')}${attr('Tipo',d.house?'Terreno con casa':'Solo terreno')}${attr('Ubicación',escape(d.place))}${attr('Vista al volcán',d.volcano?'Indicada en el anuncio':'No indicada')}${attr('Colinda con río',d.river?'Indicado en el anuncio':'No indicado')}${attr('Frente / fondo','Por confirmar')}${attr('Topografía','Por confirmar')}${attr('Disponibilidad de agua',d.water?'Indicada':'No indicada')}${attr('Electricidad',d.electricity?'Indicada':'No indicada')}${attr('Pozo',d.well?'Indicado':'No indicado')}${attr('Residencial privado',d.privateResidential?'Indicado':'No indicado')}${attr('Acceso','Por confirmar')}${attr('Plano / uso de suelo','Por confirmar')}</dl><p style="margin-top:18px">${d.isDemo?'Datos de demostración. ':''}La información pendiente se completará con el propietario.</p></div>`);}
  page.addEventListener('click',e=>{const action=e.target.closest('[data-action]')?.dataset.action;if(!action)return;if(action==='back')back();if(action==='photos')gallery();if(action==='contact')contact();if(action==='share')share();if(action==='specs')specs();if(action==='save'){app.toggleSaved(current.id);syncSave();}if(action==='map'){pendingMap=current.id;back();}});
  page.addEventListener('keydown',e=>{if(e.key==='Escape'&&!openDialog){e.preventDefault();back();}});
  // Preserve horizontal card swipes; a deliberate photo tap opens the listing.
  const list=document.getElementById('index-list');let pointer=null;
  list.addEventListener('pointerdown',e=>{pointer={x:e.clientX,y:e.clientY,scroll:e.target.closest('.gallery-track')?.scrollLeft};},{capture:true,passive:true});
  list.addEventListener('click',e=>{const link=e.target.closest('.listing-title-link,.listing-total');if(link){if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();open(link.closest('[data-id]').dataset.id);return;}const track=e.target.closest('.gallery-track');if(track&&e.target.tagName==='IMG'&&pointer&&Math.abs(e.clientX-pointer.x)<8&&Math.abs(e.clientY-pointer.y)<8&&Math.abs(track.scrollLeft-pointer.scroll)<8){open(track.closest('[data-id]').dataset.id);}});
  window.addEventListener('popstate',route);window.addEventListener('hashchange',route);
  window.arenalDetail={open};route();
})();
