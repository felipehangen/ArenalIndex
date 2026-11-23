export const termsVersion='2026-11-22-v1';
export const consent={es:'He leído estos términos y me comprometo a honrarlos. Confirmo que soy propietario o tengo autorización suficiente para este encargo y para usar los materiales que entregaré.',en:'I have read these terms and agree to honor them. I confirm that I own this property or have sufficient authority for this engagement and to use the materials I will provide.'};
export const blankAgreement=()=>({ownerName:'',ownerEmail:'',brokerName:'',propertyName:'',propertyReference:'',askingPrice:'',currency:'USD',feeType:'percent',fee:'5',taxMode:'exclusive',taxRate:'13',taxReason:'',durationDays:'90',language:'es'});
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
  if(!['30','60','90','120','180'].includes(d.durationDays))errors.durationDays='duration';
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
  const en=l==='en',example=feeExample(d),price=money(d.askingPrice,d.currency,l);
  return {title:en?'Our agreement to market your property':'Nuestro acuerdo para promover tu propiedad',sections:en?[
    ['The people and the property',`${d.ownerName} (${d.ownerEmail}) engages ${d.brokerName} (${brokerEmail}) for ${d.propertyName}. Property reference: ${d.propertyReference}. Asking price: ${price}. ArenalIndex is the marketing platform; the named broker provides the brokerage service.`],
    ['What we will do','Prepare your listing for your approval, promote it on ArenalIndex, share its link, respond to inquiries and coordinate viewings and negotiations. Other advertising channels require your written approval. You decide whether to accept an offer. No sale, price or deadline is guaranteed.'],
    ['Your commission',`${feeLabel(d,l)}. The owner pays only when a sale actually closes and the agreed sale funds are received, to a buyer the broker introduced during this agreement. Based on the asking price, the illustrative total is ${money(example.total,d.currency,l)} (commission ${money(example.net,d.currency,l)}, IVA ${money(example.tax,d.currency,l)}). A percentage is recalculated on the actual final sale price. A deposit, inquiry, click, viewing or offer alone does not earn a commission. No upfront, listing or monthly fees. Any additional expense or installment-sale arrangement requires a separate written agreement before proceeding.`],
    ['You keep your options','This is non-exclusive. You may sell directly or work with other brokers. A sale unrelated to this broker’s introduction does not earn this broker a commission. Tell us about existing exclusivity before accepting. We will record introductions and clarify previously known buyers together; silence is not agreement to attribution. Any commission sharing comes from the agreed commission, unless you expressly agree otherwise.'],
    ['Your listing and materials','You confirm sufficient authority to engage the broker and permit use of the photos and information you supply. Tell us about co-owners or representatives whose permission is needed. We will obtain your approval of the text, price, photos and public map location before publication; acceptance here alone does not publish anything. Use is limited to marketing this property during the engagement. Tell us promptly if the price, availability or information changes.'],
    ['Duration and stopping',`The engagement lasts ${d.durationDays} days from acceptance, with no automatic renewal. Either party can stop it by emailing the other. We will acknowledge the request and remove advertising we control within two business days. Third-party copies may persist. There is no automatic post-termination commission period; any extension must be agreed separately. Fees already earned before termination remain payable.`],
    ['Clear limits and privacy','This does not transfer property, authorize the broker to sign a sale or receive deposits, or certify title, boundaries, water, permits or investment returns. Sale formalities and due diligence are separate. The named broker and ArenalIndex use your supplied contact details, terms and acceptance record to manage this engagement and send both parties a copy, using their hosting and email providers. This private link is not intended for public sharing. Ask your broker for access, correction, withdrawal or deletion requests; records needed for legal obligations or disputes may need to be retained. No unrelated marketing is authorized.'],
    ['A clear commitment','We aim to work in good faith and resolve misunderstandings directly using the agreed terms and records. This is electronic acceptance, not a certified digital signature. No physical signature, account or certified signature is required. Electronic acceptance may have legal effects; this page does not promise enforcement or waive legal rights.']
  ]:[
    ['Las personas y la propiedad',`${d.ownerName} (${d.ownerEmail}) encarga a ${d.brokerName} (${brokerEmail}) la gestión de ${d.propertyName}. Referencia del inmueble: ${d.propertyReference}. Precio solicitado: ${price}. ArenalIndex es la plataforma de promoción; el corredor identificado presta el servicio de corretaje.`],
    ['Qué vamos a hacer','Preparar tu anuncio para tu aprobación, promoverlo en ArenalIndex, compartir su enlace, atender consultas y coordinar visitas y negociaciones. Otros canales de publicidad requieren tu aprobación escrita. Vos decidís si aceptás una oferta. No se garantiza venta, precio ni plazo.'],
    ['Tu comisión',`${feeLabel(d,l)}. El propietario paga únicamente cuando la venta se cierre efectivamente y se reciban los fondos de venta acordados, a un comprador presentado por el corredor durante este encargo. Al precio solicitado, el total ilustrativo es ${money(example.total,d.currency,l)} (comisión ${money(example.net,d.currency,l)}, IVA ${money(example.tax,d.currency,l)}). Un porcentaje se recalcula sobre el precio final real. Un depósito, consulta, clic, visita u oferta por sí solos no generan comisión. Sin cobro inicial, de publicación ni mensualidad. Cualquier gasto adicional o modalidad de venta en tractos requiere un acuerdo escrito separado antes de continuar.`],
    ['Conservás tus opciones','El encargo no es exclusivo. Podés vender directamente o trabajar con otros corredores. Una venta ajena a la presentación de este corredor no genera comisión para él. Informanos de cualquier exclusividad existente antes de aceptar. Registraremos las presentaciones y aclararemos juntos los compradores previamente conocidos; el silencio no acepta una atribución. Cualquier reparto entre corredores sale de la comisión acordada, salvo otro acuerdo expreso con vos.'],
    ['Tu anuncio y sus materiales','Confirmás tener facultad suficiente para este encargo y para permitir el uso de las fotos e información que entregás. Informanos de copropietarios o representantes cuyo permiso sea necesario. Pediremos tu aprobación del texto, precio, fotos y ubicación pública antes de publicar; aceptar aquí no publica nada. El uso se limita a promover este inmueble durante el encargo. Avisanos pronto si cambia el precio, disponibilidad o información.'],
    ['Duración y retiro',`El encargo dura ${d.durationDays} días desde la aceptación, sin renovación automática. Cualquiera puede terminarlo por correo a la otra parte. Confirmaremos la solicitud y retiraremos la publicidad que controlamos en dos días hábiles. Las copias de terceros pueden persistir. No hay un período automático de comisión después de terminar; cualquier extensión debe acordarse aparte. Las comisiones ya devengadas antes del retiro siguen pendientes de pago.`],
    ['Límites claros y privacidad','Esto no transfiere la propiedad, no autoriza al corredor a firmar una venta ni recibir depósitos, ni certifica título, linderos, agua, permisos o rentabilidad. La revisión y formalización de la venta son independientes. El corredor identificado y ArenalIndex usan tus contactos, términos y registro de aceptación para gestionar este encargo y enviar copia a ambas partes, mediante sus proveedores de alojamiento y correo. Este enlace es privado y no está destinado a difusión pública. Podés pedir acceso, corrección, retiro o eliminación al corredor; los registros necesarios para obligaciones legales o controversias pueden requerir conservación. No autoriza publicidad ajena.'],
    ['Un compromiso claro','Buscamos trabajar de buena fe y resolver malentendidos directamente con los términos y registros acordados. Esta es una aceptación electrónica, no una firma digital certificada. No requiere firma física, cuenta ni firma certificada. La aceptación electrónica puede tener efectos jurídicos; esta página no promete su exigibilidad ni implica renunciar a derechos.']
  ]};
}
export const plainDocument=doc=>doc.title+'\n\n'+doc.sections.map(([h,p])=>h+'\n'+p).join('\n\n');
