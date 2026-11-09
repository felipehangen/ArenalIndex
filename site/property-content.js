/* Shared, escaped presentation for published listings and editorial previews. */
(() => {
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=value=>new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(value);
  const price=(value,currency='USD')=>(currency==='CRC'?'₡':'$')+number(value);
  const rowsHTML=rows=>'<dl class="pd-detail-rows">'+rows.map(row=>'<div><dt>'+esc(row.label)+'</dt><dd>'+esc(row.value)+(row.source?'<small>'+esc(row.source)+'</small>':'')+'</dd></div>').join('')+'</dl>';
  function groups(d){
    if(d.details?.photoGroups?.length)return d.details.photoGroups.map(group=>({label:group.title,images:group.photos.map(p=>({src:p.src,label:p.caption,caption:p.caption}))})).filter(g=>g.images.length);
    return [{label:d.isDemo?'Imágenes de muestra':'Fotografías de la propiedad',images:[...new Set(d.images)].filter(src=>!src.includes('no-photo.svg')).map((src,i)=>({src,label:(d.isDemo?'Imagen ilustrativa':'Foto')+' '+(i+1)}))}].filter(g=>g.images.length);
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
  function content(d){
    const detail=d.details,buildings=detail?.buildings||[],all=sections(d),conditions=detail?.conditions||[];
    const buildingCount=detail?buildings.length:d.house?null:0;
    const facts=[{value:number(d.area)+' m²',label:detail?.areaSource||'Área indicada'},
      {value:buildingCount===null?'Con casa':buildingCount===0?'Solo terreno':buildingCount+' '+(buildingCount===1?'construcción':'construcciones'),label:'Incluido en la venta'},
      {value:price(d.price/d.area,d.currency),label:(d.currency||'USD')+'/m² de terreno'}];
    let html='<div class="pd-essentials">'+facts.map(f=>'<div><strong>'+esc(f.value)+'</strong><span>'+esc(f.label)+'</span></div>').join('')+'</div>';
    if(d.description)html+='<section class="pd-section pd-about"><h2>Un lugar para tu próximo proyecto</h2><p>'+esc(d.description)+'</p></section>';
    html+='<section class="pd-section pd-information"><div class="pd-section-heading"><h2>Conocé la propiedad</h2><p>Los detalles que ayudan a decidir.</p></div>'+all.filter(s=>s.rows.length||s.note).map(section=>'<details class="pd-disclosure"><summary><span><strong>'+esc(section.title)+'</strong><small>'+esc(summary(section))+'</small></span></summary><div class="pd-disclosure-body">'+(section.rows.length?rowsHTML(section.rows):'<p>'+esc(section.note||'Información por confirmar.')+'</p>')+(section.id==='land'&&detail?.declaredArea!==detail?.documentedArea?'<p class="pd-muted">El vendedor declaró '+number(detail.declaredArea)+' m². Los importes por m² usan el área del plano revisado.</p>':'')+'</div></details>').join('')+'</section>';
    if(buildings.length)html+='<section class="pd-section"><div class="pd-section-heading"><h2>Las construcciones</h2><p>Cada espacio, con sus propios detalles.</p></div><div class="pd-buildings">'+buildings.map((b,i)=>'<details class="pd-building"><summary><span class="pd-building-number">'+String(i+1).padStart(2,'0')+'</span><span><strong>'+esc(b.name)+'</strong><small>'+esc(b.rows.filter(r=>['Tipo de construcción','Área construida (m²)'].includes(r.label)).map(r=>r.value).join(' · '))+'</small></span></summary>'+rowsHTML(b.rows)+'</details>').join('')+'</div></section>';
    else if(d.house)html+='<section class="pd-section"><h2>La construcción</h2><p>Este anuncio indica una casa. Su área, distribución y estado están por confirmar.</p></section>';
    if(conditions.length)html+='<section class="pd-section"><div class="pd-conditions"><h2>Para tener en cuenta</h2><ul>'+conditions.map(c=>'<li>'+esc(c)+'</li>').join('')+'</ul></div></section>';
    html+='<p class="pd-source-note">'+(d.isDemo?'Anuncio de demostración · imágenes ilustrativas.':detail?'La información se atribuye al vendedor salvo donde se indique otra fuente. La revisión editorial no sustituye una verificación técnica o legal.':'Información del anuncio. Confirmá los detalles con el responsable de la venta.')+'</p>';
    return html;
  }
  window.ArenalListing=Object.freeze({esc,price,number,rowsHTML,groups,sections,content});
})();
