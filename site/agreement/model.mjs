export const termsVersion='2026-11-22-v2';
export const consent={es:'Leí el acuerdo y acepto la comisión y las condiciones indicadas. Confirmo que soy propietario o representante autorizado.',en:'I have read the agreement and accept the stated commission and terms. I confirm that I am the owner or an authorized representative.'};
export const blankAgreement=()=>({ownerName:'',ownerEmail:'',brokerName:'',propertyName:'',propertyReference:'',askingPrice:'',currency:'USD',feeType:'percent',fee:'5',taxMode:'exclusive',taxRate:'13',taxReason:'',durationDays:'ongoing',language:'es'});
const limits={ownerName:120,ownerEmail:254,brokerName:160,propertyName:160,propertyReference:600,taxReason:300};
export function normalizeTerms(input={}){
  if(!input||typeof input!=='object'||Array.isArray(input))input={};
  const result={};for(const key of Object.keys(blankAgreement()))result[key]=typeof input[key]==='string'?input[key].trim():'';
  result.ownerEmail=result.ownerEmail.toLowerCase();return result;
}
const decimal=v=>/^\d{1,12}(\.\d{1,2})?$/.test(v)&&Number(v)>0;
export function validateTerms(input){
  const d=normalizeTerms(input),errors={};
  for(const [key,max] of Object.entries(limits))if((key!=='taxReason'&&!d[key])||d[key].length>max||/[\x00-\x1f]/.test(d[key]))errors[key]='required';
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.ownerEmail))errors.ownerEmail='email';
  if(!['USD','CRC'].includes(d.currency))errors.currency='currency';
  if(!decimal(d.askingPrice)||Number(d.askingPrice)>1e11)errors.askingPrice='amount';
  if(!['percent','fixed'].includes(d.feeType)||!decimal(d.fee)||(d.feeType==='percent'?Number(d.fee)>20:Number(d.fee)>Number(d.askingPrice)))errors.fee='amount';
  if(!['exclusive','included','none'].includes(d.taxMode))errors.taxMode='tax';
  if(!/^\d{1,2}(\.\d{1,2})?$/.test(d.taxRate)||Number(d.taxRate)>30||(d.taxMode!=='none'&&Number(d.taxRate)===0))errors.taxRate='tax';
  if(d.taxMode==='none'&&!d.taxReason)errors.taxReason='required';
  if(d.durationDays!=='ongoing')errors.durationDays='duration';
  if(!['es','en'].includes(d.language))errors.language='language';
  return errors;
}
export const money=(v,c,l='es')=>new Intl.NumberFormat(l==='en'?'en-US':'es-CR',{style:'currency',currency:c,currencyDisplay:'code',minimumFractionDigits:2}).format(Number(v));
export function feeExample(d,price=Number(d.askingPrice)){
  const baseCents=Math.round((d.feeType==='percent'?price*Number(d.fee)/100:Number(d.fee))*100);
  const totalCents=d.taxMode==='exclusive'?baseCents+Math.round(baseCents*Number(d.taxRate)/100):baseCents;
  const netCents=d.taxMode==='included'?Math.round(totalCents/(1+Number(d.taxRate)/100)):baseCents;
  return {net:netCents/100,tax:(totalCents-netCents)/100,total:totalCents/100};
}
export function feeLabel(d,l='es'){
  const en=l==='en',base=d.feeType==='percent'?d.fee+'% '+(en?'of the final sale price':'del precio final de venta'):money(d.fee,d.currency,l)+' '+(en?'fixed fee':'de comisión fija');
  return base+(d.taxMode==='exclusive'?(en?' + ':' + ')+d.taxRate+'% IVA'+(en?' on the commission':' sobre la comisión'):d.taxMode==='included'?(en?' (includes ':' (incluye ')+d.taxRate+'% IVA)':(en?' (no IVA charged: ':' (sin cobro de IVA: ')+d.taxReason+')');
}
export function documentFor(d,brokerEmail,l='es'){
  const en=l==='en';
  return {title:en?'Permission to market your property':'Autorización para promocionar tu propiedad',sections:en?[
    ['The property and the people',`${d.ownerName} (${d.ownerEmail}) authorizes ${d.brokerName} (${brokerEmail}) to help market ${d.propertyName}. Property reference: ${d.propertyReference}. Asking price: ${money(d.askingPrice,d.currency,l)}. The named broker provides the service; ArenalIndex is the platform used to promote the property.`],
    ['How we help','We prepare the listing, publish it on ArenalIndex, share its link, respond to inquiries and coordinate viewings and offers. You decide whether to sell and which offer to accept. We cannot guarantee a sale, a price or a deadline.'],
    ['When commission is payable',`${feeLabel(d,l)}. You pay only if a buyer introduced by the broker buys the property while this agreement is in effect, the sale closes and you receive the agreed sale proceeds. Percentage fees use the actual final sale price. An inquiry, viewing, offer or deposit alone does not earn a fee. There are no upfront or monthly fees. Extra expenses or installment-sale arrangements need a separate written agreement. Any sharing between brokers comes from this fee, unless you expressly agree otherwise.`],
    ['You stay in control','This is non-exclusive: you can sell independently or work with other brokers. No commission is due to this broker for a sale unrelated to their introduction. We will record introductions and clarify with you whether a buyer was already known; silence is not agreement. Tell us about any existing exclusivity before accepting.'],
    ['You approve the listing','Before publishing, we ask you to approve the text, photos, price and public location. Other advertising channels need your written permission. You confirm that you may authorize this service and the use of the materials you provide; tell us about any co-owner or representative whose permission is needed. Please let us know if details change or the property is no longer available. Accepting here does not publish anything automatically.'],
    ['Cancel whenever you want','There is no fixed end date or minimum commitment. Either party can end the engagement at any time by emailing the other; there is no cancellation fee. The engagement ends when that notice is received, without requiring approval. We remove advertising we control within two business days; third-party copies may remain. There is no commission for a sale closing after termination, unless separately agreed. A commission already earned on a completed sale remains payable.'],
    ['Your information and this acceptance','We use your contact details, the agreement and its acceptance record only to manage this service, through ArenalIndex and its hosting and email providers. You may request access, correction or deletion from the broker; records needed for legal obligations or disputes may be retained. This does not authorize unrelated marketing. Keep this link private.'],
    ['What this permission covers','You authorize property marketing, not the transfer of ownership, the signing of a sale on your behalf or the collection of deposits. Title, boundaries, utilities and permits require separate checks. We aim to resolve differences directly and in good faith. Your electronic acceptance may have legal effects; it is not a certified digital signature or a guarantee of enforceability.']
  ]:[
    ['La propiedad y las personas',`${d.ownerName} (${d.ownerEmail}) autoriza a ${d.brokerName} (${brokerEmail}) a ayudar con la promoción de ${d.propertyName}. Referencia del inmueble: ${d.propertyReference}. Precio solicitado: ${money(d.askingPrice,d.currency,l)}. El corredor identificado presta el servicio; ArenalIndex es la plataforma para promocionar la propiedad.`],
    ['Cómo te ayudamos','Preparamos el anuncio, lo publicamos en ArenalIndex, compartimos su enlace, atendemos consultas y coordinamos visitas y ofertas. Vos decidís si vendés y qué oferta aceptás. No podemos garantizar una venta, un precio ni un plazo.'],
    ['Cuándo se paga la comisión',`${feeLabel(d,l)}. Pagás únicamente si un comprador presentado por el corredor compra la propiedad mientras este acuerdo está vigente, la venta se cierra y recibís los fondos acordados. El porcentaje se calcula sobre el precio final real. Una consulta, visita, oferta o depósito por sí solos no generan comisión. No hay anticipos ni mensualidades. Los gastos adicionales o ventas en tractos requieren un acuerdo escrito aparte. Cualquier reparto entre corredores sale de esta comisión, salvo que acordés expresamente otra cosa.`],
    ['Seguís teniendo el control','No hay exclusividad: podés vender por tu cuenta o trabajar con otros corredores. No le debés comisión a este corredor por una venta ajena a su presentación. Registraremos los compradores presentados y aclararemos con vos si ya los conocías; el silencio no implica aceptación. Avisanos si ya tenés un acuerdo exclusivo antes de aceptar.'],
    ['Publicamos con tu visto bueno','Antes de publicar, te pedimos aprobar el texto, las fotos, el precio y la ubicación pública. Otros canales de publicidad necesitan tu permiso escrito. Confirmás que podés autorizar este servicio y el uso de los materiales que entregás; avisanos si hace falta el permiso de un copropietario o representante. Si los datos cambian o la propiedad deja de estar disponible, comunicalo. Aceptar aquí no publica nada automáticamente.'],
    ['Cancelás cuando quieras','Este acuerdo no tiene fecha fija de vencimiento ni permanencia mínima. Cualquiera de las partes puede terminarlo en cualquier momento por correo a la otra, sin penalización. El encargo termina al recibirse ese aviso, sin necesitar aprobación. Retiramos la publicidad que controlamos en dos días hábiles; las copias de terceros pueden persistir. No hay comisión por ventas que cierren después del retiro, salvo otro acuerdo expreso. Una comisión ya ganada por una venta cerrada sigue pendiente de pago.'],
    ['Tus datos y esta aceptación','Usamos tus contactos, el acuerdo y su constancia únicamente para gestionar este servicio, mediante ArenalIndex y sus proveedores de alojamiento y correo. Podés pedir acceso, corrección o eliminación al corredor; pueden conservarse registros necesarios para obligaciones legales o controversias. No autoriza publicidad ajena. Mantené este enlace privado.'],
    ['Qué autoriza este acuerdo','Autorizás la promoción de la propiedad, no su traspaso, la firma de una venta en tu nombre ni el cobro de depósitos. El título, los linderos, los servicios y los permisos requieren verificaciones aparte. Buscamos resolver diferencias directamente y de buena fe. Tu aceptación electrónica puede tener efectos jurídicos; no es una firma digital certificada ni garantiza su exigibilidad.']
  ]};
}
export const plainDocument=doc=>doc.title+'\n\n'+doc.sections.map(([h,p])=>h+'\n'+p).join('\n\n');
