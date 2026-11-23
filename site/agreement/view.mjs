import {feeLabel,feeExample,money} from './model.mjs';
export const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function agreementDate(value,language='es'){
  if(!value||!Number.isFinite(Date.parse(value)))return '';
  return new Intl.DateTimeFormat(language==='en'?'en-US':'es-CR',{dateStyle:'long',timeZone:'America/Costa_Rica'}).format(new Date(value));
}
export function contactURL(row,language='es',withdraw=false){
  const en=language==='en',subject=(withdraw?(en?'End the marketing agreement: ':'Retirar mi propiedad: '):(en?'Question about the agreement: ':'Consulta sobre la autorización: '))+row.terms.propertyName;
  const body=withdraw?(en?'I am writing to end the marketing engagement for ':'Por este medio comunico el retiro del encargo de promoción de ')+row.terms.propertyName+'.\n'+(en?'Agreement reference: ':'Referencia del acuerdo: ')+(row.id||'')+'\n\n'+(en?'Please confirm receipt and removal of the advertising.':'Por favor confirmá la recepción y el retiro de la publicidad.'):'';
  return 'mailto:'+row.brokerEmail+'?subject='+encodeURIComponent(subject)+(body?'&body='+encodeURIComponent(body):'');
}
export function agreementPaper(row,language='es'){
  const d=row.terms,doc=row.documents[language],en=language==='en',example=feeExample(d),ongoing=d.durationDays==='ongoing';
  const rate=d.feeType==='percent'?d.fee+'%':money(d.fee,d.currency,language);
  const tax=d.taxMode==='exclusive'?(en?'Plus ':'Más ')+d.taxRate+'% IVA '+(en?'on the commission':'sobre la comisión'):d.taxMode==='included'?(en?'Includes ':'Incluye ')+d.taxRate+'% IVA':(en?'No IVA charged: ':'Sin cobro de IVA: ')+d.taxReason;
  const facts=[en?'No exclusivity':'Sin exclusividad',en?'No upfront payment':'Sin pago inicial',ongoing?(en?'Cancel anytime':'Cancelás cuando quieras'):(en?'Term: ':'Vigencia: ')+d.durationDays+(en?' days':' días')];
  return `<article class="agreement-paper" id="agreement-document">
    <header class="agreement-document-header"><p class="agreement-eyebrow">${en?'YOUR PROPERTY. YOUR DECISION.':'TU PROPIEDAD. TU DECISIÓN.'}</p><h1>${esc(doc.title)}</h1><p class="agreement-intro">${esc(d.brokerName)} ${en?'proposes helping you sell. Here is what you are agreeing to.':'te propone ayudar con la venta. Esto es lo que estamos acordando.'}</p>
    <div class="agreement-property-card"><span>${en?'PROPERTY':'PROPIEDAD'}</span><h2>${esc(d.propertyName)}</h2><p>${esc(d.propertyReference)}</p></div>
    <ul class="agreement-benefits">${facts.map(f=>'<li><span aria-hidden="true">✓</span> '+esc(f)+'</li>').join('')}</ul></header>
    <section class="agreement-fee" aria-label="${en?'Commission':'Comisión'}"><p class="agreement-eyebrow">${en?'COMMISSION IF THE SALE CLOSES':'COMISIÓN SI SE CONCRETA LA VENTA'}</p><div class="agreement-rate"><strong>${esc(rate)}</strong><span>${d.feeType==='percent'?(en?'of the final sale price':'del precio final de venta'):(en?'fixed commission':'de comisión fija')}</span></div><p class="agreement-tax">${esc(tax)}</p><p class="agreement-fee-condition">${en?'Only for a completed sale to a buyer introduced by your broker, under the conditions below.':'Solo por una venta cerrada a un comprador presentado por tu corredor, según las condiciones de abajo.'}</p>
    <details class="agreement-example"><summary>${en?'See an example at ':'Ver ejemplo con un precio de '}${esc(money(d.askingPrice,d.currency,language))}</summary><dl><div><dt>${en?'Commission':'Comisión'}</dt><dd>${esc(money(example.net,d.currency,language))}</dd></div><div><dt>IVA</dt><dd>${esc(money(example.tax,d.currency,language))}</dd></div><div class="agreement-total"><dt>${en?'Total payable':'Total a pagar'}</dt><dd>${esc(money(example.total,d.currency,language))}</dd></div></dl><p>${en?'Illustration only. A percentage is recalculated on the actual sale price.':'Es un ejemplo. El porcentaje se recalcula sobre el precio real de venta.'}</p></details></section>
    <div class="agreement-clauses"><p class="agreement-eyebrow">${en?'OUR AGREEMENT, IN PLAIN WORDS':'NUESTRO ACUERDO, EN PALABRAS CLARAS'}</p>${doc.sections.map(([h,p],i)=>`<section><span class="agreement-section-number" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><div><h2>${esc(h)}</h2><p>${esc(p)}</p></div></section>`).join('')}</div>
    ${row.acceptance?`<section class="agreement-accepted"><h2>${en?'Acceptance recorded':'Aceptación registrada'}</h2><p><strong>${esc(row.acceptance.name)}</strong> · ${row.acceptance.capacity==='owner'?(en?'Owner':'Propietario'):(en?'Authorized representative':'Representante autorizado')}</p><p>${esc(row.acceptance.consent)}</p><p>${esc(agreementDate(row.acceptedAt,language))} · ${esc(row.acceptedAt)}</p>${row.endsAt?`<p>${en?'Agreed end date: ':'Vencimiento acordado: '}${esc(agreementDate(row.endsAt,language))}</p>`:ongoing?`<p>${en?'No fixed end date. Either party can end the engagement by email.':'Sin fecha fija de vencimiento. Cualquiera de las partes puede terminar el encargo por correo.'}</p>`:''}</section>`:''}
    <footer class="agreement-reference">${en?'Reference':'Referencia'} ${esc(row.id?.slice(0,12)||'—')} <span>·</span> ${esc(row.termsVersion)}</footer>
  </article>`;
}
