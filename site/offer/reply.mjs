import {blankSimpleOffer,validateSimpleOffer} from './model.mjs?v=3';
export const dialCodes=[['506','Costa Rica'],['1','US / Canada'],['52','México'],['502','Guatemala'],['503','El Salvador'],['504','Honduras'],['505','Nicaragua'],['507','Panamá'],['57','Colombia'],['58','Venezuela'],['593','Ecuador'],['51','Perú'],['591','Bolivia'],['56','Chile'],['54','Argentina'],['55','Brasil'],['598','Uruguay'],['595','Paraguay'],['34','España'],['44','United Kingdom'],['353','Ireland'],['33','France'],['49','Deutschland'],['31','Nederland'],['32','Belgium'],['41','Schweiz'],['39','Italia'],['351','Portugal'],['45','Danmark'],['46','Sverige'],['47','Norge'],['358','Finland'],['48','Polska'],['420','Česko'],['43','Österreich'],['61','Australia'],['64','New Zealand'],['81','日本'],['82','대한민국'],['86','中国'],['91','India'],['972','Israel'],['971','UAE'],['27','South Africa']];
export function replyDraft(currency,saved={}){
  const result={...blankSimpleOffer(currency),replyMethod:'',country:'506',dialCode:'',phone:'',email:'',...saved};
  if(saved.contact&&!saved.phone&&!saved.email){
    if(saved.contact.includes('@')){result.replyMethod='email';result.email=saved.contact;}
    else {result.replyMethod='whatsapp';const digits=saved.contact.replace(/\D/g,'');const code=saved.contact.startsWith('+')?dialCodes.map(([v])=>v).sort((a,b)=>b.length-a.length).find(v=>digits.startsWith(v)):null;if(code){result.country=code;result.phone=digits.slice(code.length);}else result.phone=saved.contact;}
  }
  return result;
}
export function proposedOffer(d){
  const phone=String(d.phone||'').trim(),code=d.country==='other'?String(d.dialCode||'').replace(/\D/g,''):d.country;
  const contact=d.replyMethod==='email'?String(d.email||'').trim():phone.startsWith('+')?'+'+phone.replace(/\D/g,''):'+'+code+phone.replace(/\D/g,'');
  return {schema:2,amount:d.amount,currency:d.currency,name:d.name,message:d.message,replyMethod:d.replyMethod,contact};
}
export function validateReply(d){
  const errors=validateSimpleOffer(proposedOffer(d));delete errors.contact;
  if(!['whatsapp','email'].includes(d.replyMethod))errors.replyMethod='required';
  else if(d.replyMethod==='email'&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(d.email||'').trim())||d.email.length>254))errors.email='email';
  else if(d.replyMethod==='whatsapp'){
    const code=d.country==='other'?String(d.dialCode||'').replace(/^\+/,''):d.country;
    if(!String(d.phone||'').trim().startsWith('+')&&(!/^[1-9]\d{0,3}$/.test(code)||d.country!=='other'&&!dialCodes.some(([v])=>v===code)))errors.dialCode='code';
    if(!/^\+?[\d\s().-]+$/.test(d.phone||'')||!/^\+[1-9]\d{7,14}$/.test(proposedOffer(d).contact))errors.phone='phone';
  }
  return errors;
}
