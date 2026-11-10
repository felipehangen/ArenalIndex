/* Shared, escaped presentation for published listings and editorial previews. */
(() => {
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=value=>new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(value);
  const price=(value,currency='USD')=>value===null||!Number.isFinite(value)||!['USD','CRC'].includes(currency)?'Por definir':(currency==='CRC'?'₡':'$')+number(value);
  const publicURL=d=>d.shareUrl||'https://arenalindex.com/#propiedad/'+encodeURIComponent(d.id);
  const rowsHTML=(rows,literal=true)=>'<dl class="pd-detail-rows">'+rows.map(row=>'<div><dt>'+esc(row.label)+'</dt><dd><span'+(row.literal&&literal?' translate="no"':'')+'>'+esc(row.value)+'</span>'+(row.source?'<small>'+esc(row.source)+'</small>':'')+'</dd></div>').join('')+'</dl>';
  function highlights(d){
    const facts=d.details?.sections?.flatMap(s=>s.rows)||[],value=label=>facts.find(r=>r.label===label)?.value;
    const items=[],add=(icon,label,description=label)=>items.push({icon,label,description});
    const count=d.details?.buildings?.length;
    if(count)add('house',count+' constr.',count+' '+(count===1?'construcción':'construcciones'));
    else if(d.house&&!d.details)add('house','Construcción');
    if(d.privateResidential)add('fence','Condominio');
    if(d.volcano)add('mountain','Vista al volcán');
    const waterbody=value('Río, quebrada o naciente');
    if(['Dentro de la propiedad','Colindante'].includes(waterbody))add('waves','Agua natural','Río, quebrada o naciente: '+waterbody.toLowerCase());
    const water=value('Agua de red');
    if(water==='Conexión activa')add('droplet','Agua activa','Agua de red con conexión activa, según el anuncio');
    else if(water==='Carta de disponibilidad')add('droplet','Carta de agua','Carta de disponibilidad de agua; conexión pendiente');
    if(value('Electricidad')==='Medidor activo')add('zap','Luz activa','Electricidad con medidor activo, según el anuncio');
    if(d.well)add('droplets','Pozo','Pozo indicado; derechos de uso y potabilidad por confirmar');
    return items.slice(0,3);
  }
  function contactLinks(d){
    if(d.draftPreview||!d.details?.contact)return null;
    const c=d.details.contact,title=window.ArenalI18n?.listingText(d)||d.name,url=publicURL(d);
    const message=(window.ArenalI18n?.language==='en'?(d.isDemo?'Hello, I am asking about the demo listing ':'Hello, I am interested in '):(d.isDemo?'Hola, estoy consultando el anuncio de demostración ':'Hola, me interesa '))+title+' ('+price(d.price,d.currency)+' '+d.currency+'). '+url;
    return {name:c.name||'Contacto del anuncio',
      whatsapp:c.whatsapp?'https://wa.me/'+c.whatsapp+'?text='+encodeURIComponent(message):'',
      phone:c.phone?'tel:+'+c.phone:'',
      phoneLabel:c.phone?(/^506\d{8}$/.test(c.phone)?'+506 '+c.phone.slice(3,7)+' '+c.phone.slice(7):'+'+c.phone):'',
      email:c.email?'mailto:'+encodeURIComponent(c.email)+'?subject='+encodeURIComponent((window.ArenalI18n?.language==='en'?'Inquiry: ':'Consulta: ')+title)+'&body='+encodeURIComponent(message):'',emailLabel:c.email||''};
  }
  function contactContent(d){
    const c=contactLinks(d);if(!c)return '';
    return '<section class="pd-section pd-contact" id="pd-contact"><h2>Contacto</h2><p class="pd-contact-name"'+(d.details.contact.name?' translate="no"':'')+'>'+esc(c.name)+'</p>'+(d.isDemo?'<p class="pd-muted">Anuncio de demostración. Las consultas llegan a este contacto.</p>':'')+
      (c.whatsapp?'<a class="pd-primary" href="'+esc(c.whatsapp)+'" target="_blank" rel="noopener noreferrer">Consultar por WhatsApp</a>':'')+
      '<div class="pd-contact-options">'+(c.phone?'<a href="'+esc(c.phone)+'">Llamar · '+esc(c.phoneLabel)+'</a>':'')+(c.email?'<a href="'+esc(c.email)+'">'+esc(c.emailLabel)+'</a>':'')+'</div></section>';
  }
  function groups(d){
    const caption=value=>window.ArenalI18n?.photoText(value,d)||value;
    if(d.details?.photoGroups?.length)return d.details.photoGroups.map(group=>({label:caption(group.title),images:group.photos.map(p=>({src:p.src,label:caption(p.caption),caption:caption(p.caption)}))})).filter(g=>g.images.length);
    return [{label:caption(d.isDemo?'Imágenes de muestra':'Fotografías de la propiedad'),images:[...new Set(d.images)].filter(src=>!src.includes('no-photo.svg')).map((src,i)=>({src,label:d.isDemo?caption('Imagen ilustrativa '+(i+1)):caption('Foto')+' '+(i+1)}))}].filter(g=>g.images.length);
  }
  function photoAlt(photo,d){
    const label=photo.label||'';
    return label+(d.isDemo&&!/\b(imagen ilustrativa|illustrative image)\b/i.test(label)?' · '+(window.ArenalI18n?.t('imagen ilustrativa')||'imagen ilustrativa'):'');
  }
  function sections(d){
    if(d.details?.schemaVersion===1)return d.details.sections||[];
    const row=(label,value)=>({label,value,source:'Información del anuncio'});
    return [
      {id:'land',title:'El terreno',rows:[row('Área indicada',number(d.area)+' m²'),...(d.volcano?[row('Vista al volcán','Indicada en el anuncio')]:[]),...(d.river?[row('Colinda con río','Indicado en el anuncio')]:[])]},
      {id:'services',title:'Servicios e infraestructura',rows:[...(d.water?[row('Agua de red','Disponibilidad indicada; conexión por confirmar')]:[]),...(d.electricity?[row('Electricidad','Indicada; estado de conexión por confirmar')]:[]),...(d.well?[row('Pozo','Indicado; potabilidad y derechos por confirmar')]:[])]},
      {id:'access',title:'Llegada y acceso',rows:[],note:'Los detalles del acceso todavía no se han incorporado a este anuncio.'},
      {id:'community',title:'Residencial o condominio',rows:[],note:'El régimen de la propiedad está por confirmar.'},
      {id:'documents',title:'Información documental',rows:[],note:'El estado de la documentación todavía no se ha incorporado a este anuncio.'}
    ];
  }
  function summary(section){
    const important={land:['Topografía','Uso actual'],access:['Vía de llegada','Hasta la entrada'],services:['Agua de red','Electricidad'],community:['Tipo de desarrollo'],documents:['Área del plano'],sale:['Precio negociable','Financiamiento del vendedor']};
    const rows=section.rows.filter(row=>(important[section.id]||[]).includes(row.label));
    return rows.length?rows.map(row=>row.label+': '+row.value).join(' · '):section.rows.length?'Ver la información disponible':'Por confirmar';
  }
  function content(d,display=null){
    const detail=d.details,buildings=detail?.buildings||[],all=sections(d),conditions=detail?.conditions||[];
    const buildingCount=d.draftPreview&&!d.buildingsKnown?null:detail?buildings.length:d.house?null:0;
    const facts=[{value:d.area>0?number(d.area)+' m²':'Por completar',label:detail?.areaSource||'Área indicada'},
      {value:buildingCount===null?(d.draftPreview?'Por confirmar':'Con casa'):buildingCount===0?'Solo terreno':buildingCount+' '+(buildingCount===1?'construcción':'construcciones'),label:'Incluido en la venta'},
      {value:price(display?display.unit:d.price!==null&&d.area>0?d.price/d.area:null,display?display.currency:d.currency),label:((display?display.currency:d.currency)?(display?display.currency:d.currency)+'/m²':'Precio por m²')+' de terreno'}];
    let html='<div class="pd-essentials">'+facts.map(f=>'<div><strong>'+esc(f.value)+'</strong><span>'+esc(f.label)+'</span></div>').join('')+'</div>';
    const description=window.ArenalI18n?.listingText(d,'description')||d.description;
    if(description)html+='<section class="pd-section pd-about"><h2>Un lugar para tu próximo proyecto</h2><p translate="no">'+esc(description)+'</p></section>';
    html+='<section class="pd-section pd-information"><div class="pd-section-heading"><h2>Conocé la propiedad</h2><p>Los detalles que ayudan a decidir.</p></div>'+all.filter(s=>s.rows.length||s.note).map(section=>'<details class="pd-disclosure"><summary><span><strong>'+esc(section.title)+'</strong><small>'+esc(summary(section))+'</small></span></summary><div class="pd-disclosure-body">'+(section.rows.length?rowsHTML(section.rows,!d.isDemo):'<p>'+esc(section.note||'Información por confirmar.')+'</p>')+(section.id==='land'&&detail?.declaredArea>0&&detail?.documentedArea>0&&detail.declaredArea!==detail.documentedArea?'<p class="pd-muted">El vendedor declaró '+number(detail.declaredArea)+' m². Los importes por m² usan '+(d.draftPreview?'el área indicada del plano, pendiente de revisión.':'el área del plano revisado.')+'</p>':'')+'</div></details>').join('')+'</section>';
    if(buildings.length)html+='<section class="pd-section"><div class="pd-section-heading"><h2>Las construcciones</h2><p>Cada espacio, con sus propios detalles.</p></div><div class="pd-buildings">'+buildings.map((b,i)=>'<details class="pd-building"><summary><span class="pd-building-number">'+String(i+1).padStart(2,'0')+'</span><span><strong'+(!d.isDemo?' translate="no"':'')+'>'+esc(b.name)+'</strong><small>'+esc(b.rows.filter(r=>['Tipo de construcción','Área construida (m²)'].includes(r.label)).map(r=>r.value).join(' · '))+'</small></span></summary>'+rowsHTML(b.rows,!d.isDemo)+'</details>').join('')+'</div></section>';
    else if(d.house)html+='<section class="pd-section"><h2>La construcción</h2><p>Este anuncio indica una casa. Su área, distribución y estado están por confirmar.</p></section>';
    if(conditions.length)html+='<section class="pd-section"><div class="pd-conditions"><h2>Para tener en cuenta</h2><ul>'+conditions.map(c=>'<li'+(!d.isDemo?' translate="no"':'')+'>'+esc(c)+'</li>').join('')+'</ul></div></section>';
    html+='<p class="pd-source-note">'+(d.draftPreview?'Vista previa privada de tu borrador. La información, el título y la localidad están pendientes de revisión; el anuncio todavía no se ha publicado.':d.isDemo?'Anuncio de demostración · imágenes ilustrativas.':detail?'La información se atribuye al vendedor salvo donde se indique otra fuente. La revisión editorial no sustituye una verificación técnica o legal.':'Información del anuncio. Confirmá los detalles con el responsable de la venta.')+'</p>';
    return html;
  }
  window.ArenalListing=Object.freeze({esc,price,number,publicURL,rowsHTML,groups,photoAlt,sections,content,highlights,contactLinks,contactContent});
})();
