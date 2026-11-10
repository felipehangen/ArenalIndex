export const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const labels={ready_for_review:'Por revisar',approved:'Aprobados',changes_requested:'Esperando cambios',draft:'En preparación',published:'Publicados',all:'Todos'};
const t=text=>window.ArenalI18n?.t(text)||text;
export function selectRecords(records,{status='ready_for_review',query=''}={}){
  const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const term=normalize(query).trim();
  return records.filter(row=>(status==='all'||status==='published'&&row.publishedVersion||status==='unlisted'&&row.withdrawn||row.status===status)&&
    (!term||normalize([row.title,row.contact,row.email,row.id].join(' ')).includes(term)))
    .sort((a,b)=>(Date.parse(b.updatedAt)||0)-(Date.parse(a.updatedAt)||0)||a.id.localeCompare(b.id));
}
export function renderRows(records,{owner=false}={}){
  const locale=window.ArenalI18n?.locale||'es-CR';
  return records.map(row=>{
    const updated=row.updatedAt&&!Number.isNaN(Date.parse(row.updatedAt))?new Intl.DateTimeFormat(locale,{day:'numeric',month:'short',year:'numeric'}).format(new Date(row.updatedAt)):'—';
    const amount=row.price?new Intl.NumberFormat(locale,{style:'currency',currency:row.currency,maximumFractionDigits:0}).format(row.price):'—';
    const id=encodeURIComponent(row.id);
    const href=owner?'/newlisting/?cuenta='+id:'/admin/review/#id='+id;
    const state=owner?(row.publishedVersion?'Publicado':row.withdrawn?'Retirado':row.status==='changes_requested'?'Necesita tus cambios':row.status==='ready_for_review'?'En revisión':row.status==='approved'?'Listo para publicar':'Borrador'):(labels[row.status]||'En preparación');
    return '<article class="admin-row"><div class="admin-property"><a class="admin-record-link" translate="no" href="'+href+'">'+esc(row.title)+'</a><p translate="no">'+esc(row.contact||row.email||row.id)+'</p></div>'+
      '<div class="admin-price"><strong translate="no">'+esc(amount)+'</strong><span translate="no">'+esc(row.area?new Intl.NumberFormat(locale).format(row.area)+' m²':'—')+'</span></div>'+
      '<div class="admin-state"><span class="status-badge" data-state="'+esc(row.status)+'">'+t(state)+'</span>'+
      (owner&&row.publishedVersion&&row.status!=='approved'?'<small>'+t(row.status==='draft'?'Borrador de cambios':row.status==='ready_for_review'?'Cambios en revisión':'Necesita tus cambios')+'</small>':'')+
      (row.publishedVersion?'<a class="published-link" href="/#propiedad/'+encodeURIComponent(row.publicId)+'" target="_blank" rel="noopener">'+t('Ver publicado')+'</a>':'')+'</div>'+
      '<div class="admin-updated"><time translate="no">'+esc(updated)+'</time><small>'+t('Versión')+' '+esc(row.version)+'</small></div>'+
      '<div class="row-actions"><a class="admin-open" href="'+href+'" aria-label="'+esc(t(owner?'Abrir':'Revisar')+': '+row.title)+'">'+t(owner?'Abrir':'Revisar')+' <span aria-hidden="true">→</span></a>'+(owner&&row.publishedVersion?'<button class="text-button" data-unlist="'+esc(row.id)+'">'+t('Retirar anuncio')+'</button>':'')+'</div></article>';
  }).join('');
}
