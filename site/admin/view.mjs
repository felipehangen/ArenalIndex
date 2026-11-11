export const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const labels={ready_for_review:'En revisión',approved:'Listo para publicar',changes_requested:'Borrador',draft:'Borrador',published:'Publicado',all:'Todos'};
const t=text=>window.ArenalI18n?.t(text)||text;
export function selectRecords(records,{status='ready_for_review',query='',source='all'}={}){
  const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const term=normalize(query).trim();
  return records.filter(row=>row.status!=='deleted'&&(source==='all'||(source==='demo'?row.isDemo:!row.isDemo))&&(status==='all'||status==='published'&&row.publishedVersion||status==='unlisted'&&row.withdrawn||status==='draft'&&row.status==='changes_requested'||row.status===status)&&
    (!term||normalize([row.title,row.contact,row.email,row.id].join(' ')).includes(term)))
    .sort((a,b)=>Number(!!a.isDemo)-Number(!!b.isDemo)||(Date.parse(b.updatedAt)||0)-(Date.parse(a.updatedAt)||0)||a.id.localeCompare(b.id,undefined,{numeric:true}));
}
export const safeImage=value=>{try{const url=new URL(value,'https://arenalindex.com/');return typeof value==='string'&&value&&url.protocol==='https:'?url.href:'';}catch{return '';}};
export function renderRows(records,{owner=false}={}){
  const catalogDemo=row=>row.isDemo&&!row.isWorkspace;
  const locale=window.ArenalI18n?.locale||'es-CR';
  return records.map(row=>{
    const updated=row.updatedAt&&!Number.isNaN(Date.parse(row.updatedAt))?new Intl.DateTimeFormat(locale,{day:'numeric',month:'short',year:'numeric'}).format(new Date(row.updatedAt)):'—';
    const amount=row.price!=null?new Intl.NumberFormat(locale,{style:'currency',currency:row.currency,maximumFractionDigits:0}).format(row.price):'—';
    const publicLink=owner&&row.isDemo&&row.collectionSlug?'https://go.arenalindex.com/collection/'+encodeURIComponent(row.collectionSlug)+'/#propiedad/'+encodeURIComponent(row.publicId):'/#propiedad/'+encodeURIComponent(row.publicId);
    const id=encodeURIComponent(row.id),edit='/newlisting/?'+(owner?'cuenta':'admin')+'='+id+'&edit=1';
    const state=row.publishedVersion?'Publicado':row.withdrawn?'Retirado':labels[row.status]||'Borrador';
    const button=(action,label,extra='')=>'<button class="row-button '+extra+'" data-row-action="'+action+'" data-id="'+esc(row.id)+'">'+t(label)+'</button>';
    let actions=owner?'<a class="row-button" href="'+edit+'">'+t('Editar')+'</a>':catalogDemo(row)?button('demo-edit','Editar'):'<a class="row-button" href="'+edit+'">'+t('Editar')+'</a>';
    if(row.publishedVersion)actions+=owner?'<button class="row-button" data-unlist="'+esc(row.id)+'">'+t('Deslistar')+'</button>':button('unlist','Deslistar');
    else if(owner&&row.canRelist)actions+='<button class="row-button row-primary" data-relist="'+esc(row.id)+'">'+t('Volver a enlistar')+'</button>';
    if(!owner&&(catalogDemo(row)?!row.publishedVersion:true))actions+=button(catalogDemo(row)||row.status==='approved'?'publish':'approve',catalogDemo(row)?'Publicar':'Revisar y publicar','row-primary');
    if(!owner)actions+=button('delete','Borrar','row-danger');
    if(owner&&catalogDemo(row))actions='<span class="demo-badge">'+t('Demo de prueba')+'</span>';
    if(owner&&row.publishedVersion&&row.publicId)actions+='<a class="row-button" href="/cuenta/sheet/?id='+encodeURIComponent(row.publicId)+(row.collectionSlug?'&collection='+encodeURIComponent(row.collectionSlug):'')+'" target="_blank" rel="noopener">'+t('Ficha imprimible')+'</a>';
    if(owner&&row.publishedVersion&&row.publicId)actions+='<button class="row-button" data-offer-invite="'+esc(row.id)+'">'+t('Invitar a ofertar')+'</button>';
    const image=safeImage(row.thumbnail);
    const thumb=owner?'<div class="listing-thumbnail">'+(image?'<img src="'+esc(image)+'" width="80" height="64" loading="lazy" decoding="async" referrerpolicy="no-referrer" alt="">':'')+'<span'+(image?' hidden':'')+'>'+t('Sin foto')+'</span></div>':'';
    const demoTitle=owner?'<a class="admin-record-link" translate="no" href="'+esc(publicLink)+'" target="_blank" rel="noopener">'+esc(row.title)+'</a>':'<button class="admin-record-link" translate="no" data-row-action="demo-edit" data-id="'+esc(row.id)+'">'+esc(row.title)+'</button>';
    return '<article class="admin-row" data-record="'+esc(row.id)+'"><div class="admin-property">'+thumb+'<div class="admin-property-copy">'+(catalogDemo(row)?demoTitle:'<a class="admin-record-link" translate="no" href="'+edit+'">'+esc(row.title)+'</a>')+(row.isDemo?'<span class="demo-badge">Demo</span>':'')+(row.contact||row.email||!owner?'<p translate="no">'+esc(row.contact||row.email||row.id)+'</p>':'')+'</div></div>'+
      '<div class="admin-price"><strong translate="no">'+esc(amount)+'</strong><span translate="no">'+esc(row.area?new Intl.NumberFormat(locale).format(row.area)+' m²':'—')+'</span></div>'+
      '<div class="admin-state"><span class="status-badge" data-state="'+esc(row.publishedVersion?'published':row.status)+'">'+t(state)+'</span>'+
      (row.publishedVersion&&['draft','ready_for_review','changes_requested'].includes(row.status)?'<small>'+t(row.status==='ready_for_review'?'Cambios en revisión':'Borrador de cambios')+'</small>':'')+
      (owner&&row.withdrawn&&!row.canRelist?'<small>'+t('Requiere revisión para volver a publicar')+'</small>':'')+
      (row.publishedVersion?'<a class="published-link" href="'+esc(publicLink)+'" target="_blank" rel="noopener">'+t('Ver publicado')+'</a>':'')+'</div>'+
      '<div class="admin-updated"><time translate="no">'+esc(updated)+'</time></div><div class="row-actions">'+actions+'</div></article>';
  }).join('');
}
