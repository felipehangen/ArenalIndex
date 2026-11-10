export const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const labels={ready_for_review:'Por revisar',approved:'Aprobados',changes_requested:'Cambios solicitados',draft:'En preparación',published:'Publicados',all:'Todos'};
const t=text=>window.ArenalI18n?.t(text)||text;
export function selectRecords(records,{status='ready_for_review',query=''}={}){
  const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const term=normalize(query).trim();
  return records.filter(row=>(status==='all'||status==='published'&&row.publishedVersion||row.status===status)&&
    (!term||normalize([row.title,row.contact,row.email,row.id].join(' ')).includes(term)))
    .sort((a,b)=>(Date.parse(b.updatedAt)||0)-(Date.parse(a.updatedAt)||0)||a.id.localeCompare(b.id));
}
export function renderRows(records){
  const locale=window.ArenalI18n?.locale||'es-CR';
  return records.map(row=>{
    const updated=row.updatedAt&&!Number.isNaN(Date.parse(row.updatedAt))?new Intl.DateTimeFormat(locale,{day:'numeric',month:'short',year:'numeric'}).format(new Date(row.updatedAt)):'—';
    const amount=row.price?new Intl.NumberFormat(locale,{style:'currency',currency:row.currency,maximumFractionDigits:0}).format(row.price):'—';
    const id=encodeURIComponent(row.id);
    return '<article class="admin-row"><div class="admin-property"><a class="admin-record-link" translate="no" href="/admin/review/#id='+id+'">'+esc(row.title)+'</a><p translate="no">'+esc(row.contact||row.email||row.id)+'</p></div>'+ 
      '<div class="admin-price"><strong translate="no">'+esc(amount)+'</strong><span translate="no">'+esc(row.area?new Intl.NumberFormat(locale).format(row.area)+' m²':'—')+'</span></div>'+ 
      '<div class="admin-state"><span class="status-badge" data-state="'+esc(row.status)+'">'+t(labels[row.status]||'En preparación')+'</span>'+ 
      (row.publishedVersion?'<a class="published-link" href="/#propiedad/'+encodeURIComponent(row.publicId)+'" target="_blank" rel="noopener">'+t('Ver publicado')+'</a>':'')+'</div>'+ 
      '<div class="admin-updated"><time translate="no">'+esc(updated)+'</time><small>'+t('Versión')+' '+esc(row.version)+'</small></div>'+ 
      '<a class="admin-open" href="/admin/review/#id='+id+'" aria-label="'+esc(t('Revisar')+': '+row.title)+'">'+t('Revisar')+' <span aria-hidden="true">→</span></a></article>';
  }).join('');
}
