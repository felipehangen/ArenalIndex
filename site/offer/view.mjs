import {choiceLabel,notice,simpleNotice} from './model.mjs?v=3';
export const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const money=(v,c,l='es')=>new Intl.NumberFormat(l==='en'?'en-US':'es-CR',{style:'currency',currencyDisplay:'narrowSymbol',currency:['USD','CRC'].includes(c)?c:'USD',maximumFractionDigits:2}).format(Number(v)||0)+' '+c;
export const date=(v,l='es')=>new Intl.DateTimeFormat(l==='en'?'en-US':'es-CR',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Costa_Rica'}).format(new Date(v));
// The property stays visible while the buyer writes and reviews their proposal.
export function propertyPhotos(p){return [...new Set([p.image,...(Array.isArray(p.images)?p.images:[])].filter(Boolean).map(src=>{try{const u=new URL(src,'https://arenalindex.com');return u.protocol==='https:'?u.href:'';}catch{return '';}}).filter(Boolean))];}
export function propertyStage(p,language='es',{gallery=false,listing=false,showPrice=true}={}){
  const t=(es,en)=>language==='en'?en:es;
  const image=propertyPhotos(p)[0]||'';
  return '<aside class="property-stage" aria-label="'+t('La propiedad','The property')+'"><div class="property-scene">'+
    '<div class="property-contours" aria-hidden="true"><span></span><span></span><span></span></div>'+
    (image?'<img src="'+esc(image)+'" alt="" fetchpriority="high" referrerpolicy="no-referrer">':'')+
    '<div class="property-caption"><p>'+esc(p.place)+' · '+esc(new Intl.NumberFormat(language).format(p.area))+' m²</p><h2>'+esc(p.titles?.[language]||p.name)+'</h2></div>'+(gallery&&image?'<button type="button" class="property-view-photos" data-photos>'+t('Ver fotos','View photos')+' ↗</button>':'')+'</div>'+
    (showPrice?'<div class="property-price"><span>'+t('Precio solicitado','Asking price')+'</span><strong>'+esc(money(p.price,p.currency,language))+'</strong></div>':'')+(listing&&p.id?'<a class="property-full-link" data-full-listing href="/#propiedad/'+esc(p.id)+'">'+t('Ver anuncio completo','View full listing')+' ↗</a>':'')+
    (p.isDemo?'<p class="demo-notice">'+t('Propiedad de prueba · Usá datos ficticios.','Demo property · Use test information.')+'</p>':'')+'</aside>';
}
export function proposalSummary({property,broker,offer,version,language='es',editable=false}){
  const t=(es,en)=>language==='en'?en:es,d=offer,field=(label,value)=>'<div><dt>'+label+'</dt><dd>'+esc(value)+'</dd></div>';
  const block=(step,title,contents)=>'<section class="proposal-section"><div class="proposal-section-heading"><h3>'+title+'</h3>'+(editable?'<button type="button" class="text-button" data-edit-step="'+step+'">'+t('Editar','Edit')+'</button>':'')+'</div><dl>'+contents+'</dl></section>';
  if(d.schema===2)return simpleSummary({property,broker,offer:d,version,language});
  const conditions=d.conditions.map(v=>choiceLabel('conditions',v,language));if(d.otherConditions)conditions.push(d.otherConditions);
  return '<article class="proposal-paper"><div class="proposal-letterhead"><span class="eyebrow">ARENAL INDEX · '+t('PROPUESTA DE COMPRA','PURCHASE PROPOSAL')+'</span>'+(version?'<span>'+t('Versión','Version')+' '+version.revision+'</span>':'')+'</div><h2>'+esc(property.titles?.[language]||property.name)+'</h2><p class="muted">'+t('Para','To')+' '+esc(broker)+' · '+esc(property.place)+'</p>'+(property.isDemo?'<p class="demo-notice">'+t('PROPUESTA DE PRUEBA · Propiedad ficticia','TEST PROPOSAL · Fictional property')+'</p>':'')+
    block(0,t('La oferta','The offer'),field(t('Monto propuesto','Proposed amount'),money(d.amount,d.currency,language))+field(t('Precio solicitado al crear la invitación','Asking price when invited'),money(property.price,property.currency,language)))+
    block(1,t('Plan de compra','Purchase plan'),field(t('Forma de pago','Funding'),choiceLabel('funding',d.funding,language))+field(t('Depósito propuesto','Proposed deposit'),d.depositMode==='amount'?money(d.deposit,d.currency,language):t('Por conversar con el corredor','To discuss with the broker'))+field(t('Cierre preferido','Preferred closing'),choiceLabel('closing',d.closing,language)))+
    block(2,t('Condiciones y tiempos','Conditions and timing'),field(t('Condiciones propuestas','Proposed conditions'),conditions.join('\n')||t('No se indicaron condiciones adicionales.','No additional conditions specified.'))+field(t('Vigencia propuesta','Proposed validity'),version?date(version.validUntil,language)+' (Costa Rica)':choiceLabel('validity',d.validity,language)+t(' desde el envío',' from submission'))+(d.message?field(t('Mensaje para el propietario','Message for the owner'),d.message):''))+
    block(3,t('Datos del comprador','Buyer details'),field(t('Nombre','Name'),d.name)+field(t('Correo','Email'),d.email)+(d.phone?field(t('Teléfono','Phone'),d.phone):''))+
    '<footer class="proposal-footnote">'+(version?'<p>'+t('Enviada','Submitted')+' '+esc(date(version.submittedAt,language))+' (Costa Rica)</p>':'')+'<p>'+esc(version?.notice||notice[language])+'</p></footer></article>';
}

export function simpleSummary({property,broker,offer:d,version,language='es'}){
  const t=(es,en)=>language==='en'?en:es;
  const printHeading='<header class="proposal-document-header"><span class="proposal-document-brand">arenal <b>INDEX</b></span><span>'+t('Copia de la oferta','Offer copy')+'</span></header><p class="proposal-document-title">'+t('Oferta de compra','Purchase offer')+'</p>';
  return '<article class="proposal-paper simple-paper">'+printHeading+'<p class="eyebrow">ARENAL INDEX · '+t('OFERTA','OFFER')+'</p><h2>'+esc(property.titles?.[language]||property.name)+'</h2><p class="muted">'+esc(property.place)+(property.isDemo?' · '+t('Propiedad de prueba','Test property'):'')+'</p><p class="simple-offer-value">'+esc(money(d.amount,d.currency,language))+'</p><dl class="simple-offer-details"><div><dt>'+t('De','From')+'</dt><dd>'+esc(d.name)+'<br>'+esc(d.contact)+(d.replyMethod?'<small class="proposal-reply-method">'+(d.replyMethod==='whatsapp'?'WhatsApp':t('Correo electrónico','Email'))+'</small>':'')+'</dd></div><div><dt>'+t('Para','To')+'</dt><dd>'+esc(broker)+'</dd></div></dl>'+(d.message?'<div class="simple-message"><h3>'+t('Mensaje','Message')+'</h3><p>'+esc(d.message)+'</p></div>':'')+'<footer class="proposal-footnote">'+(version?'<p>'+t('Enviada el ','Submitted on ')+esc(date(version.submittedAt,language))+' (Costa Rica)</p>':'')+'<p>'+esc(version?.notice||simpleNotice[language])+'</p></footer></article>';
}
