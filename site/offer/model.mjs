export const noticeVersion='2026-11-11-v1';
export const notice={
  en:'This proposal records your initial purchase terms for discussion. It is not a purchase agreement, a reservation, or confirmation of seller acceptance. No payment is collected. Your broker may share it with the property owner to discuss your proposal.',
  es:'Esta propuesta registra tus condiciones iniciales de compra para conversar. No es un contrato de compraventa, una reserva ni una confirmación de aceptación del vendedor. No se cobra ningún pago. Tu corredor podrá compartirla con el propietario para conversar sobre tu propuesta.'
};
export const choices={
  funding:[['cash','Fondos propios','Own funds'],['finance','Con financiamiento','With financing'],['guidance','Necesito orientación','I need guidance']],
  depositMode:[['amount','Proponer un monto','Propose an amount'],['discuss','Conversarlo con mi corredor','Discuss with my broker']],
  closing:[['30','En unos 30 días','About 30 days'],['60','En unos 60 días','About 60 days'],['90','En unos 90 días','About 90 days'],['flexible','Tengo flexibilidad','I’m flexible']],
  conditions:[['inspection','Inspección de la propiedad','Property inspection'],['legal','Revisión legal y documental','Legal and document review'],['finance','Aprobación del financiamiento','Financing approval'],['sale','Venta de otra propiedad','Sale of another property']],
  validity:[['3','3 días','3 days'],['7','7 días','7 days'],['14','14 días','14 days']]
};
export const blankOffer=currency=>({name:'',email:'',phone:'',amount:'',currency:currency||'USD',funding:'',depositMode:'',deposit:'',closing:'',conditions:[],otherConditions:'',message:'',validity:'7'});
export function validateOffer(input){
  const d=input&&typeof input==='object'?input:{},errors={};
  const required=(key,max)=>{if(typeof d[key]!=='string'||!d[key].trim()||d[key].length>max)errors[key]='required';};
  required('name',120);required('email',254);
  if(typeof d.email==='string'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim()))errors.email='email';
  for(const [key,max] of [['phone',40],['otherConditions',2000],['message',2000]])if(typeof d[key]!=='string'||d[key].length>max)errors[key]='length';
  const money=value=>typeof value==='string'&&/^\d{1,13}(\.\d{1,2})?$/.test(value)&&Number(value)>0&&Number(value)<=9999999999999;
  if(!money(d.amount))errors.amount='amount';
  if(!['USD','CRC'].includes(d.currency))errors.currency='required';
  for(const key of ['funding','depositMode','closing','validity'])if(!choices[key].some(([value])=>value===d[key]))errors[key]='required';
  if(d.depositMode==='amount'&&(!money(d.deposit)||Number(d.deposit)>Number(d.amount)))errors.deposit='deposit';
  if(!Array.isArray(d.conditions)||d.conditions.length>4||new Set(d.conditions).size!==d.conditions.length||d.conditions.some(v=>!choices.conditions.some(([key])=>v===key)))errors.conditions='required';
  return errors;
}
export function normalizeOffer(d){return Object.fromEntries(Object.keys(blankOffer()).map(key=>[key,key==='conditions'?[...d.conditions]:key==='deposit'&&d.depositMode!=='amount'?'':String(d[key]||'').trim()]));}
export const choiceLabel=(key,value,lang='es')=>choices[key]?.find(row=>row[0]===value)?.[lang==='en'?2:1]||'—';

export const simpleNoticeVersion='2026-11-11-v2';
export const simpleNotice={
  es:'Esta es una propuesta inicial para conversar, no un contrato ni una reserva. Tu corredor podrá compartirla con el propietario.',
  en:'This is an initial proposal for discussion, not a contract or reservation. Your broker may share it with the property owner.'
};
export const blankSimpleOffer=currency=>({schema:2,amount:'',currency:currency||'USD',name:'',contact:'',message:''});
export function validateSimpleOffer(d){
  const errors={};d=d&&typeof d==='object'?d:{};
  if(typeof d.amount!=='string'||!/^\d{1,13}(\.\d{1,2})?$/.test(d.amount)||Number(d.amount)<=0||Number(d.amount)>9999999999999)errors.amount='amount';
  if(!['USD','CRC'].includes(d.currency))errors.currency='currency';
  if(typeof d.name!=='string'||!d.name.trim()||d.name.length>120)errors.name='name';
  const contact=typeof d.contact==='string'?d.contact.trim():'';
  if(contact.length>254||!(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)||/^\+?[\d\s().-]+$/.test(contact)&&/^\d{8,15}$/.test(contact.replace(/\D/g,''))))errors.contact='contact';
  if(typeof d.message!=='string'||d.message.length>2000)errors.message='message';
  if(d.schema!==2)errors.schema='schema';
  return errors;
}
export const normalizeSimpleOffer=d=>({schema:2,...Object.fromEntries(['amount','currency','name','contact','message'].map(key=>[key,d[key].trim()]))});
